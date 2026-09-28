from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from .models import Bodega, StockProducto, LoteInventario, MovimientoInventario, TransferenciaInventario, DetalleTransferencia
from apps.productos.serializers import ProductoSerializer
from apps.core.tenant import require_active_empresa, active_empresa
from .validation import movement_sign_error


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


class LoteInventarioSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    bodega_detalle = BodegaSerializer(source='bodega', read_only=True)
    dias_para_caducar = serializers.SerializerMethodField()

    class Meta:
        model = LoteInventario
        fields = '__all__'
        read_only_fields = [
            'empresa', 'estado', 'cantidad_disponible',
            'fecha_creacion', 'fecha_modificacion',
        ]

    def get_dias_para_caducar(self, obj):
        if not obj.fecha_caducidad:
            return None
        return (obj.fecha_caducidad - timezone.now().date()).days


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    bodega_detalle = BodegaSerializer(source='bodega', read_only=True)
    lote_detalle = LoteInventarioSerializer(source='lote', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = MovimientoInventario
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_movimiento', 'usuario']
    
    @transaction.atomic
    def create(self, validated_data):
        # El usuario se toma del request
        request = self.context['request']
        empresa = require_active_empresa(request)
        bodega = validated_data['bodega']
        producto = validated_data['producto']
        cantidad = validated_data['cantidad']
        idempotency_key = validated_data.get('idempotency_key')
        if idempotency_key:
            existente = MovimientoInventario.objects.filter(
                empresa=empresa,
                idempotency_key=idempotency_key,
            ).first()
            if existente:
                same_payload = all([
                    existente.bodega_id == bodega.id,
                    existente.producto_id == producto.id,
                    existente.tipo_movimiento == validated_data.get('tipo_movimiento'),
                    existente.cantidad == cantidad,
                    existente.lote_id == getattr(validated_data.get('lote'), 'id', None),
                ])
                if not same_payload:
                    raise serializers.ValidationError({
                        'idempotency_key': 'La clave ya fue usada con un movimiento diferente.'
                    })
                return existente
        if (
            cantidad < 0
            and not getattr(empresa, 'inventario_permite_stock_negativo', True)
        ):
            stock = StockProducto.objects.select_for_update().filter(
                bodega=bodega,
                producto=producto,
            ).first()
            disponible = stock.cantidad if stock else 0
            if disponible + cantidad < 0:
                raise serializers.ValidationError({
                    'cantidad': (
                        f'Stock insuficiente para {producto.nombre}. '
                        f'Disponible: {disponible}, requerido: {-cantidad}.'
                    )
                })
        validated_data['empresa'] = empresa
        validated_data['usuario'] = request.user
        return super().create(validated_data)

    def validate(self, attrs):
        request = self.context.get('request')
        empresa = active_empresa(request)
        bodega = attrs.get('bodega') or getattr(self.instance, 'bodega', None)
        producto = attrs.get('producto') or getattr(self.instance, 'producto', None)
        if empresa and bodega and bodega.empresa_id != empresa.id:
            raise serializers.ValidationError({'bodega': 'La bodega no pertenece a la empresa activa.'})
        if empresa and producto and producto.empresa_id != empresa.id:
            raise serializers.ValidationError({'producto': 'El producto no pertenece a la empresa activa.'})
        if bodega and producto and producto.empresa_id != bodega.empresa_id:
            raise serializers.ValidationError({'producto': 'El producto y la bodega deben pertenecer a la misma empresa.'})
        cantidad = attrs.get('cantidad')
        tipo = attrs.get('tipo_movimiento')
        sign_error = movement_sign_error(tipo, cantidad)
        if sign_error:
            raise serializers.ValidationError({'cantidad': sign_error})
        return attrs


class DetalleTransferenciaSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    
    class Meta:
        model = DetalleTransferencia
        fields = '__all__'


class TransferenciaInventarioSerializer(serializers.ModelSerializer):
    bodega_origen_detalle = BodegaSerializer(source='bodega_origen', read_only=True)
    bodega_destino_detalle = BodegaSerializer(source='bodega_destino', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario_envia.get_full_name', read_only=True)
    detalles = DetalleTransferenciaSerializer(many=True)
    
    class Meta:
        model = TransferenciaInventario
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_envio', 'usuario_envia', 'usuario_recibe', 'estado']

    def validate(self, attrs):
        request = self.context.get('request')
        empresa = active_empresa(request)
        origen = attrs.get('bodega_origen') or getattr(self.instance, 'bodega_origen', None)
        destino = attrs.get('bodega_destino') or getattr(self.instance, 'bodega_destino', None)
        if origen and destino and origen.id == destino.id:
            raise serializers.ValidationError({'bodega_destino': 'La bodega destino debe ser diferente.'})
        if empresa and origen and origen.empresa_id != empresa.id:
            raise serializers.ValidationError({'bodega_origen': 'La bodega origen no pertenece a la empresa activa.'})
        if empresa and destino and destino.empresa_id != empresa.id:
            raise serializers.ValidationError({'bodega_destino': 'La bodega destino no pertenece a la empresa activa.'})
        detalles = attrs.get('detalles')
        if detalles is not None:
            for index, detalle in enumerate(detalles):
                producto = detalle.get('producto')
                cantidad = detalle.get('cantidad_enviada')
                if empresa and producto and producto.empresa_id != empresa.id:
                    raise serializers.ValidationError({'detalles': {index: {'producto': 'El producto no pertenece a la empresa activa.'}}})
                if cantidad is not None and cantidad <= 0:
                    raise serializers.ValidationError({'detalles': {index: {'cantidad_enviada': 'Debe ser mayor que cero.'}}})
        return attrs
    
    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        request = self.context['request']
        empresa = require_active_empresa(request)
        validated_data['empresa'] = empresa
        validated_data['usuario_envia'] = request.user
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
