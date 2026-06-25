from rest_framework import serializers

from apps.empresas.models import Empresa
from apps.pagos.models import PagoConfiguracion, PagoOnline


class PagoConfiguracionSerializer(serializers.ModelSerializer):
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all(), required=False)

    class Meta:
        model = PagoConfiguracion
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class PagoOnlineSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    venta_numero = serializers.CharField(source='venta.numero_venta', read_only=True)

    class Meta:
        model = PagoOnline
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
