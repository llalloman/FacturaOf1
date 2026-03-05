from rest_framework import serializers
from .models import Cliente


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_creacion', 'fecha_modificacion']
    
    def validate_identificacion(self, value):
        """Validar que la identificación sea única para la empresa"""
        request = self.context.get('request')
        empresa = request.user.empresa if request else None
        instance = self.instance

        if instance:
            if Cliente.objects.filter(
                empresa=empresa, identificacion=value
            ).exclude(id=instance.id).exists():
                raise serializers.ValidationError('Ya existe un cliente con esta identificación')
        else:
            if Cliente.objects.filter(empresa=empresa, identificacion=value).exists():
                raise serializers.ValidationError('Ya existe un cliente con esta identificación')

        return value
    
    def validate(self, data):
        """Validar según tipo de identificación"""
        tipo_identificacion = data.get('tipo_identificacion')
        identificacion = data.get('identificacion', '')

        if tipo_identificacion == '04' and len(identificacion) != 13:
            raise serializers.ValidationError({
                'identificacion': 'El RUC debe tener 13 dígitos'
            })
        elif tipo_identificacion == '05' and len(identificacion) != 10:
            raise serializers.ValidationError({
                'identificacion': 'La cédula debe tener 10 dígitos'
            })
        elif tipo_identificacion == '06' and len(identificacion) < 5:
            raise serializers.ValidationError({
                'identificacion': 'El pasaporte debe tener al menos 5 caracteres'
            })

        return data
