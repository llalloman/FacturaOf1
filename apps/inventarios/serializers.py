from rest_framework import serializers
from .models import Bodega, StockProducto, MovimientoInventario, TransferenciaInventario, DetalleTransferencia
from apps.productos.serializers import ProductoSerializer


class BodegaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bodega
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_creacion']


class StockProductoSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    bodega_detalle = BodegaSerializer(source='bodega', read_only=True)
    
    class Meta:
        model = StockProducto
        fields = '__all__'
        read_only_fields = ['ultima_actualizacion']


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    bodega_detalle = BodegaSerializer(source='bodega', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = MovimientoInventario
        fields = '__all__'
        read_only_fields = ['fecha_movimiento', 'usuario']
    
    def create(self, validated_data):
        # El usuario se toma del request
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)


class DetalleTransferenciaSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    
    class Meta:
        model = DetalleTransferencia
        fields = '__all__'


class TransferenciaInventarioSerializer(serializers.ModelSerializer):
    bodega_origen_detalle = BodegaSerializer(source='bodega_origen', read_only=True)
    bodega_destino_detalle = BodegaSerializer(source='bodega_destino', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    detalles = DetalleTransferenciaSerializer(many=True)
    
    class Meta:
        model = TransferenciaInventario
        fields = '__all__'
        read_only_fields = ['fecha_transferencia', 'usuario', 'estado']
    
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        validated_data['usuario'] = self.context['request'].user
        transferencia = TransferenciaInventario.objects.create(**validated_data)
        
        for detalle_data in detalles_data:
            DetalleTransferencia.objects.create(transferencia=transferencia, **detalle_data)
        
        return transferencia
    
    def update(self, instance, validated_data):
        # Solo se puede aprobar o rechazar
        if 'estado' in validated_data:
            instance.estado = validated_data['estado']
            instance.save()
        return instance
