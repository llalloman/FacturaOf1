"""
Facturación ViewSets — extracted from urls.py for clean separation of concerns.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Factura, DetalleFactura, Retencion, GuiaRemision,
    NotaDebito, NotaCredito, Secuencial,
)
from .serializers import (
    FacturaSerializer, DetalleFacturaSerializer, RetencionSerializer,
    GuiaRemisionSerializer, NotaDebitoSerializer, NotaCreditoSerializer,
    SecuencialSerializer,
)
from apps.core.export_mixin import ExportMixin


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_empresa_from_request(request):
    """Utility shared by all ViewSets to resolve the current tenant."""
    empresa = getattr(request, 'tenant', None)
    if not empresa and request.user.is_authenticated:
        empresa = getattr(request.user, 'empresa', None)
    return empresa


def _desvincular_venta(factura):
    """Desvincula la venta de la factura para que pueda referenciar un nuevo comprobante."""
    try:
        venta_obj = getattr(factura, 'venta', None)
        if venta_obj and venta_obj.factura_id == factura.id:
            venta_obj.factura = None
            venta_obj.genera_factura = False
            venta_obj.save(update_fields=['factura', 'genera_factura'])
    except Exception:
        pass


# ─── Filters ──────────────────────────────────────────────────────────────────

class FacturaFilter(django_filters.FilterSet):
    estado = django_filters.CharFilter(field_name='comprobante__estado', lookup_expr='iexact')
    cliente = django_filters.NumberFilter(field_name='cliente__id')

    class Meta:
        model = Factura
        fields = ['cliente']


# ─── Factura ──────────────────────────────────────────────────────────────────

class FacturaViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = FacturaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FacturaFilter
    search_fields = ['comprobante__numero_comprobante', 'cliente__razon_social']
    ordering_fields = ['comprobante__fecha_emision', 'total']
    ordering = ['-comprobante__fecha_emision']
    export_filename = 'facturas'
    export_fields = [
        ('comprobante__numero_comprobante', 'Nro. Comprobante'),
        ('comprobante__fecha_emision', 'Fecha Emisión'),
        ('cliente__razon_social', 'Cliente'),
        ('cliente__identificacion', 'Identificación'),
        ('comprobante__estado', 'Estado'),
        ('subtotal_sin_impuestos', 'Subtotal'),
        ('total_descuento', 'Descuento'),
        ('iva_12', 'IVA 12%'),
        ('iva_15', 'IVA 15%'),
        ('total', 'Total'),
        ('forma_pago', 'Forma Pago'),
        ('comprobante__clave_acceso', 'Clave Acceso'),
    ]

    def _get_empresa(self):
        return _get_empresa_from_request(self.request)

    def get_queryset(self):
        empresa = self._get_empresa()
        if empresa:
            return Factura.objects.select_related(
                'comprobante', 'cliente'
            ).filter(comprobante__empresa=empresa)
        return Factura.objects.none()

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'])
    def enviar_sri(self, request, pk=None):
        """Genera XML, firma y envía la factura al SRI."""
        factura = self.get_object()
        from apps.facturacion.services.factura_service import procesar_factura_sri
        result = procesar_factura_sri(factura)
        http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response(result, status=http_status)

    @action(detail=True, methods=['get'])
    def xml(self, request, pk=None):
        """Retorna el XML generado/firmado de la factura."""
        factura = self.get_object()
        comp = factura.comprobante
        xml = comp.xml_firmado or comp.xml_generado
        if not xml:
            return Response({'error': 'No hay XML generado aún'}, status=status.HTTP_404_NOT_FOUND)
        from django.http import HttpResponse
        return HttpResponse(xml, content_type='application/xml')

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        factura = self.get_object()
        comp = factura.comprobante
        estado_actual = comp.estado

        if estado_actual == 'ANULADO':
            return Response({'mensaje': 'La factura ya está anulada.'})

        if estado_actual == 'AUTORIZADO':
            motivo = (request.data.get('motivo') or 'Anulación de factura')[:300]
            from apps.facturacion.services.nota_credito_service import (
                crear_nota_credito_desde_factura, procesar_nota_credito_sri,
            )
            try:
                nota_credito = crear_nota_credito_desde_factura(factura, motivo=motivo)
                nc_result = procesar_nota_credito_sri(nota_credito)
            except Exception as e:
                return Response(
                    {'error': f'No se pudo crear la Nota de Crédito: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            nc_estado = nc_result.get('estado', '')
            nc_info = {
                'numero': nc_result['numero_comprobante'],
                'estado': nc_estado,
                'numero_autorizacion': nota_credito.comprobante.numero_autorizacion or '',
                'mensaje': nc_result['mensaje'],
            }

            if nc_estado in ('AUTORIZADO', 'ENVIADO'):
                comp.estado = 'ANULADO'
                comp.save(update_fields=['estado'])
                _desvincular_venta(factura)
                return Response({
                    'mensaje': 'Factura anulada. Nota de Crédito generada y enviada al SRI.',
                    'estado': 'ANULADO',
                    'nota_credito': nc_info,
                })
            else:
                return Response(
                    {
                        'error': 'La Nota de Crédito fue rechazada por el SRI. La factura no fue anulada.',
                        'nota_credito': nc_info,
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

        comp.estado = 'ANULADO'
        comp.save(update_fields=['estado'])
        _desvincular_venta(factura)
        return Response({
            'mensaje': 'Factura anulada. El comprobante no había sido autorizado por el SRI.',
            'estado': 'ANULADO',
        })

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """
        Consulta la autorización del SRI para comprobantes en estado ENVIADO o RECHAZADO.
        Single-check: no blocking loops.
        """
        from apps.facturacion.services.sri_service import SRIService

        factura = self.get_object()
        comp = factura.comprobante

        if comp.estado not in ('ENVIADO', 'RECHAZADO', 'NO_AUTORIZADO'):
            return Response(
                {'error': f'Solo se reprocesa desde estado ENVIADO / RECHAZADO. Estado actual: {comp.estado}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if comp.estado in ('RECHAZADO', 'NO_AUTORIZADO'):
            from apps.facturacion.services.factura_service import procesar_factura_sri
            result = procesar_factura_sri(factura)
            http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
            return Response(result, status=http_status)

        sri = SRIService(comp.empresa)
        try:
            # ── Fase 1: consulta inmediata de autorización ────────────────────
            aut_obj = None
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut_obj = auth.autorizaciones.autorizacion[0]

            if aut_obj:
                if aut_obj.estado == 'AUTORIZADO':
                    comp.estado = 'AUTORIZADO'
                    comp.numero_autorizacion = getattr(aut_obj, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion = getattr(aut_obj, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({
                        'estado': comp.estado,
                        'numero_autorizacion': comp.numero_autorizacion,
                        'mensaje': f'Autorizada: {comp.numero_autorizacion}',
                    })
                else:
                    mensajes_list = []
                    if hasattr(aut_obj, 'mensajes') and aut_obj.mensajes:
                        for m in getattr(aut_obj.mensajes, 'mensaje', []):
                            mensajes_list.append(
                                f"[{getattr(m, 'identificador', '')}] "
                                f"{getattr(m, 'mensaje', '')} — "
                                f"{getattr(m, 'informacionAdicional', '')}"
                            )
                    comp.estado = 'NO_AUTORIZADO'
                    comp.mensajes_sri = '\n'.join(mensajes_list)
                    comp.save()
                    return Response(
                        {'estado': comp.estado, 'mensaje': comp.mensajes_sri or 'No autorizado por el SRI'},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )

            # ── Fase 2: el SRI no tiene la clave — re-enviar XML ─────────────
            if not comp.xml_firmado:
                return Response({
                    'estado': comp.estado,
                    'mensaje': 'Sin respuesta del SRI y sin XML firmado. Re-envíe desde BORRADOR.',
                })

            response = sri.enviar_comprobante_sri(comp)
            mensajes_recep = []
            ya_registrada = False
            if hasattr(response, 'estado') and response.estado == 'RECIBIDA':
                ya_registrada = True
            else:
                raw_msgs = getattr(response, 'comprobantes', None)
                raw_list = getattr(raw_msgs, 'comprobante', []) if raw_msgs else []
                for comp_item in raw_list:
                    for m in getattr(getattr(comp_item, 'mensajes', None), 'mensaje', []):
                        ident = str(getattr(m, 'identificador', ''))
                        mensajes_recep.append(ident)
                        if ident in ('43', '70'):
                            ya_registrada = True
                if not ya_registrada:
                    msg_str = ' | '.join(mensajes_recep)
                    ya_registrada = '43' in msg_str or '70' in msg_str

            if not ya_registrada and mensajes_recep:
                comp.estado = 'RECHAZADO'
                comp.mensajes_sri = ' | '.join(mensajes_recep)
                comp.save(update_fields=['estado', 'mensajes_sri'])
                return Response(
                    {'estado': comp.estado, 'mensaje': comp.mensajes_sri},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            # ── Fase 3: consulta inmediata de autorización tras el re-envío ──
            aut_obj = None
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut_obj = auth.autorizaciones.autorizacion[0]

            if aut_obj and aut_obj.estado == 'AUTORIZADO':
                comp.estado = 'AUTORIZADO'
                comp.numero_autorizacion = getattr(aut_obj, 'numeroAutorizacion', '')
                comp.fecha_autorizacion = getattr(aut_obj, 'fechaAutorizacion', None)
                comp.mensajes_sri = ''
                comp.save()
                return Response({
                    'estado': comp.estado,
                    'numero_autorizacion': comp.numero_autorizacion,
                    'mensaje': f'Autorizada: {comp.numero_autorizacion}',
                })

            return Response({
                'estado': comp.estado,
                'mensaje': 'Re-enviado al SRI. Autorización aún pendiente — intente reprocesar nuevamente en unos segundos.',
            })

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def ride(self, request, pk=None):
        """Alias de /pdf/ — mantiene compatibilidad."""
        return self.pdf(request, pk=pk)

    @action(detail=True, methods=['post'])
    def reenviar_email(self, request, pk=None):
        """Reenvía el PDF+XML de la factura AUTORIZADA al email del cliente."""
        factura = self.get_object()
        comp = factura.comprobante
        if comp.estado != 'AUTORIZADO':
            return Response(
                {'error': 'Solo se puede reenviar email de facturas autorizadas'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.facturacion.services.factura_service import _enviar_factura_email
        try:
            _enviar_factura_email(factura)
        except Exception as e:
            return Response({'error': f'Error al enviar email: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'mensaje': f'Email enviado a {factura.cliente.email}'})

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Genera y retorna el RIDE (PDF) de la factura autorizada."""
        factura = self.get_object()
        comp = factura.comprobante
        if comp.estado != 'AUTORIZADO':
            return Response(
                {'error': 'Solo se genera el RIDE de facturas autorizadas'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.facturacion.services.ride_service import generar_ride_pdf
        from django.http import HttpResponse
        try:
            pdf_bytes = generar_ride_pdf(factura)
        except Exception as e:
            return Response({'error': f'Error al generar PDF: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="RIDE-{comp.numero_comprobante}.pdf"'
        )
        return response


# ─── Retención ────────────────────────────────────────────────────────────────

class RetencionViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = RetencionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {'comprobante__estado': ['exact', 'iexact'], 'proveedor': ['exact']}
    search_fields = ['comprobante__numero_comprobante', 'proveedor__razon_social']
    ordering_fields = ['comprobante__fecha_emision']
    ordering = ['-comprobante__fecha_emision']
    export_filename = 'retenciones'
    export_fields = [
        ('comprobante__numero_comprobante', 'Nro. Comprobante'),
        ('comprobante__fecha_emision', 'Fecha Emisión'),
        ('proveedor__razon_social', 'Proveedor'),
        ('proveedor__identificacion', 'RUC Proveedor'),
        ('periodo_fiscal', 'Período Fiscal'),
        ('comprobante__estado', 'Estado'),
        ('comprobante__clave_acceso', 'Clave Acceso'),
    ]

    def _get_empresa(self):
        return _get_empresa_from_request(self.request)

    def get_queryset(self):
        empresa = self._get_empresa()
        if empresa:
            return Retencion.objects.select_related(
                'comprobante', 'proveedor'
            ).filter(comprobante__empresa=empresa)
        return Retencion.objects.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['post'])
    def enviar_sri(self, request, pk=None):
        """Genera XML, firma y envía la retención al SRI."""
        from apps.facturacion.services.factura_service import procesar_retencion_sri
        retencion = self.get_object()
        try:
            result = procesar_retencion_sri(retencion)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response(result, status=http_status)

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """Consulta al SRI si ya autorizó este comprobante (para estado ENVIADO)."""
        from apps.facturacion.services.sri_service import SRIService
        from apps.facturacion.models import ComprobanteElectronico
        retencion = self.get_object()
        comp = retencion.comprobante
        if comp.estado != 'ENVIADO':
            return Response({'error': 'Solo se puede reprocesar en estado ENVIADO'}, status=status.HTTP_400_BAD_REQUEST)
        sri = SRIService(comp.empresa)
        try:
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut = auth.autorizaciones.autorizacion[0]
                if aut.estado == 'AUTORIZADO':
                    comp.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                    comp.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion = getattr(aut, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({'estado': comp.estado, 'numero_autorizacion': comp.numero_autorizacion})
            return Response({'estado': comp.estado, 'mensaje': 'Sin autorizaciones aún'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─── Guía de Remisión ────────────────────────────────────────────────────────

class GuiaRemisionViewSet(viewsets.ModelViewSet):
    serializer_class = GuiaRemisionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {'comprobante__estado': ['exact', 'iexact']}
    search_fields = ['comprobante__numero_comprobante', 'razon_social_transportista', 'placa']
    ordering_fields = ['comprobante__fecha_emision']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        return _get_empresa_from_request(self.request)

    def get_queryset(self):
        empresa = self._get_empresa()
        if empresa:
            return GuiaRemision.objects.select_related(
                'comprobante'
            ).prefetch_related(
                'destinatarios__detalles'
            ).filter(comprobante__empresa=empresa)
        return GuiaRemision.objects.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['post'])
    def enviar_sri(self, request, pk=None):
        """Genera XML, firma y envía la guía al SRI."""
        from apps.facturacion.services.factura_service import procesar_guia_remision_sri
        guia = self.get_object()
        try:
            result = procesar_guia_remision_sri(guia)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response(result, status=http_status)

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """Consulta al SRI si ya autorizó la guía (para estado ENVIADO)."""
        from apps.facturacion.services.sri_service import SRIService
        from apps.facturacion.models import ComprobanteElectronico
        guia = self.get_object()
        comp = guia.comprobante
        if comp.estado != 'ENVIADO':
            return Response({'error': 'Solo se puede reprocesar en estado ENVIADO'}, status=status.HTTP_400_BAD_REQUEST)
        sri = SRIService(comp.empresa)
        try:
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut = auth.autorizaciones.autorizacion[0]
                if aut.estado == 'AUTORIZADO':
                    comp.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                    comp.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion = getattr(aut, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({'estado': comp.estado, 'numero_autorizacion': comp.numero_autorizacion})
            return Response({'estado': comp.estado, 'mensaje': 'Sin autorizaciones aún'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─── Nota de Débito ──────────────────────────────────────────────────────────

class NotaDebitoViewSet(viewsets.ModelViewSet):
    serializer_class = NotaDebitoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {'comprobante__estado': ['exact', 'iexact'], 'cliente': ['exact']}
    search_fields = ['comprobante__numero_comprobante', 'cliente__razon_social', 'motivo']
    ordering_fields = ['comprobante__fecha_emision']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        return _get_empresa_from_request(self.request)

    def get_queryset(self):
        empresa = self._get_empresa()
        if empresa:
            return NotaDebito.objects.select_related(
                'comprobante', 'cliente', 'factura_origen'
            ).filter(comprobante__empresa=empresa)
        return NotaDebito.objects.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['post'])
    def enviar_sri(self, request, pk=None):
        """Genera XML, firma y envía la nota de débito al SRI."""
        from apps.facturacion.services.factura_service import procesar_nota_debito_sri
        nota = self.get_object()
        try:
            result = procesar_nota_debito_sri(nota)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response(result, status=http_status)

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """Consulta al SRI si ya autorizó (para estado ENVIADO)."""
        from apps.facturacion.services.sri_service import SRIService
        from apps.facturacion.models import ComprobanteElectronico
        nota = self.get_object()
        comp = nota.comprobante
        if comp.estado != 'ENVIADO':
            return Response({'error': 'Solo se puede reprocesar en estado ENVIADO'}, status=status.HTTP_400_BAD_REQUEST)
        sri = SRIService(comp.empresa)
        try:
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut = auth.autorizaciones.autorizacion[0]
                if aut.estado == 'AUTORIZADO':
                    comp.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                    comp.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion = getattr(aut, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({'estado': comp.estado, 'numero_autorizacion': comp.numero_autorizacion})
            return Response({'estado': comp.estado, 'mensaje': 'Sin autorizaciones aún'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─── Nota de Crédito ─────────────────────────────────────────────────────────

class NotaCreditoViewSet(ExportMixin, viewsets.ReadOnlyModelViewSet):
    """
    Lista y detalle de Notas de Crédito (generadas al anular facturas autorizadas).
    Las NC no se crean aquí — se crean automáticamente al anular una Factura AUTORIZADA.
    """
    serializer_class = NotaCreditoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {'comprobante__estado': ['exact', 'iexact']}
    search_fields = [
        'comprobante__numero_comprobante',
        'factura_origen__cliente__razon_social',
        'motivo',
    ]
    ordering_fields = ['comprobante__fecha_emision', 'total']
    ordering = ['-comprobante__fecha_emision']
    export_filename = 'notas_credito'
    export_fields = [
        ('comprobante__numero_comprobante', 'Nro. Comprobante'),
        ('comprobante__fecha_emision', 'Fecha Emisión'),
        ('factura_origen__comprobante__numero_comprobante', 'Factura Origen'),
        ('factura_origen__cliente__razon_social', 'Cliente'),
        ('motivo', 'Motivo'),
        ('comprobante__estado', 'Estado'),
        ('subtotal_sin_impuestos', 'Subtotal'),
        ('total', 'Total'),
        ('comprobante__clave_acceso', 'Clave Acceso'),
    ]

    def _get_empresa(self):
        return _get_empresa_from_request(self.request)

    def get_queryset(self):
        empresa = self._get_empresa()
        if empresa:
            return NotaCredito.objects.select_related(
                'comprobante',
                'factura_origen__comprobante',
                'factura_origen__cliente',
            ).filter(comprobante__empresa=empresa)
        return NotaCredito.objects.none()

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """Consulta al SRI si ya autorizó la Nota de Crédito."""
        from apps.facturacion.services.sri_service import SRIService
        from apps.facturacion.models import ComprobanteElectronico

        nc = self.get_object()
        comp = nc.comprobante

        if comp.estado not in ('ENVIADO', 'RECHAZADO', 'NO_AUTORIZADO'):
            return Response(
                {'error': f'Solo se reprocesa en estado ENVIADO/RECHAZADO. Estado actual: {comp.estado}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if comp.estado in ('RECHAZADO', 'NO_AUTORIZADO'):
            from apps.facturacion.services.nota_credito_service import procesar_nota_credito_sri
            result = procesar_nota_credito_sri(nc)
            http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
            return Response(result, status=http_status)

        sri = SRIService(comp.empresa)

        try:
            aut_obj = None
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut_obj = auth.autorizaciones.autorizacion[0]

            if aut_obj:
                if aut_obj.estado == 'AUTORIZADO':
                    comp.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                    comp.numero_autorizacion = getattr(aut_obj, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion = getattr(aut_obj, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({
                        'estado': comp.estado,
                        'numero_autorizacion': comp.numero_autorizacion,
                        'mensaje': f'Autorizada: {comp.numero_autorizacion}',
                    })

                mensajes_list = []
                if hasattr(aut_obj, 'mensajes') and aut_obj.mensajes:
                    for m in getattr(aut_obj.mensajes, 'mensaje', []):
                        mensajes_list.append(
                            f"[{getattr(m, 'identificador', '')}] "
                            f"{getattr(m, 'mensaje', '')} - "
                            f"{getattr(m, 'informacionAdicional', '')}"
                        )

                comp.estado = ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO
                comp.mensajes_sri = '\n'.join(mensajes_list)
                comp.save()
                return Response(
                    {'estado': comp.estado, 'mensaje': comp.mensajes_sri or 'No autorizado por el SRI'},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            if not comp.xml_firmado:
                return Response({
                    'estado': comp.estado,
                    'mensaje': 'Sin respuesta del SRI y sin XML firmado. Re-envie desde BORRADOR.',
                })

            response = sri.enviar_comprobante_sri(comp)
            mensajes_recep = []
            ya_registrada = False

            if hasattr(response, 'estado') and response.estado == 'RECIBIDA':
                ya_registrada = True
            else:
                raw_msgs = getattr(response, 'comprobantes', None)
                raw_list = getattr(raw_msgs, 'comprobante', []) if raw_msgs else []
                for comp_item in raw_list:
                    for m in getattr(getattr(comp_item, 'mensajes', None), 'mensaje', []):
                        ident = str(getattr(m, 'identificador', ''))
                        mensajes_recep.append(ident)
                        if ident in ('43', '70'):
                            ya_registrada = True

                if not ya_registrada and mensajes_recep:
                    msg_str = ' | '.join(mensajes_recep)
                    ya_registrada = '43' in msg_str or '70' in msg_str

            if not ya_registrada and mensajes_recep:
                comp.estado = ComprobanteElectronico.EstadoChoices.RECHAZADO
                comp.mensajes_sri = ' | '.join(mensajes_recep)
                comp.save(update_fields=['estado', 'mensajes_sri'])
                return Response(
                    {'estado': comp.estado, 'mensaje': comp.mensajes_sri},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut_obj = auth.autorizaciones.autorizacion[0]
                if aut_obj.estado == 'AUTORIZADO':
                    comp.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                    comp.numero_autorizacion = getattr(aut_obj, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion = getattr(aut_obj, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({
                        'estado': comp.estado,
                        'numero_autorizacion': comp.numero_autorizacion,
                        'mensaje': f'Autorizada: {comp.numero_autorizacion}',
                    })

            return Response({
                'estado': comp.estado,
                'mensaje': 'Re-enviado al SRI. Autorizacion aun pendiente; intente reprocesar nuevamente en unos segundos.',
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─── Secuencial ──────────────────────────────────────────────────────────────

class SecuencialViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar secuenciales de comprobantes.
    - SUPER_ADMIN: acceso total.
    - ADMIN_EMPRESA: GET + PATCH (solo si configurado=False).
    """
    serializer_class = SecuencialSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo_comprobante', 'empresa', 'configurado']
    search_fields = ['establecimiento', 'punto_emision']
    ordering_fields = ['tipo_comprobante']
    ordering = ['tipo_comprobante']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def _get_empresa(self):
        return _get_empresa_from_request(self.request)

    def _is_super_admin(self):
        return getattr(self.request.user, 'rol', None) == 'SUPER_ADMIN'

    def get_queryset(self):
        if self._is_super_admin():
            empresa_id = self.request.query_params.get('empresa')
            if empresa_id:
                return Secuencial.objects.filter(empresa_id=empresa_id)
            return Secuencial.objects.select_related('empresa').all()
        empresa = self._get_empresa()
        if empresa:
            return Secuencial.objects.filter(empresa=empresa)
        return Secuencial.objects.none()

    def perform_create(self, serializer):
        if self._is_super_admin():
            serializer.save()
        else:
            empresa = self._get_empresa()
            serializer.save(empresa=empresa)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._is_super_admin() and instance.configurado:
            return Response(
                {'detail': 'El secuencial ya fue configurado. Contacta al SUPER_ADMIN para modificarlo.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        save_kwargs = {}
        if not self._is_super_admin():
            save_kwargs['configurado'] = True
        serializer.save(**save_kwargs)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def inicializar(self, request):
        """
        Crea los 5 registros de secuenciales por defecto para la empresa.
        """
        if self._is_super_admin():
            empresa_id = request.data.get('empresa')
            if not empresa_id:
                return Response({'detail': 'Se requiere el campo empresa.'}, status=status.HTTP_400_BAD_REQUEST)
            from apps.empresas.models import Empresa
            try:
                empresa = Empresa.objects.get(pk=empresa_id)
            except Empresa.DoesNotExist:
                return Response({'detail': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            empresa = self._get_empresa()
            if not empresa:
                return Response({'detail': 'Sin empresa asociada.'}, status=status.HTTP_403_FORBIDDEN)

        establecimiento = getattr(empresa, 'establecimiento_codigo', None) or '001'
        punto_emision = getattr(empresa, 'punto_emision_codigo', None) or '001'

        TIPOS = ['01', '04', '05', '06', '07']
        objs = []
        for tipo in TIPOS:
            obj, _ = Secuencial.objects.get_or_create(
                empresa=empresa,
                tipo_comprobante=tipo,
                establecimiento=establecimiento,
                punto_emision=punto_emision,
                defaults={'secuencial_actual': 0, 'configurado': False},
            )
            objs.append(obj)

        serializer = self.get_serializer(objs, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
