from calendar import monthrange
from datetime import date

from django.db import transaction
from rest_framework import serializers
from .models import (
    ConceptoEmpleadoNomina,
    DetalleRolPago,
    Empleado,
    PagoRol,
    ParametroNomina,
    RolPago,
    RubroNomina,
)


class EmpleadoSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = Empleado
        fields = [
            'id', 'cedula', 'nombres', 'apellidos', 'nombre_completo',
            'cargo', 'departamento', 'tipo_contrato', 'estado',
            'fecha_ingreso', 'fecha_salida', 'sueldo_base',
            'afiliado_iess', 'numero_iess', 'cuenta_bancaria', 'banco',
            'email', 'telefono',
        ]


class ParametroNominaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametroNomina
        fields = [
            'id', 'anio', 'sbu', 'aporte_personal_iess', 'aporte_patronal_iess',
            'decimo_tercero_factor', 'vacaciones_factor', 'fondo_reserva_factor',
            'activo', 'notas', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class RubroNominaSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = RubroNomina
        fields = [
            'id', 'codigo', 'nombre', 'tipo', 'tipo_label', 'aplica_iess', 'aplica_ir',
            'es_recurrente', 'automatico', 'activo', 'orden', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_codigo(self, value):
        return value.strip().upper().replace(' ', '_')


def calcular_fecha_fin_recurrencia(fecha_inicio, meses_duracion):
    if not fecha_inicio or not meses_duracion:
        return None
    month_index = fecha_inicio.month - 1 + int(meses_duracion) - 1
    year = fecha_inicio.year + month_index // 12
    month = month_index % 12 + 1
    last_day = monthrange(year, month)[1]
    return date(year, month, last_day)


class ConceptoEmpleadoNominaSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.nombre_completo', read_only=True)
    rubro_nombre = serializers.CharField(source='rubro.nombre', read_only=True)
    rubro_tipo = serializers.CharField(source='rubro.tipo', read_only=True)

    class Meta:
        model = ConceptoEmpleadoNomina
        fields = [
            'id', 'empleado', 'empleado_nombre', 'rubro', 'rubro_nombre', 'rubro_tipo',
            'descripcion', 'valor', 'fecha_inicio', 'fecha_fin', 'permanente',
            'meses_duracion', 'activo', 'notas', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):
        request = self.context['request']
        empresa = request.user.empresa
        empleado = data.get('empleado') or getattr(self.instance, 'empleado', None)
        rubro = data.get('rubro') or getattr(self.instance, 'rubro', None)
        if empleado and empleado.empresa_id != empresa.id:
            raise serializers.ValidationError({'empleado': 'El empleado no pertenece a la empresa.'})
        if rubro and rubro.empresa_id != empresa.id:
            raise serializers.ValidationError({'rubro': 'El rubro no pertenece a la empresa.'})
        if rubro and not rubro.es_recurrente:
            raise serializers.ValidationError({'rubro': 'Este rubro no está habilitado como recurrente.'})
        permanente = data.get('permanente', getattr(self.instance, 'permanente', True))
        meses_duracion = data.get('meses_duracion', getattr(self.instance, 'meses_duracion', None))
        if not permanente and not meses_duracion:
            raise serializers.ValidationError({'meses_duracion': 'Indica cuántos meses durará la recurrencia o marca permanente.'})
        return data

    def _apply_recurrencia(self, validated_data):
        permanente = validated_data.get('permanente', getattr(self.instance, 'permanente', True))
        if permanente:
            validated_data['meses_duracion'] = None
            validated_data['fecha_fin'] = None
            return validated_data
        fecha_inicio = validated_data.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        meses_duracion = validated_data.get('meses_duracion', getattr(self.instance, 'meses_duracion', None))
        validated_data['fecha_fin'] = calcular_fecha_fin_recurrencia(fecha_inicio, meses_duracion)
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_recurrencia(validated_data))

    def update(self, instance, validated_data):
        self.instance = instance
        return super().update(instance, self._apply_recurrencia(validated_data))


class DetalleRolPagoSerializer(serializers.ModelSerializer):
    rol = serializers.PrimaryKeyRelatedField(queryset=RolPago.objects.all(), required=False, write_only=True)
    rubro_nombre = serializers.CharField(source='rubro.nombre', read_only=True)

    class Meta:
        model = DetalleRolPago
        fields = [
            'id', 'rol', 'rubro', 'rubro_nombre', 'tipo', 'codigo', 'descripcion',
            'cantidad', 'valor_unitario', 'valor_total', 'aplica_iess', 'aplica_ir',
            'automatico', 'orden', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'tipo', 'codigo', 'valor_total', 'aplica_iess', 'aplica_ir',
            'created_at', 'updated_at',
        ]

    def validate_rubro(self, rubro):
        request = self.context.get('request')
        if request and rubro.empresa_id != request.user.empresa_id:
            raise serializers.ValidationError('El rubro no pertenece a la empresa.')
        return rubro

    def validate_rol(self, rol):
        request = self.context.get('request')
        if request and rol.empresa_id != request.user.empresa_id:
            raise serializers.ValidationError('El rol no pertenece a la empresa.')
        return rol


class PagoRolSerializer(serializers.ModelSerializer):
    cuenta_label = serializers.SerializerMethodField()
    movimiento_bancario_id = serializers.IntegerField(source='movimiento_bancario.id', read_only=True)

    class Meta:
        model = PagoRol
        fields = [
            'id', 'cuenta_bancaria', 'cuenta_label', 'movimiento_bancario_id',
            'fecha_pago', 'monto', 'referencia', 'notas', 'created_at',
        ]
        read_only_fields = ['monto', 'created_at', 'movimiento_bancario_id']

    def get_cuenta_label(self, obj):
        return str(obj.cuenta_bancaria) if obj.cuenta_bancaria_id else ''


class RolPagoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.SerializerMethodField()
    detalles = DetalleRolPagoSerializer(many=True, read_only=True)
    pago_nomina = PagoRolSerializer(read_only=True)

    class Meta:
        model = RolPago
        fields = [
            'id', 'empleado', 'empleado_nombre', 'anio', 'mes', 'estado',
            'sueldo_base', 'horas_extra_25', 'horas_extra_100',
            'comisiones', 'bonos', 'otros_ingresos',
            'aporte_patronal', 'decimo_tercero', 'decimo_cuarto',
            'fondos_reserva', 'vacaciones',
            'aporte_personal', 'impuesto_renta', 'anticipos', 'otros_descuentos',
            'total_ingresos', 'total_descuentos', 'liquido_a_pagar',
            'notas', 'created_at', 'detalles', 'pago_nomina',
        ]

    def get_empleado_nombre(self, obj):
        return obj.empleado.nombre_completo


class RolPagoCreateSerializer(serializers.ModelSerializer):
    detalles = DetalleRolPagoSerializer(many=True, required=False)

    class Meta:
        model = RolPago
        fields = [
            'empleado', 'anio', 'mes', 'sueldo_base', 'horas_extra_25', 'horas_extra_100',
            'comisiones', 'bonos', 'otros_ingresos', 'impuesto_renta', 'anticipos',
            'otros_descuentos', 'notas', 'fondos_reserva', 'detalles',
        ]

    def validate(self, data):
        request = self.context['request']
        empleado = data.get('empleado') or getattr(self.instance, 'empleado', None)
        if empleado and empleado.empresa_id != request.user.empresa_id:
            raise serializers.ValidationError({'empleado': 'El empleado no pertenece a la empresa.'})
        if self.instance and self.instance.estado != RolPago.EstadoChoices.BORRADOR:
            raise serializers.ValidationError({'detail': 'Solo se pueden editar roles en borrador.'})
        return data

    def _sync_detalles(self, rol, detalles_data):
        if detalles_data is None:
            return
        rol.detalles.all().delete()
        for index, detalle_data in enumerate(detalles_data):
            detalle_data = dict(detalle_data)
            orden = detalle_data.pop('orden', None) or index + 1
            DetalleRolPago.objects.create(rol=rol, orden=orden, **detalle_data)
        rol.save()

    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles', None)
        empresa = self.context['request'].user.empresa
        rol = RolPago.objects.create(empresa=empresa, **validated_data)
        self._sync_detalles(rol, detalles_data)
        return rol

    @transaction.atomic
    def update(self, instance, validated_data):
        detalles_data = validated_data.pop('detalles', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._sync_detalles(instance, detalles_data)
        return instance


class MarcarPagadoRolSerializer(serializers.Serializer):
    cuenta_bancaria = serializers.IntegerField(required=False, allow_null=True)
    fecha_pago = serializers.DateField(required=False)
    referencia = serializers.CharField(required=False, allow_blank=True, max_length=100)
    notas = serializers.CharField(required=False, allow_blank=True)
