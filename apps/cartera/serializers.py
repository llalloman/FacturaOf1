from rest_framework import serializers
from .models import CuentaPorCobrar, PagoCliente


class PagoClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PagoCliente
        fields = [
            'id', 'cuenta', 'fecha_pago', 'monto',
            'forma_pago', 'referencia', 'notas', 'created_at',
        ]
        read_only_fields = ['created_at']

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero.')
        return value

    def validate(self, data):
        cuenta = data.get('cuenta') or getattr(self.instance, 'cuenta', None)
        monto = data.get('monto', 0)
        if cuenta and monto > cuenta.saldo:
            raise serializers.ValidationError(
                f'El monto ({monto}) supera el saldo pendiente ({cuenta.saldo}).'
            )
        return data


class CuentaPorCobrarSerializer(serializers.ModelSerializer):
    pagos = PagoClienteSerializer(many=True, read_only=True)
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
            'notas', 'created_at', 'pagos',
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
        if factura:
            request = self.context.get('request')
            empresa = getattr(request.user, 'empresa', None) if request else None
            if empresa and factura.empresa != empresa:
                raise serializers.ValidationError(
                    {'factura': 'La factura no pertenece a su empresa.'}
                )
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        empresa = getattr(request.user, 'empresa', None) if request else None
        validated_data['empresa'] = empresa
        validated_data['saldo'] = validated_data['monto_total']
        return super().create(validated_data)
