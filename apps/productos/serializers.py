from rest_framework import serializers
from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_creacion', 'fecha_modificacion']

    def validate_codigo_principal(self, value):
        """Validar que el código sea único para la empresa"""
        request = self.context.get('request')
        empresa = request.user.empresa if request else None
        instance = self.instance

        if instance:
            if Producto.objects.filter(
                empresa=empresa, codigo_principal=value
            ).exclude(id=instance.id).exists():
                raise serializers.ValidationError('Ya existe un producto con este código')
        else:
            if Producto.objects.filter(empresa=empresa, codigo_principal=value).exists():
                raise serializers.ValidationError('Ya existe un producto con este código')

        return value
