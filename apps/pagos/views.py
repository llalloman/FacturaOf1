from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.pagos.models import PagoConfiguracion, PagoOnline
from apps.pagos.serializers import PagoConfiguracionSerializer, PagoOnlineSerializer


class PagoConfiguracionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PagoConfiguracionSerializer

    def _is_super_admin(self):
        user = self.request.user
        return user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'

    def get_queryset(self):
        qs = PagoConfiguracion.objects.select_related(
            'empresa', 'cuenta_payphone', 'caja_ventas', 'usuario_ventas',
        )
        if self._is_super_admin():
            empresa_id = self.request.query_params.get('empresa')
            return qs.filter(empresa_id=empresa_id) if empresa_id else qs
        return qs.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        if self._is_super_admin():
            serializer.save()
            return
        serializer.save(empresa=self.request.user.empresa)

    def perform_update(self, serializer):
        if self._is_super_admin():
            serializer.save()
            return
        serializer.save(empresa=self.request.user.empresa)


class PagoOnlineViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PagoOnlineSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estado', 'provider', 'metodo', 'origen']
    search_fields = ['client_transaction_id', 'provider_transaction_id', 'authorization_code', 'origen_id']
    ordering_fields = ['created_at', 'confirmed_at', 'applied_at', 'total_amount']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = PagoOnline.objects.select_related(
            'empresa', 'venta', 'pago_venta', 'movimiento_bancario', 'pago_suscripcion'
        )
        user = self.request.user
        if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
            empresa_id = self.request.query_params.get('empresa')
            return qs.filter(empresa_id=empresa_id) if empresa_id else qs
        return qs.filter(empresa=user.empresa)


    @action(detail=True, methods=['post'], url_path='reintentar-aplicacion')
    def reintentar_aplicacion(self, request, pk=None):
        pago_online = self.get_object()
        if pago_online.estado != 'APPROVED':
            return Response({'detail': 'Solo se puede reintentar un pago aprobado.'}, status=status.HTTP_400_BAD_REQUEST)
        if pago_online.applied_at and pago_online.venta_id:
            return Response(self.get_serializer(pago_online).data)
        if pago_online.origen == 'FIRMA':
            from apps.firmas.models import FirmaPagoElectronico
            from apps.pagos.services import aplicar_pago_firma_a_ventas

            firma_payment = FirmaPagoElectronico.objects.select_related('request').filter(
                client_transaction_id=pago_online.client_transaction_id,
            ).first()
            if not firma_payment:
                return Response({'detail': 'No se encontró el pago de firma asociado.'}, status=status.HTTP_404_NOT_FOUND)
            try:
                aplicar_pago_firma_a_ventas(pago_online, firma_payment)
            except Exception as exc:
                pago_online.refresh_from_db()
                pago_online.mark_application_error(exc)
                return Response(self.get_serializer(pago_online).data, status=status.HTTP_400_BAD_REQUEST)
            pago_online.refresh_from_db()
            return Response(self.get_serializer(pago_online).data)
        return Response({'detail': 'El reintento automático todavía no está disponible para este origen.'}, status=status.HTTP_400_BAD_REQUEST)
