from rest_framework import serializers
from .models import PlanSuscripcion, Suscripcion, Pago, ModuloSistema, SeccionModulo, get_todos_modulos_codigos


class PlanSuscripcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanSuscripcion
        fields = [
            'id', 'nombre', 'codigo', 'tipo', 'periodo',
            'precio', 'producto_erp', 'facturas_mensuales', 'usuarios_permitidos',
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


class SeccionModuloSerializer(serializers.ModelSerializer):
    """Temas principales que agrupan módulos del menú/catálogo."""
    class Meta:
        model = SeccionModulo
        fields = ['id', 'codigo', 'nombre', 'orden', 'activo']


class ModuloSistemaSerializer(serializers.ModelSerializer):
    """Catálogo de todos los módulos disponibles (solo lectura)."""
    seccion_codigo = serializers.CharField(source='seccion.codigo', read_only=True)
    seccion_nombre = serializers.CharField(source='seccion.nombre', read_only=True)

    class Meta:
        model = ModuloSistema
        fields = [
            'id', 'seccion', 'seccion_codigo', 'seccion_nombre',
            'codigo', 'label', 'ruta', 'grupo', 'icono', 'orden', 'activo', 'external',
        ]

    def validate(self, attrs):
        seccion = attrs.get('seccion') or getattr(self.instance, 'seccion', None)
        grupo = attrs.get('grupo') or getattr(self.instance, 'grupo', '')
        if not seccion and not grupo:
            raise serializers.ValidationError({'seccion': 'Selecciona un tema principal.'})
        return attrs


class ModuloCatalogSerializer(serializers.Serializer):
    """Compatibilidad para payloads simples del catálogo."""
    codigo = serializers.CharField()
    label = serializers.CharField()
    ruta = serializers.CharField(required=False)
    grupo = serializers.CharField(required=False)
    icono = serializers.CharField(required=False, allow_blank=True)
    orden = serializers.IntegerField(required=False)
    activo = serializers.BooleanField(required=False)
    external = serializers.BooleanField(required=False)


class ModuloPermisoSerializer(serializers.Serializer):
    """Actualización de permisos de un plan (lista de códigos de módulo)."""
    modulos = serializers.ListField(
        child=serializers.CharField(max_length=50),
        allow_empty=True,
    )

    def validate_modulos(self, value):
        permitidos = set(get_todos_modulos_codigos())
        invalidos = sorted(set(value) - permitidos)
        if invalidos:
            raise serializers.ValidationError(f'Módulos inválidos o inactivos: {", ".join(invalidos)}')
        return value
