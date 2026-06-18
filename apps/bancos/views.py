from decimal import Decimal
from django.db.models import Sum, Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import CuentaBancaria, MovimientoBancario
from .serializers import CuentaBancariaSerializer, MovimientoBancarioSerializer
from apps.core.permissions import HasModuleAccess


class CuentaBancariaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'bancos'
    serializer_class = CuentaBancariaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activa', 'tipo']
    search_fields = ['numero_cuenta', 'banco', 'descripcion']
    ordering_fields = ['banco', 'numero_cuenta', 'saldo_inicial']
    ordering = ['banco', 'numero_cuenta']

    def get_queryset(self):
        return CuentaBancaria.objects.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Saldo total de todas las cuentas activas."""
        cuentas = list(self.get_queryset())
        cuentas_activas = [cuenta for cuenta in cuentas if cuenta.activa]
        total_disponible = sum(c.saldo_disponible for c in cuentas_activas)
        total_conciliado = sum(c.saldo_actual for c in cuentas_activas)
        return Response({
            'total_disponible': float(total_disponible),
            'total_conciliado': float(total_conciliado),
            'cuentas': CuentaBancariaSerializer(cuentas, many=True).data,
        })


class MovimientoBancarioViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'bancos'
    serializer_class = MovimientoBancarioSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {'cuenta': ['exact'], 'tipo': ['exact'], 'conciliado': ['exact'], 'fecha': ['exact', 'gte', 'lte', 'year', 'month']}
    search_fields = ['descripcion', 'referencia', 'beneficiario']
    ordering_fields = ['fecha', 'monto']
    ordering = ['-fecha']

    def get_queryset(self):
        return MovimientoBancario.objects.filter(
            cuenta__empresa=self.request.user.empresa
        ).select_related('cuenta')

    @action(detail=True, methods=['post'])
    def conciliar(self, request, pk=None):
        mov = self.get_object()
        mov.conciliado = not mov.conciliado
        mov.save()
        return Response({
            'conciliado': mov.conciliado,
            'detail': 'Conciliado' if mov.conciliado else 'Marcado como no conciliado',
        })

    @action(detail=False, methods=['post'])
    def conciliar_multiples(self, request):
        """Concilia varios movimientos a la vez. Body: {ids: [1,2,...], conciliado: true}"""
        ids        = request.data.get('ids', [])
        conciliado = request.data.get('conciliado', True)
        updated = MovimientoBancario.objects.filter(
            pk__in=ids,
            cuenta__empresa=request.user.empresa,
        ).update(conciliado=conciliado)
        return Response({'actualizados': updated})

    @action(detail=False, methods=['get'])
    def extracto(self, request):
        """Extracto con saldo acumulado para una cuenta."""
        cuenta_id = request.query_params.get('cuenta')
        if not cuenta_id:
            return Response({'detail': 'Se requiere cuenta.'}, status=400)
        try:
            cuenta = CuentaBancaria.objects.get(pk=cuenta_id, empresa=request.user.empresa)
        except CuentaBancaria.DoesNotExist:
            return Response({'detail': 'Cuenta no encontrada.'}, status=404)

        movs = self.get_queryset().filter(cuenta=cuenta).order_by('fecha', 'id')
        saldo = cuenta.saldo_inicial
        rows = []
        ENTRADAS = {'DEPOSITO', 'TRANSFERENCIA_ENTRADA', 'NOTA_CREDITO'}
        for m in movs:
            if m.tipo in ENTRADAS:
                saldo += m.monto
            else:
                saldo -= m.monto
            rows.append({
                'id':           m.id,
                'fecha':        m.fecha,
                'tipo':         m.tipo,
                'descripcion':  m.descripcion,
                'referencia':   m.referencia,
                'beneficiario': m.beneficiario,
                'entrada':      float(m.monto) if m.tipo in ENTRADAS else 0,
                'salida':       float(m.monto) if m.tipo not in ENTRADAS else 0,
                'saldo':        float(saldo),
                'conciliado':   m.conciliado,
            })
        return Response({
            'cuenta': CuentaBancariaSerializer(cuenta).data,
            'saldo_inicial': float(cuenta.saldo_inicial),
            'movimientos': rows,
        })
