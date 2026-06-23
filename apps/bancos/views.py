from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import CuentaBancaria, MovimientoBancario
from .serializers import CuentaBancariaSerializer, MovimientoBancarioSerializer
from apps.core.permissions import HasModuleAccess
from apps.core.models import AuditLog


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
        ).select_related(
            'cuenta',
            'pago_venta__venta',
            'pago_proveedor',
            'pago_nomina__rol__empleado',
        )


    @transaction.atomic
    def perform_update(self, serializer):
        instance = self.get_object()
        campos_sensibles = {'cuenta', 'tipo', 'monto'}
        if instance.conciliado and campos_sensibles.intersection(serializer.validated_data.keys()):
            raise serializers.ValidationError({
                'detail': 'No se puede cambiar cuenta, tipo o monto de un movimiento conciliado. Desconcílialo primero.'
            })

        antes = {
            'cuenta_id': instance.cuenta_id,
            'fecha': instance.fecha.isoformat(),
            'tipo': instance.tipo,
            'descripcion': instance.descripcion,
            'referencia': instance.referencia,
            'monto': str(instance.monto),
            'conciliado': instance.conciliado,
            'beneficiario': instance.beneficiario,
            'notas': instance.notas,
        }
        updated = serializer.save()
        despues = {
            'cuenta_id': updated.cuenta_id,
            'fecha': updated.fecha.isoformat(),
            'tipo': updated.tipo,
            'descripcion': updated.descripcion,
            'referencia': updated.referencia,
            'monto': str(updated.monto),
            'conciliado': updated.conciliado,
            'beneficiario': updated.beneficiario,
            'notas': updated.notas,
        }
        AuditLog.objects.create(
            empresa=updated.cuenta.empresa,
            usuario=self.request.user,
            accion='EDITAR_MOVIMIENTO_BANCARIO',
            modulo='bancos',
            referencia=str(updated.pk),
            datos={'antes': antes, 'despues': despues},
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        if hasattr(instance, 'pago_venta'):
            raise serializers.ValidationError({
                'detail': (
                    'Este movimiento fue generado por una venta. '
                    'Anula la operación de origen para mantener la trazabilidad.'
                )
            })
        if hasattr(instance, 'pago_proveedor'):
            raise serializers.ValidationError({
                'detail': (
                    'Este movimiento fue generado por un pago a proveedor. '
                    'Anula o elimina el pago de origen para mantener la trazabilidad.'
                )
            })
        if hasattr(instance, 'pago_nomina'):
            raise serializers.ValidationError({
                'detail': (
                    'Este movimiento fue generado por un pago de nómina. '
                    'Anula o revisa el rol de pago de origen para mantener la trazabilidad.'
                )
            })

        AuditLog.objects.create(
            empresa=instance.cuenta.empresa,
            usuario=self.request.user,
            accion='ELIMINAR_MOVIMIENTO_BANCARIO',
            modulo='bancos',
            referencia=str(instance.pk),
            datos={
                'cuenta_id': instance.cuenta_id,
                'cuenta': str(instance.cuenta),
                'fecha': instance.fecha.isoformat(),
                'tipo': instance.tipo,
                'descripcion': instance.descripcion,
                'referencia': instance.referencia,
                'monto': str(instance.monto),
                'conciliado': instance.conciliado,
            },
        )
        instance.delete()

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
            movimiento_data = MovimientoBancarioSerializer(m).data
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
                'notas':        m.notas,
                'entrada':      float(m.monto) if m.tipo in ENTRADAS else 0,
                'salida':       float(m.monto) if m.tipo not in ENTRADAS else 0,
                'saldo':        float(saldo),
                'conciliado':   m.conciliado,
                'origen':       movimiento_data['origen'],
                'origen_referencia': movimiento_data['origen_referencia'],
                'eliminable':   movimiento_data['eliminable'],
            })
        return Response({
            'cuenta': CuentaBancariaSerializer(cuenta).data,
            'saldo_inicial': float(cuenta.saldo_inicial),
            'movimientos': rows,
        })
