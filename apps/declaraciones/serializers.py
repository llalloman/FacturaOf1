"""
Declaraciones SRI — Serializers.
"""
from rest_framework import serializers
from .models import DeclaracionMensual


class DeclaracionMensualSerializer(serializers.ModelSerializer):
    mes_nombre = serializers.CharField(source='get_mes_nombre', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_formulario_display', read_only=True)
    empresa_ruc = serializers.CharField(source='empresa.ruc', read_only=True)
    empresa_razon_social = serializers.CharField(source='empresa.razon_social', read_only=True)

    class Meta:
        model = DeclaracionMensual
        fields = [
            'id', 'empresa', 'tipo_formulario', 'tipo_display',
            'anio', 'mes', 'mes_nombre', 'estado', 'estado_display',
            'total_ventas', 'total_compras',
            'iva_ventas', 'iva_compras',
            'impuesto_a_pagar', 'credito_tributario', 'total_retenido',
            'fecha_limite', 'fecha_presentacion', 'numero_formulario_sri',
            'notas', 'datos_json',
            'empresa_ruc', 'empresa_razon_social',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'empresa', 'datos_json',
            'total_ventas', 'total_compras',
            'iva_ventas', 'iva_compras',
            'impuesto_a_pagar', 'credito_tributario', 'total_retenido',
            'fecha_limite',
            'created_at', 'updated_at',
        ]


class MarcarPresentadaSerializer(serializers.Serializer):
    numero_formulario_sri = serializers.CharField(
        max_length=30, required=False, default='',
        help_text='Número de formulario asignado por el SRI',
    )
    notas = serializers.CharField(required=False, default='')
