from rest_framework import serializers
from .models import CuentaContable, AsientoContable, LineaAsiento


# ── Plan de Cuentas ──────────────────────────────────────────────────────────

class CuentaContableSerializer(serializers.ModelSerializer):
    saldo = serializers.SerializerMethodField()
    tiene_hijos = serializers.SerializerMethodField()

    class Meta:
        model = CuentaContable
        fields = [
            'id', 'codigo', 'nombre', 'tipo', 'naturaleza',
            'nivel', 'es_hoja', 'activa', 'padre',
            'saldo', 'tiene_hijos',
        ]

    def get_saldo(self, obj):
        return float(obj.saldo())

    def get_tiene_hijos(self, obj):
        return obj.hijos.exists()


class CuentaContableTreeSerializer(serializers.ModelSerializer):
    """Serializer recursivo para árbol del plan de cuentas."""
    hijos = serializers.SerializerMethodField()
    saldo = serializers.SerializerMethodField()

    class Meta:
        model = CuentaContable
        fields = ['id', 'codigo', 'nombre', 'tipo', 'naturaleza', 'nivel', 'es_hoja', 'activa', 'saldo', 'hijos']

    def get_hijos(self, obj):
        return CuentaContableTreeSerializer(obj.hijos.filter(activa=True), many=True).data

    def get_saldo(self, obj):
        return float(obj.saldo())


# ── Líneas de Asiento ────────────────────────────────────────────────────────

class LineaAsientoSerializer(serializers.ModelSerializer):
    cuenta_codigo = serializers.CharField(source='cuenta.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta.nombre', read_only=True)

    class Meta:
        model = LineaAsiento
        fields = ['id', 'cuenta', 'cuenta_codigo', 'cuenta_nombre', 'descripcion', 'debe', 'haber']


class LineaAsientoWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LineaAsiento
        fields = ['cuenta', 'descripcion', 'debe', 'haber']


# ── Asientos ─────────────────────────────────────────────────────────────────

class AsientoContableSerializer(serializers.ModelSerializer):
    lineas = LineaAsientoSerializer(many=True, read_only=True)
    total_debe  = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_haber = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    cuadrado    = serializers.BooleanField(read_only=True)
    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = AsientoContable
        fields = [
            'id', 'numero', 'fecha', 'tipo', 'descripcion', 'referencia',
            'bloqueado', 'total_debe', 'total_haber', 'cuadrado',
            'creado_por', 'creado_por_nombre', 'created_at',
            'lineas',
        ]

    def get_creado_por_nombre(self, obj):
        if obj.creado_por:
            return obj.creado_por.get_full_name() or obj.creado_por.email
        return None


class AsientoContableCreateSerializer(serializers.ModelSerializer):
    lineas = LineaAsientoWriteSerializer(many=True)

    class Meta:
        model = AsientoContable
        fields = ['numero', 'fecha', 'tipo', 'descripcion', 'referencia', 'lineas']

    def _validate_cuadra(self, lineas_data):
        from decimal import Decimal
        total_debe  = sum(Decimal(str(l.get('debe',  0))) for l in lineas_data)
        total_haber = sum(Decimal(str(l.get('haber', 0))) for l in lineas_data)
        if abs(total_debe - total_haber) > Decimal('0.01'):
            raise serializers.ValidationError(
                f'El asiento no cuadra: Debe={total_debe} Haber={total_haber}'
            )

    def validate(self, data):
        self._validate_cuadra(data.get('lineas', []))
        return data

    def create(self, validated_data):
        lineas_data = validated_data.pop('lineas')
        request = self.context.get('request')
        empresa = request.user.empresa if request else None

        # Auto-number: contabilidad-YYYYMMDD-seq
        from django.utils import timezone
        import datetime
        fecha = validated_data.get('fecha', datetime.date.today())
        prefix = fecha.strftime('%Y%m%d')
        count = AsientoContable.objects.filter(empresa=empresa, numero__startswith=f'AJ-{prefix}').count()
        numero = validated_data.get('numero') or f'AJ-{prefix}-{count+1:04d}'

        asiento = AsientoContable.objects.create(
            empresa=empresa,
            creado_por=request.user if request else None,
            numero=numero,
            **validated_data,
        )
        for linea in lineas_data:
            LineaAsiento.objects.create(asiento=asiento, **linea)
        return asiento
