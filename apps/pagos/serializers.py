from rest_framework import serializers

from apps.empresas.models import Empresa
from apps.pagos.models import PagoConfiguracion, PagoOnline


class PagoConfiguracionSerializer(serializers.ModelSerializer):
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all(), required=False)

    class Meta:
        model = PagoConfiguracion
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        empresa = (
            attrs.get('empresa')
            or getattr(self.instance, 'empresa', None)
            or getattr(request, 'tenant', None)
            or getattr(getattr(request, 'user', None), 'empresa', None)
        )
        establecimiento = attrs.get('establecimiento_fiscal', getattr(self.instance, 'establecimiento_fiscal', None))
        punto = attrs.get('punto_emision_fiscal', getattr(self.instance, 'punto_emision_fiscal', None))
        if establecimiento or punto:
            if not establecimiento or not punto:
                raise serializers.ValidationError('Establecimiento y punto de emisión deben configurarse juntos.')
            if empresa and (establecimiento.empresa_id != empresa.id or punto.empresa_id != empresa.id or punto.establecimiento_id != establecimiento.id):
                raise serializers.ValidationError('El contexto fiscal no pertenece a la empresa configurada.')
            if not establecimiento.activo or not punto.activo:
                raise serializers.ValidationError('El contexto fiscal configurado está inactivo.')
        return attrs


class PagoOnlineSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    venta_numero = serializers.CharField(source='venta.numero_venta', read_only=True)

    class Meta:
        model = PagoOnline
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
