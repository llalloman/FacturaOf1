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

    class Meta:
        model = MovimientoBancario
        fields = [
            'id', 'cuenta', 'cuenta_label', 'fecha', 'tipo',
            'descripcion', 'referencia', 'monto', 'conciliado',
            'beneficiario', 'notas', 'created_at', 'es_entrada',
        ]

    def get_cuenta_label(self, obj):
        return str(obj.cuenta)
