from rest_framework import serializers
from .models import CuentaBancaria, MovimientoBancario


class CuentaBancariaSerializer(serializers.ModelSerializer):
    saldo_actual     = serializers.SerializerMethodField()
    saldo_disponible = serializers.SerializerMethodField()

    class Meta:
        model = CuentaBancaria
        fields = [
            'id', 'banco', 'numero_cuenta', 'tipo', 'moneda',
            'saldo_inicial', 'activa', 'descripcion',
            'saldo_actual', 'saldo_disponible',
        ]

    def get_saldo_actual(self, obj):
        return float(obj.saldo_actual)

    def get_saldo_disponible(self, obj):
        return float(obj.saldo_disponible)


class MovimientoBancarioSerializer(serializers.ModelSerializer):
    cuenta_label = serializers.SerializerMethodField()
    es_entrada   = serializers.BooleanField(read_only=True)
    origen = serializers.SerializerMethodField()
    origen_referencia = serializers.SerializerMethodField()
    eliminable = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoBancario
        fields = [
            'id', 'cuenta', 'cuenta_label', 'fecha', 'tipo',
            'descripcion', 'referencia', 'monto', 'conciliado',
            'beneficiario', 'notas', 'created_at', 'es_entrada',
            'origen', 'origen_referencia', 'eliminable',
        ]


    def validate_cuenta(self, cuenta):
        request = self.context.get('request')
        if request and not request.user.is_superuser and getattr(request.user, 'empresa_id', None):
            if cuenta.empresa_id != request.user.empresa_id:
                raise serializers.ValidationError('La cuenta no pertenece a tu empresa.')
        return cuenta

    def validate_monto(self, monto):
        if monto <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero.')
        return monto

    def get_cuenta_label(self, obj):
        return str(obj.cuenta)

    def get_origen(self, obj):
        if hasattr(obj, 'pago_venta'):
            return 'VENTA'
        if hasattr(obj, 'pago_proveedor'):
            return 'PAGO_PROVEEDOR'
        if hasattr(obj, 'pago_nomina'):
            return 'NOMINA'
        return 'MANUAL'

    def get_origen_referencia(self, obj):
        if hasattr(obj, 'pago_venta'):
            return obj.pago_venta.venta.numero_venta
        if hasattr(obj, 'pago_proveedor'):
            return obj.pago_proveedor.numero_pago
        if hasattr(obj, 'pago_nomina'):
            rol = obj.pago_nomina.rol
            return f'Rol {rol.mes}/{rol.anio} - {rol.empleado.nombre_completo}'
        return ''

    def get_eliminable(self, obj):
        return self.get_origen(obj) == 'MANUAL'
