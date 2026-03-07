from rest_framework import serializers
from .models import PlanSuscripcion, Suscripcion, Pago


class PlanSuscripcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanSuscripcion
        fields = [
            'id', 'nombre', 'codigo', 'tipo', 'periodo',
            'precio', 'facturas_mensuales', 'usuarios_permitidos',
            'empresas_permitidas', 'soporte_prioritario', 'api_access',
            'reportes_avanzados', 'activo', 'descripcion',
        ]


class SuscripcionSerializer(serializers.ModelSerializer):
    plan_detalle = PlanSuscripcionSerializer(source='plan', read_only=True)
    dias_restantes = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)

    class Meta:
        model = Suscripcion
        fields = [
            'id', 'empresa', 'empresa_nombre', 'plan', 'plan_detalle',
            'fecha_inicio', 'fecha_fin', 'fecha_proximo_pago',
            'estado', 'auto_renovar',
            'facturas_emitidas_mes_actual',
            'ultimo_reset_contador',
            'dias_restantes',
            'notas',
        ]

    def get_dias_restantes(self, obj):
        return obj.dias_restantes()


class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = ['id', 'suscripcion', 'monto', 'tipo', 'estado', 'metodo', 'referencia', 'notas', 'fecha_creacion']
