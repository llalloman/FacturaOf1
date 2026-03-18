from rest_framework import serializers
from .models import PlanSuscripcion, Suscripcion, Pago, ModuloPermiso, MODULOS_DISPONIBLES


class PlanSuscripcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanSuscripcion
        fields = [
            'id', 'nombre', 'codigo', 'tipo', 'periodo',
            'precio', 'facturas_mensuales', 'usuarios_permitidos',
            'empresas_permitidas', 'soporte_prioritario', 'api_access',
            'reportes_avanzados', 'activo', 'descripcion',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Convención BD: 0 = ilimitado. El frontend usa -1 para ilimitado.
        if data['facturas_mensuales'] == 0:
            data['facturas_mensuales'] = -1
        if data['usuarios_permitidos'] == 0:
            data['usuarios_permitidos'] = -1
        if data['empresas_permitidas'] == 0:
            data['empresas_permitidas'] = -1
        return data


class SuscripcionSerializer(serializers.ModelSerializer):
    plan_detalle = PlanSuscripcionSerializer(source='plan', read_only=True)
    dias_restantes = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    # Computed from real factura records so the counter is always accurate
    facturas_emitidas_mes_actual = serializers.SerializerMethodField()

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

    def get_facturas_emitidas_mes_actual(self, obj):
        """Cuenta facturas reales del período de suscripción actual (excl. ANULADAS)."""
        from django.utils import timezone
        try:
            from apps.facturacion.models import Factura
            return Factura.objects.filter(
                comprobante__empresa=obj.empresa,
                comprobante__fecha_emision__gte=obj.fecha_inicio,
                comprobante__fecha_emision__lte=timezone.now(),
            ).exclude(comprobante__estado='ANULADO').count()
        except Exception:
            return obj.facturas_emitidas_mes_actual


class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = ['id', 'suscripcion', 'monto', 'tipo', 'estado', 'metodo', 'referencia', 'notas', 'fecha_creacion']


class ModuloCatalogSerializer(serializers.Serializer):
    """Catálogo de todos los módulos disponibles (solo lectura)."""
    codigo = serializers.CharField()
    label = serializers.CharField()


class ModuloPermisoSerializer(serializers.Serializer):
    """Actualización de permisos de un plan (lista de códigos de módulo)."""
    modulos = serializers.ListField(
        child=serializers.ChoiceField(choices=[c for c, _ in MODULOS_DISPONIBLES]),
        allow_empty=True,
    )
