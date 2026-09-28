from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import HasModuleAccess, IsCompanyAdminOrPlatform, is_global_platform_user, is_platform_user
from apps.core.tenant import active_empresa, require_active_empresa, tenant_queryset

from apps.pagos.models import PagoConfiguracion, PagoOnline
from apps.pagos.serializers import PagoConfiguracionSerializer, PagoOnlineSerializer


class PagoConfiguracionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess, IsCompanyAdminOrPlatform]
    module_required = 'facturacion'
    serializer_class = PagoConfiguracionSerializer

    def _is_super_admin(self):
        user = self.request.user
        return is_platform_user(user, 'pagos')

    def get_queryset(self):
        qs = PagoConfiguracion.objects.select_related(
            'empresa', 'cuenta_payphone', 'caja_ventas', 'usuario_ventas',
            'establecimiento_fiscal', 'punto_emision_fiscal',
        )
        if self._is_super_admin():
            if getattr(self.request, 'tenant', None):
                return qs.filter(empresa=self.request.tenant).order_by("empresa__razon_social", "id")
            if not is_global_platform_user(self.request.user):
                return qs.none()
            empresa_id = self.request.query_params.get('empresa')
            return (qs.filter(empresa_id=empresa_id) if empresa_id else qs).order_by("empresa__razon_social", "id")
        return tenant_queryset(self.request, qs).order_by("empresa__razon_social", "id")

    def create(self, request, *args, **kwargs):
        if (
            self._is_super_admin()
            and not getattr(request, 'tenant', None)
            and not is_global_platform_user(request.user)
        ):
            return Response({'empresa': ['Seleccione una empresa activa.']}, status=status.HTTP_400_BAD_REQUEST)
        if self._is_super_admin() and not getattr(request, 'tenant', None) and not request.data.get('empresa'):
            return Response({'empresa': ['Este campo es requerido.']}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if self._is_super_admin() and getattr(self.request, 'tenant', None):
            serializer.save(empresa=self.request.tenant)
            return
        if self._is_super_admin() and is_global_platform_user(self.request.user):
            serializer.save()
            return
        serializer.save(empresa=require_active_empresa(self.request))

    def perform_update(self, serializer):
        if self._is_super_admin() and getattr(self.request, 'tenant', None):
            serializer.save(empresa=self.request.tenant)
            return
        if self._is_super_admin() and is_global_platform_user(self.request.user):
            serializer.save()
            return
        serializer.save(empresa=require_active_empresa(self.request))


class PagoOnlineViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'facturacion'
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
        if is_platform_user(user, 'pagos'):
            if getattr(self.request, 'tenant', None):
                return qs.filter(empresa=self.request.tenant)
            if not is_global_platform_user(user):
                return qs.none()
            empresa_id = self.request.query_params.get('empresa')
            return qs.filter(empresa_id=empresa_id) if empresa_id else qs
        return tenant_queryset(self.request, qs)


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
