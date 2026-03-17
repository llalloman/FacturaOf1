from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from apps.core.permissions import IsAuthenticated, IsTenantUser
from .models import Cotizacion, ItemCotizacion
from .serializers import CotizacionSerializer, CotizacionCreateSerializer


class CotizacionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para cotizaciones / proformas.

    Extra actions:
      enviar           POST /cotizaciones/{id}/enviar/
      aceptar          POST /cotizaciones/{id}/aceptar/
      rechazar         POST /cotizaciones/{id}/rechazar/
      convertir_factura POST /cotizaciones/{id}/convertir_factura/
    """

    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ['estado', 'cliente']
    search_fields = ['numero', 'cliente__razon_social']
    ordering_fields = ['created_at', 'total', 'fecha_validez']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CotizacionCreateSerializer
        return CotizacionSerializer

    def get_queryset(self):
        return Cotizacion.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('cliente', 'creado_por', 'factura').prefetch_related('items__producto')

    # ── State transitions ────────────────────────────────────────────────────

    def _cambiar_estado(self, request, pk, nuevo_estado, estados_permitidos):
        cotizacion = self.get_object()
        if cotizacion.estado not in estados_permitidos:
            return Response(
                {'detail': f'No se puede cambiar al estado {nuevo_estado} desde {cotizacion.estado}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cotizacion.estado = nuevo_estado
        cotizacion.save(update_fields=['estado'])
        return Response(CotizacionSerializer(cotizacion, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def enviar(self, request, pk=None):
        """Marcar cotización como enviada al cliente y enviar por email."""
        response = self._cambiar_estado(request, pk, 'ENVIADA', ['BORRADOR'])
        if response.status_code == 200:
            cotizacion = self.get_object()
            email_result = _enviar_cotizacion_email(cotizacion)
            response.data['email'] = email_result
        return response

    @action(detail=True, methods=['post'])
    def reenviar_email(self, request, pk=None):
        """Reenvía la cotización por email al cliente sin cambiar estado."""
        cotizacion = self.get_object()
        email_result = _enviar_cotizacion_email(cotizacion)
        if email_result.get('enviado'):
            return Response({'mensaje': f'Email enviado a {cotizacion.cliente.email}', **email_result})
        return Response(email_result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def aceptar(self, request, pk=None):
        """Marcar cotización como aceptada."""
        return self._cambiar_estado(request, pk, 'ACEPTADA', ['ENVIADA', 'BORRADOR'])

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        """Marcar cotización como rechazada."""
        return self._cambiar_estado(request, pk, 'RECHAZADA', ['BORRADOR', 'ENVIADA', 'ACEPTADA'])

    @action(detail=True, methods=['post'])
    def convertir_factura(self, request, pk=None):
        """
        Marca la cotización como FACTURADA.
        La creación de la factura real se hace desde el frontend (pre-llenado).
        Retorna los datos de la cotización para pre-llenar el form de facturación.
        """
        cotizacion = self.get_object()
        if cotizacion.estado not in ('ACEPTADA', 'ENVIADA', 'BORRADOR'):
            return Response(
                {'detail': 'Solo se pueden convertir cotizaciones en estado ACEPTADA, ENVIADA o BORRADOR.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cotizacion.estado == 'FACTURADA':
            return Response({'detail': 'Esta cotización ya fue convertida a factura.'}, status=status.HTTP_400_BAD_REQUEST)

        # Retorna los datos para pre-llenar la factura (sin crearla aquí)
        items = [
            {
                'descripcion': i.descripcion,
                'codigo_principal': i.codigo or '',
                'cantidad': i.cantidad,
                'precio_unitario': i.precio_unitario,
                'descuento': i.descuento,
                'tarifa_iva': i.tarifa_iva,
                'producto_id': i.producto_id,
            }
            for i in cotizacion.items.all()
        ]
        return Response({
            'cotizacion_id': cotizacion.id,
            'cliente_id': cotizacion.cliente_id,
            'cliente_nombre': cotizacion.cliente.razon_social,
            'observaciones': cotizacion.observaciones,
            'items': items,
            'total': cotizacion.total,
            'mensaje': 'Use estos datos para crear la factura. Una vez guardada, marque la cotización como FACTURADA manualmente o llame al endpoint marcar_facturada.',
        })

    @action(detail=True, methods=['post'])
    def marcar_facturada(self, request, pk=None):
        """Marcar cotización como FACTURADA (tras haber creado la factura)."""
        cotizacion = self.get_object()
        cotizacion.estado = Cotizacion.EstadoChoices.FACTURADA
        factura_id = request.data.get('factura_id')
        if factura_id:
            from apps.facturacion.models import Factura
            try:
                cotizacion.factura = Factura.objects.get(id=factura_id, comprobante__empresa=self.request.user.empresa)
            except Factura.DoesNotExist:
                pass
        cotizacion.save(update_fields=['estado', 'factura'])
        return Response({'detail': 'Cotización marcada como FACTURADA.'})

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """KPIs de cotizaciones."""
        from django.db.models import Sum, Count
        empresa = request.user.empresa
        qs = Cotizacion.objects.filter(empresa=empresa)
        return Response({
            'total': qs.count(),
            'por_estado': list(qs.values('estado').annotate(cantidad=Count('id'), valor=Sum('total'))),
            'total_pendiente': qs.filter(estado__in=['BORRADOR', 'ENVIADA', 'ACEPTADA']).aggregate(t=Sum('total'))['t'] or 0,
        })


router = DefaultRouter()
router.register(r'cotizaciones', CotizacionViewSet, basename='cotizacion')

urlpatterns = router.urls


# ─── Helper: envío de email ───────────────────────────────────────────────────

import logging
logger = logging.getLogger(__name__)

def _enviar_cotizacion_email(cotizacion):
    """
    Envía la cotización por email al cliente.
    Retorna dict con 'enviado' (bool) y 'mensaje'.
    No lanza excepción — cualquier error queda en el log y en el mensaje retornado.
    """
    from django.core.mail import EmailMessage
    from django.conf import settings

    cliente = cotizacion.cliente
    destino = getattr(cliente, 'email', None)
    if not destino:
        logger.info("Cliente %s sin email — cotización %s no enviada por correo",
                    cliente.identificacion, cotizacion.numero)
        return {'enviado': False, 'mensaje': 'El cliente no tiene email registrado.'}

    empresa = cotizacion.empresa
    remitente = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@localhost')

    # ── Construir tabla de ítems en texto plano ──────────────────────────────
    lineas_items = []
    for i, item in enumerate(cotizacion.items.all(), 1):
        lineas_items.append(
            f"  {i}. {item.descripcion} — Cant: {item.cantidad} x ${item.precio_unitario:.2f}"
            f" (IVA {item.tarifa_iva}%)"
        )
    tabla_items = "\n".join(lineas_items) if lineas_items else "  Sin ítems."

    validez = (
        f"Válida hasta: {cotizacion.fecha_validez.strftime('%d/%m/%Y')}"
        if cotizacion.fecha_validez else ""
    )

    asunto = f"Cotización N° {cotizacion.numero} — {empresa.razon_social}"
    cuerpo = (
        f"Estimado/a {cliente.razon_social},\n\n"
        f"Nos complace presentarle la siguiente cotización:\n\n"
        f"  N° Cotización : {cotizacion.numero}\n"
        f"  Fecha emisión : {cotizacion.fecha_emision.strftime('%d/%m/%Y')}\n"
        f"  {validez}\n\n"
        f"DETALLE:\n{tabla_items}\n\n"
        f"  Subtotal : ${cotizacion.subtotal:.2f}\n"
        f"  IVA      : ${cotizacion.iva:.2f}\n"
        f"  TOTAL    : ${cotizacion.total:.2f}\n\n"
    )
    if cotizacion.observaciones:
        cuerpo += f"Observaciones:\n{cotizacion.observaciones}\n\n"
    if cotizacion.condiciones:
        cuerpo += f"Condiciones de pago:\n{cotizacion.condiciones}\n\n"

    cuerpo += f"Saludos cordiales,\n{empresa.razon_social}"
    if getattr(empresa, 'telefono', None):
        cuerpo += f"\nTel: {empresa.telefono}"
    if getattr(empresa, 'email', None):
        cuerpo += f"\nEmail: {empresa.email}"

    try:
        email = EmailMessage(
            subject=asunto,
            body=cuerpo,
            from_email=remitente,
            to=[destino],
        )
        email.send(fail_silently=False)
        logger.info("Cotización %s enviada por email a %s", cotizacion.numero, destino)
        return {'enviado': True, 'mensaje': f'Email enviado a {destino}'}
    except Exception as e:
        logger.error("Error enviando cotización %s por email: %s", cotizacion.numero, e)
        return {'enviado': False, 'mensaje': f'No se pudo enviar el email: {e}'}

