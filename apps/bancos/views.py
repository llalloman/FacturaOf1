from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from .models import CuentaBancaria, MovimientoBancario, CierreTesoreria
from .serializers import CuentaBancariaSerializer, MovimientoBancarioSerializer, CierreTesoreriaSerializer
from apps.core.permissions import HasModuleAccess, IsCompanyAdminOrPlatform
from apps.core.models import AuditLog
from apps.core.tenant import ActiveCompanyWriteMixin, active_empresa, require_active_empresa, tenant_queryset


class CuentaBancariaViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'bancos'
    serializer_class = CuentaBancariaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activa', 'tipo']
    search_fields = ['numero_cuenta', 'banco', 'descripcion']
    ordering_fields = ['banco', 'numero_cuenta', 'saldo_inicial']
    ordering = ['banco', 'numero_cuenta']

    def get_queryset(self):
        return tenant_queryset(self.request, CuentaBancaria.objects.all())

    def perform_create(self, serializer):
        serializer.save(empresa=require_active_empresa(self.request))

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
        return tenant_queryset(self.request, MovimientoBancario.objects.all(), 'cuenta__empresa').select_related(
            'cuenta',
            'pago_venta__venta',
            'pago_cliente__cuenta',
            'pago_proveedor',
            'pago_nomina__rol__empleado',
        )

    @transaction.atomic
    def perform_create(self, serializer):
        empresa = require_active_empresa(self.request)
        cuenta = serializer.validated_data['cuenta']
        if cuenta.empresa_id != empresa.id:
            raise PermissionDenied('La cuenta no pertenece a la empresa activa.')
        movimiento = serializer.save()
        from apps.core.audit import audit_event
        audit_event(
            empresa=movimiento.cuenta.empresa,
            usuario=self.request.user,
            accion='CREAR_MOVIMIENTO_BANCARIO_MANUAL',
            modulo='bancos',
            referencia=str(movimiento.pk),
            datos={
                'cuenta_id': movimiento.cuenta_id,
                'fecha': movimiento.fecha.isoformat(),
                'tipo': movimiento.tipo,
                'descripcion': movimiento.descripcion,
                'referencia': movimiento.referencia,
                'monto': str(movimiento.monto),
                'conciliado': movimiento.conciliado,
            },
        )

    @transaction.atomic
    def perform_update(self, serializer):
        empresa = require_active_empresa(self.request)
        instance = self.get_object()
        if instance.cuenta.empresa_id != empresa.id:
            raise PermissionDenied('El movimiento no pertenece a la empresa activa.')
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
        empresa = require_active_empresa(self.request)
        if instance.cuenta.empresa_id != empresa.id:
            raise PermissionDenied('El movimiento no pertenece a la empresa activa.')
        if hasattr(instance, 'pago_venta'):
            raise serializers.ValidationError({
                'detail': (
                    'Este movimiento fue generado por una venta. '
                    'Anula la operación de origen para mantener la trazabilidad.'
                )
            })
        if hasattr(instance, 'pago_cliente'):
            raise serializers.ValidationError({
                'detail': (
                    'Este movimiento fue generado por un cobro de cartera. '
                    'Anula o elimina el cobro de origen para mantener la trazabilidad.'
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
        empresa = require_active_empresa(request)
        mov = self.get_object()
        if mov.cuenta.empresa_id != empresa.id:
            raise PermissionDenied('El movimiento no pertenece a la empresa activa.')
        estado_anterior = mov.conciliado
        mov.conciliado = not mov.conciliado
        mov.save()
        from apps.core.audit import audit_event
        audit_event(
            empresa=mov.cuenta.empresa,
            usuario=request.user,
            accion='CONCILIAR_MOVIMIENTO_BANCARIO' if mov.conciliado else 'DESCONCILIAR_MOVIMIENTO_BANCARIO',
            modulo='bancos',
            referencia=str(mov.pk),
            datos={
                'estado_anterior': estado_anterior,
                'estado_nuevo': mov.conciliado,
                'cuenta_id': mov.cuenta_id,
                'tipo': mov.tipo,
                'monto': str(mov.monto),
                'origen': MovimientoBancarioSerializer(mov).data.get('origen'),
            },
        )
        return Response({
            'conciliado': mov.conciliado,
            'detail': 'Conciliado' if mov.conciliado else 'Marcado como no conciliado',
        })

    @action(detail=False, methods=['post'])
    def conciliar_multiples(self, request):
        """Concilia varios movimientos a la vez. Body: {ids: [1,2,...], conciliado: true}"""
        empresa_activa = require_active_empresa(request)
        ids        = request.data.get('ids', [])
        conciliado = request.data.get('conciliado', True)
        movimientos = list(tenant_queryset(
            request,
            MovimientoBancario.objects.filter(pk__in=ids),
            'cuenta__empresa',
        ).values('id', 'conciliado', 'cuenta_id', 'tipo', 'monto'))
        updated = tenant_queryset(
            request,
            MovimientoBancario.objects.filter(pk__in=ids),
            'cuenta__empresa',
        ).update(conciliado=conciliado)
        from apps.core.audit import audit_event
        audit_event(
            empresa=empresa_activa,
            usuario=request.user,
            accion='CONCILIAR_MOVIMIENTOS_BANCARIOS' if conciliado else 'DESCONCILIAR_MOVIMIENTOS_BANCARIOS',
            modulo='bancos',
            referencia=f'lote:{updated}',
            datos={
                'ids': ids,
                'actualizados': updated,
                'conciliado': conciliado,
                'movimientos_antes': [
                    {
                        **mov,
                        'monto': str(mov['monto']),
                    }
                    for mov in movimientos
                ],
            },
        )
        return Response({'actualizados': updated})

    @action(detail=False, methods=['get'])
    def extracto(self, request):
        """Extracto con saldo acumulado para una cuenta."""
        cuenta_id = request.query_params.get('cuenta')
        if not cuenta_id:
            return Response({'detail': 'Se requiere cuenta.'}, status=400)
        try:
            cuenta = tenant_queryset(
                request, CuentaBancaria.objects.filter(pk=cuenta_id)
            ).get()
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


class CierreTesoreriaViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'bancos'
    serializer_class = CierreTesoreriaSerializer
    filterset_fields = ['fecha', 'estado']
    ordering = ['-fecha']

    def _empresa(self):
        return active_empresa(self.request)

    def get_queryset(self):
        return CierreTesoreria.objects.filter(empresa=self._empresa()).select_related('creado_por', 'cerrado_por')

    def get_permissions(self):
        # Consultar cierres es una capacidad de tesorería; crear/cerrar cambia
        # evidencia financiera y requiere administración del contexto activo.
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'cerrar'):
            return [IsAuthenticated(), HasModuleAccess(), IsCompanyAdminOrPlatform()]
        return [IsAuthenticated(), HasModuleAccess()]

    @transaction.atomic
    def perform_create(self, serializer):
        empresa = require_active_empresa(self.request)
        fecha = serializer.validated_data['fecha']
        cuentas = CuentaBancaria.objects.filter(empresa=empresa, activa=True)
        snapshot = {str(cuenta.id): {
            'cuenta': cuenta.numero_cuenta,
            'tipo': cuenta.tipo,
            'saldo_disponible': str(cuenta.saldo_disponible),
            'saldo_conciliado': str(cuenta.saldo_actual),
        } for cuenta in cuentas}
        serializer.save(empresa=empresa, creado_por=self.request.user, saldos_teoricos=snapshot)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cerrar(self, request, pk=None):
        cierre = CierreTesoreria.objects.select_for_update().filter(
            pk=pk,
            empresa=self._empresa(),
        ).first()
        if not cierre:
            return Response({'detail': 'Cierre no encontrado para la empresa activa.'}, status=status.HTTP_404_NOT_FOUND)
        if cierre.estado == CierreTesoreria.EstadoChoices.CERRADO:
            return Response({'detail': 'El cierre ya está cerrado.'}, status=status.HTTP_400_BAD_REQUEST)
        declarados = request.data.get('saldos_declarados') or {}
        esperados = set(cierre.saldos_teoricos.keys())
        recibidos = set(str(key) for key in declarados.keys())
        faltantes = sorted(esperados - recibidos)
        desconocidos = sorted(recibidos - esperados)
        if faltantes or desconocidos:
            return Response({
                'detail': 'Debe declarar un saldo para cada cuenta incluida en el snapshot.',
                'faltantes': faltantes,
                'desconocidos': desconocidos,
            }, status=status.HTTP_400_BAD_REQUEST)
        diferencia = Decimal('0.00')
        try:
            for cuenta_id, saldo in declarados.items():
                declarado = Decimal(str(saldo))
                if declarado < 0:
                    raise ValueError('negative')
                teorico = Decimal(str(cierre.saldos_teoricos.get(str(cuenta_id), {}).get('saldo_disponible', '0')))
                diferencia += declarado - teorico
        except (ValueError, TypeError, ArithmeticError):
            return Response({'detail': 'Todos los saldos declarados deben ser números no negativos.'}, status=status.HTTP_400_BAD_REQUEST)
        cierre.saldos_declarados = declarados
        cierre.diferencia_total = diferencia
        cierre.estado = CierreTesoreria.EstadoChoices.CERRADO
        cierre.cerrado_por = request.user
        cierre.fecha_cierre = timezone.now()
        cierre.save(update_fields=['saldos_declarados', 'diferencia_total', 'estado', 'cerrado_por', 'fecha_cierre', 'updated_at'])
        from apps.core.audit import audit_event
        audit_event(
            empresa=cierre.empresa,
            usuario=request.user,
            accion='CERRAR_TESORERIA',
            modulo='bancos',
            referencia=str(cierre.pk),
            datos={
                'fecha': cierre.fecha.isoformat(),
                'diferencia_total': str(cierre.diferencia_total),
                'saldos_declarados': declarados,
                'saldos_teoricos': cierre.saldos_teoricos,
            },
        )
        return Response(self.get_serializer(cierre).data)
