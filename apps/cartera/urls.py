from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from apps.core.permissions import IsAuthenticated, IsTenantUser
from .models import CuentaPorCobrar, PagoCliente
from .serializers import (
    CuentaPorCobrarSerializer,
    CuentaPorCobrarCreateSerializer,
    PagoClienteSerializer,
)


class CuentaPorCobrarViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de Cuentas por Cobrar.

    list   → GET  /api/cartera/cuentas/
    create → POST /api/cartera/cuentas/
    ...
    aging  → GET  /api/cartera/cuentas/aging/
    resumen → GET /api/cartera/cuentas/resumen/
    """

    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ['estado', 'cliente']
    search_fields = ['numero_cuenta', 'cliente__razon_social', 'cliente__identificacion']
    ordering_fields = ['fecha_vencimiento', 'monto_total', 'saldo', 'created_at']
    ordering = ['fecha_vencimiento']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CuentaPorCobrarCreateSerializer
        return CuentaPorCobrarSerializer

    def get_queryset(self):
        return CuentaPorCobrar.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('cliente', 'factura').prefetch_related('pagos')

    @action(detail=False, methods=['get'])
    def aging(self, request):
        """
        Retorna el análisis de vencimiento (aging) agrupado por bucket.
        """
        hoy = timezone.now().date()
        empresa = request.user.empresa

        qs = CuentaPorCobrar.objects.filter(
            empresa=empresa,
            estado__in=[
                CuentaPorCobrar.EstadoChoices.PENDIENTE,
                CuentaPorCobrar.EstadoChoices.PARCIAL,
                CuentaPorCobrar.EstadoChoices.VENCIDA,
            ],
        ).select_related('cliente')

        buckets = {
            'vigente': {'label': 'Vigente',    'cuentas': [], 'total': Decimal('0.00')},
            '1-30':    {'label': '1-30 días',  'cuentas': [], 'total': Decimal('0.00')},
            '31-60':   {'label': '31-60 días', 'cuentas': [], 'total': Decimal('0.00')},
            '61-90':   {'label': '61-90 días', 'cuentas': [], 'total': Decimal('0.00')},
            '+90':     {'label': '+90 días',   'cuentas': [], 'total': Decimal('0.00')},
        }

        for cuenta in qs:
            b = cuenta.bucket_aging
            buckets[b]['cuentas'].append({
                'id': cuenta.id,
                'numero_cuenta': cuenta.numero_cuenta,
                'cliente': cuenta.cliente.razon_social,
                'fecha_vencimiento': cuenta.fecha_vencimiento,
                'saldo': cuenta.saldo,
                'dias_vencimiento': cuenta.dias_vencimiento,
            })
            buckets[b]['total'] += cuenta.saldo

        # Build response list
        result = []
        for key, data in buckets.items():
            result.append({
                'bucket': key,
                'label': data['label'],
                'cantidad': len(data['cuentas']),
                'total': data['total'],
                'cuentas': data['cuentas'],
            })

        return Response(result)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """
        KPIs rápidos de cartera para el dashboard.
        """
        empresa = request.user.empresa
        hoy = timezone.now().date()
        mes_actual = hoy.replace(day=1)

        qs = CuentaPorCobrar.objects.filter(empresa=empresa)

        pendientes = qs.filter(estado__in=[
            CuentaPorCobrar.EstadoChoices.PENDIENTE,
            CuentaPorCobrar.EstadoChoices.PARCIAL,
            CuentaPorCobrar.EstadoChoices.VENCIDA,
        ])

        vencidas = qs.filter(
            estado__in=[
                CuentaPorCobrar.EstadoChoices.PENDIENTE,
                CuentaPorCobrar.EstadoChoices.PARCIAL,
            ],
            fecha_vencimiento__lt=hoy,
        )

        cobrado_mes = PagoCliente.objects.filter(
            cuenta__empresa=empresa,
            fecha_pago__gte=mes_actual,
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')

        return Response({
            'total_por_cobrar': pendientes.aggregate(t=Sum('saldo'))['t'] or 0,
            'cuentas_pendientes': pendientes.count(),
            'total_vencido': vencidas.aggregate(t=Sum('saldo'))['t'] or 0,
            'cuentas_vencidas': vencidas.count(),
            'cobrado_mes': cobrado_mes,
            'total_incobrable': qs.filter(
                estado=CuentaPorCobrar.EstadoChoices.INCOBRABLE
            ).aggregate(t=Sum('monto_total'))['t'] or 0,
        })

    @action(detail=True, methods=['post'])
    def marcar_incobrable(self, request, pk=None):
        """Marcar una cuenta como incobrable."""
        cuenta = self.get_object()
        if cuenta.estado == CuentaPorCobrar.EstadoChoices.PAGADO:
            return Response(
                {'detail': 'No se puede marcar como incobrable una cuenta ya pagada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cuenta.estado = CuentaPorCobrar.EstadoChoices.INCOBRABLE
        cuenta.save(update_fields=['estado'])
        return Response({'detail': 'Cuenta marcada como incobrable.'})


class PagoClienteViewSet(viewsets.ModelViewSet):
    """
    ViewSet para registrar/listar pagos de clientes.

    create → POST /api/cartera/pagos/
    list   → GET  /api/cartera/pagos/?cuenta=<id>
    """

    serializer_class = PagoClienteSerializer
    permission_classes = [IsAuthenticated, IsTenantUser]
    filterset_fields = ['cuenta', 'forma_pago', 'fecha_pago']
    ordering = ['-fecha_pago']

    def get_queryset(self):
        return PagoCliente.objects.filter(
            cuenta__empresa=self.request.user.empresa
        ).select_related('cuenta__cliente')


router = DefaultRouter()
router.register(r'cuentas', CuentaPorCobrarViewSet, basename='cuenta-cobrar')
router.register(r'pagos',   PagoClienteViewSet,      basename='pago-cliente')

urlpatterns = router.urls
