from rest_framework import serializers
from .models import CuentaPorCobrar, PagoCliente, MovimientoCuentaPorCobrar
from apps.core.tenant import active_empresa, require_active_empresa


class PagoClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PagoCliente
        fields = [
            'id', 'cuenta', 'fecha_pago', 'monto',
            'forma_pago', 'cuenta_bancaria', 'movimiento_bancario',
            'referencia', 'notas', 'created_at',
        ]
        read_only_fields = ['movimiento_bancario', 'created_at']

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero.')
        return value

    def validate(self, data):
        cuenta = data.get('cuenta') or getattr(self.instance, 'cuenta', None)
        monto = data.get('monto', 0)
        cuenta_bancaria = data.get('cuenta_bancaria')
        if cuenta and monto > cuenta.saldo:
            raise serializers.ValidationError(
                f'El monto ({monto}) supera el saldo pendiente ({cuenta.saldo}).'
            )
        if cuenta_bancaria and cuenta and cuenta_bancaria.empresa_id != cuenta.empresa_id:
            raise serializers.ValidationError({'cuenta_bancaria': 'La cuenta bancaria no pertenece a la empresa de la cuenta por cobrar.'})
        if cuenta_bancaria and not cuenta_bancaria.activa:
            raise serializers.ValidationError({'cuenta_bancaria': 'La cuenta bancaria seleccionada esta inactiva.'})
        return data

    def create(self, validated_data):
        pago = super().create(validated_data)
        from apps.cartera.finance import registrar_movimiento_bancario_pago_cliente
        movimiento = registrar_movimiento_bancario_pago_cliente(pago)

        request = self.context.get('request')
        from apps.core.audit import audit_event
        audit_event(
            empresa=pago.cuenta.empresa,
            usuario=getattr(request, 'user', None),
            accion='REGISTRAR_COBRO_CARTERA',
            modulo='cartera',
            referencia=pago.cuenta.numero_cuenta or str(pago.cuenta_id),
            datos={
                'pago_id': pago.id,
                'cuenta_por_cobrar_id': pago.cuenta_id,
                'monto': str(pago.monto),
                'forma_pago': pago.forma_pago,
                'cuenta_bancaria_id': pago.cuenta_bancaria_id,
                'movimiento_bancario_id': movimiento.id if movimiento else None,
                'saldo_actual': str(pago.cuenta.saldo),
            },
        )
        return pago


class MovimientoCuentaPorCobrarSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoCuentaPorCobrar
        fields = [
            'id', 'cuenta', 'fecha_movimiento', 'tipo_movimiento',
            'motivo', 'monto', 'concepto', 'referencia', 'notas', 'created_at',
        ]
        read_only_fields = ['created_at']


class CuentaPorCobrarSerializer(serializers.ModelSerializer):
    pagos = PagoClienteSerializer(many=True, read_only=True)
    movimientos = MovimientoCuentaPorCobrarSerializer(many=True, read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    factura_numero = serializers.SerializerMethodField()
    dias_vencimiento = serializers.SerializerMethodField()
    bucket_aging = serializers.SerializerMethodField()
    total_pagado = serializers.SerializerMethodField()

    class Meta:
        model = CuentaPorCobrar
        fields = [
            'id', 'empresa', 'cliente', 'cliente_nombre',
            'factura', 'factura_numero',
            'numero_cuenta', 'fecha_emision', 'fecha_vencimiento',
            'monto_total', 'saldo', 'total_pagado', 'estado',
            'dias_vencimiento', 'bucket_aging',
            'notas', 'created_at', 'pagos', 'movimientos',
        ]
        read_only_fields = ['empresa', 'saldo', 'estado', 'created_at']

    def get_cliente_nombre(self, obj):
        return obj.cliente.razon_social

    def get_factura_numero(self, obj):
        return obj.factura.numero_factura if obj.factura else None

    def get_dias_vencimiento(self, obj):
        return obj.dias_vencimiento

    def get_bucket_aging(self, obj):
        return obj.bucket_aging

    def get_total_pagado(self, obj):
        from django.db.models import Sum
        total = obj.pagos.aggregate(total=Sum('monto'))['total']
        return total or 0


class CuentaPorCobrarCreateSerializer(serializers.ModelSerializer):
    """Serializer simplificado para creación manual de CxC."""

    class Meta:
        model = CuentaPorCobrar
        fields = [
            'cliente', 'factura',
            'numero_cuenta', 'fecha_emision', 'fecha_vencimiento',
            'monto_total', 'notas',
        ]

    def validate_monto_total(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero.')
        return value

    def validate(self, data):
        factura = data.get('factura')
        request = self.context.get('request')
        empresa = active_empresa(request) if request else None
        cliente = data.get('cliente')
        if empresa and cliente and cliente.empresa_id != empresa.id:
            raise serializers.ValidationError({'cliente': 'El cliente no pertenece a la empresa activa.'})
        if factura:
            if empresa and factura.empresa != empresa:
                raise serializers.ValidationError(
                    {'factura': 'La factura no pertenece a su empresa.'}
                )
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        empresa = require_active_empresa(request) if request else None
        validated_data['empresa'] = empresa
        validated_data['saldo'] = validated_data['monto_total']
        cuenta = super().create(validated_data)
        from apps.core.audit import audit_event
        audit_event(
            empresa=empresa,
            usuario=getattr(request, 'user', None),
            accion='CREAR_CUENTA_POR_COBRAR',
            modulo='cartera',
            referencia=cuenta.numero_cuenta or str(cuenta.id),
            datos={
                'cuenta_por_cobrar_id': cuenta.id,
                'cliente_id': cuenta.cliente_id,
                'factura_id': cuenta.factura_id,
                'monto_total': str(cuenta.monto_total),
                'saldo': str(cuenta.saldo),
                'fecha_emision': cuenta.fecha_emision.isoformat(),
                'fecha_vencimiento': cuenta.fecha_vencimiento.isoformat(),
            },
        )
        return cuenta
