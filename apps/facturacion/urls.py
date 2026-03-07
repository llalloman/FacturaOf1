from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Factura, DetalleFactura, Retencion, GuiaRemision, NotaDebito
from .serializers import FacturaSerializer, DetalleFacturaSerializer, RetencionSerializer, GuiaRemisionSerializer, NotaDebitoSerializer


class FacturaFilter(django_filters.FilterSet):
    estado = django_filters.CharFilter(field_name='comprobante__estado', lookup_expr='iexact')
    cliente = django_filters.NumberFilter(field_name='cliente__id')

    class Meta:
        model = Factura
        fields = ['cliente']


class FacturaViewSet(viewsets.ModelViewSet):
    serializer_class = FacturaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FacturaFilter
    search_fields = ['comprobante__numero_comprobante', 'cliente__razon_social']
    ordering_fields = ['comprobante__fecha_emision', 'total']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        """Obtiene la empresa del tenant o del usuario autenticado."""
        empresa = getattr(self.request, 'tenant', None)
        if not empresa and self.request.user.is_authenticated:
            empresa = getattr(self.request.user, 'empresa', None)
        return empresa

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
            # Generar Nota de Crédito por el total y enviarla al SRI
            motivo = (request.data.get('motivo') or 'Anulación de factura')[:300]
            from apps.facturacion.services.nota_credito_service import (
                crear_nota_credito_desde_factura, procesar_nota_credito_sri,
            )
            try:
                nota_credito = crear_nota_credito_desde_factura(factura, motivo=motivo)
                nc_result    = procesar_nota_credito_sri(nota_credito)
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

            # Solo marcamos la factura ANULADA si el SRI aceptó la NC
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
                # NC rechazada — la factura permanece AUTORIZADO
                return Response(
                    {
                        'error': f'La Nota de Crédito fue rechazada por el SRI. La factura no fue anulada.',
                        'nota_credito': nc_info,
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

        # Para BORRADOR / FIRMADO / ENVIADO / RECHAZADO / NO_AUTORIZADO:
        # el comprobante nunca fue aceptado → anulación local.
        comp.estado = 'ANULADO'
        comp.save(update_fields=['estado'])
        _desvincular_venta(factura)
        return Response({
            'mensaje': 'Factura anulada. El comprobante no había sido autorizado por el SRI.',
            'estado': 'ANULADO',
        })

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """Consulta nuevamente la autorización del SRI para comprobantes en estado ENVIADO."""
        factura = self.get_object()
        comp = factura.comprobante
        if comp.estado != 'ENVIADO':
            return Response(
                {'error': f'Solo se reprocesa desde estado ENVIADO. Estado actual: {comp.estado}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.facturacion.services.sri_service import SRIService
        sri = SRIService(comp.empresa)
        try:
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut = auth.autorizaciones.autorizacion[0]
                if aut.estado == 'AUTORIZADO':
                    comp.estado = 'AUTORIZADO'
                    comp.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion  = getattr(aut, 'fechaAutorizacion', None)
                    comp.save()
                    return Response({
                        'estado': comp.estado,
                        'numero_autorizacion': comp.numero_autorizacion,
                    })
                else:
                    comp.estado = 'NO_AUTORIZADO'
                    comp.save()
                    return Response({'estado': comp.estado}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            return Response({'estado': comp.estado, 'mensaje': 'Sin respuesta del SRI — sigue en ENVIADO'})
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


class RetencionViewSet(viewsets.ModelViewSet):
    serializer_class = RetencionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['comprobante__numero_comprobante', 'proveedor__razon_social']
    ordering_fields = ['comprobante__fecha_emision']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        empresa = getattr(self.request, 'tenant', None)
        if not empresa and self.request.user.is_authenticated:
            empresa = getattr(self.request.user, 'empresa', None)
        return empresa

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
                    comp.fecha_autorizacion  = getattr(aut, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({'estado': comp.estado, 'numero_autorizacion': comp.numero_autorizacion})
            return Response({'estado': comp.estado, 'mensaje': 'Sin autorizaciones aún'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GuiaRemisionViewSet(viewsets.ModelViewSet):
    serializer_class = GuiaRemisionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['comprobante__numero_comprobante', 'razon_social_transportista', 'placa']
    ordering_fields = ['comprobante__fecha_emision']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        empresa = getattr(self.request, 'tenant', None)
        if not empresa and self.request.user.is_authenticated:
            empresa = getattr(self.request.user, 'empresa', None)
        return empresa

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
                    comp.fecha_autorizacion  = getattr(aut, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({'estado': comp.estado, 'numero_autorizacion': comp.numero_autorizacion})
            return Response({'estado': comp.estado, 'mensaje': 'Sin autorizaciones aún'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NotaDebitoViewSet(viewsets.ModelViewSet):
    serializer_class = NotaDebitoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['comprobante__numero_comprobante', 'cliente__razon_social', 'motivo']
    ordering_fields = ['comprobante__fecha_emision']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        empresa = getattr(self.request, 'tenant', None)
        if not empresa and self.request.user.is_authenticated:
            empresa = getattr(self.request.user, 'empresa', None)
        return empresa

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
                    comp.fecha_autorizacion  = getattr(aut, 'fechaAutorizacion', None)
                    comp.mensajes_sri = ''
                    comp.save()
                    return Response({'estado': comp.estado, 'numero_autorizacion': comp.numero_autorizacion})
            return Response({'estado': comp.estado, 'mensaje': 'Sin autorizaciones aún'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


router = DefaultRouter()
router.register(r'facturas', FacturaViewSet, basename='factura')
router.register(r'retenciones', RetencionViewSet, basename='retencion')
router.register(r'guias-remision', GuiaRemisionViewSet, basename='guia-remision')
router.register(r'notas-debito', NotaDebitoViewSet, basename='nota-debito')

urlpatterns = [
    path('', include(router.urls)),
]
