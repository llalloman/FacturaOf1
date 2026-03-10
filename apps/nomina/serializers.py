from rest_framework import serializers
from .models import Empleado, RolPago


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


class RolPagoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.SerializerMethodField()

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
            'notas', 'created_at',
        ]

    def get_empleado_nombre(self, obj):
        return obj.empleado.nombre_completo


class RolPagoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolPago
        fields = [
            'empleado', 'anio', 'mes',
            'sueldo_base', 'horas_extra_25', 'horas_extra_100',
            'comisiones', 'bonos', 'otros_ingresos',
            'impuesto_renta', 'anticipos', 'otros_descuentos', 'notas',
            'fondos_reserva',
        ]

    def create(self, validated_data):
        empresa = self.context['request'].user.empresa
        rol = RolPago(empresa=empresa, **validated_data)
        rol.save()  # triggers calcular()
        return rol
