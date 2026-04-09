from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from .models import (
    Proveedor, OrdenCompra, DetalleOrdenCompra,
    RecepcionCompra, DetalleRecepcion,
    CuentaPorPagar, PagoProveedor
)


class ProveedorSerializer(serializers.ModelSerializer):
    """Serializer para Proveedor"""
    
    class Meta:
        model = Proveedor
        fields = [
            'id', 'uuid', 'tipo_identificacion', 'identificacion',
            'razon_social', 'nombre_comercial', 'direccion',
            'telefono', 'celular', 'email', 'contacto_principal',
            'dias_credito', 'limite_credito', 'cuenta_contable',
            'activo', 'notas', 'creado_en', 'actualizado_en'
        ]
        read_only_fields = ['uuid', 'creado_en', 'actualizado_en']
    
    def create(self, validated_data):
        validated_data['empresa'] = self.context['request'].user.empresa
        return super().create(validated_data)

class DetalleOrdenCompraSerializer(serializers.ModelSerializer):
    """Serializer para DetalleOrdenCompra"""
    
    producto_nombre = serializers.CharField(
        source='producto.nombre',
        read_only=True
    )
    producto_codigo = serializers.CharField(
        source='producto.codigo',
        read_only=True
    )
    cantidad_pendiente_recibir = serializers.SerializerMethodField()
    
    class Meta:
        model = DetalleOrdenCompra
        fields = [
            'id', 'producto', 'producto_nombre', 'producto_codigo',
            'cantidad', 'cantidad_recibida', 'cantidad_pendiente_recibir',
            'precio_unitario', 'descuento', 'aplica_iva',
            'porcentaje_iva', 'subtotal', 'iva', 'total', 'notas'
        ]
        read_only_fields = ['cantidad_recibida', 'subtotal', 'iva', 'total']
    
    def get_cantidad_pendiente_recibir(self, obj):
        return obj.cantidad_pendiente()


class OrdenCompraSerializer(serializers.ModelSerializer):
    """Serializer para OrdenCompra"""
    
    detalles = DetalleOrdenCompraSerializer(many=True, required=False)
    proveedor_nombre = serializers.CharField(
        source='proveedor.razon_social',
        read_only=True
    )
    bodega_nombre = serializers.CharField(
        source='bodega_destino.nombre',
        read_only=True
    )
    creado_por_nombre = serializers.CharField(
        source='creado_por.get_full_name',
        read_only=True
    )
    
    class Meta:
        model = OrdenCompra
        fields = [
            'id', 'uuid', 'proveedor', 'proveedor_nombre',
            'bodega_destino', 'bodega_nombre', 'numero_orden',
            'fecha_orden', 'fecha_entrega_esperada', 'estado',
            'subtotal', 'descuento', 'iva', 'total', 'notas',
            'detalles', 'creado_por', 'creado_por_nombre',
            'creado_en', 'actualizado_en'
        ]
        read_only_fields = [
            'uuid', 'subtotal', 'iva', 'total', 'estado',
            'creado_por', 'creado_en', 'actualizado_en'
        ]
    
    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles', [])
        validated_data['empresa'] = self.context['request'].user.empresa
        validated_data['creado_por'] = self.context['request'].user
        
        # Generar número de orden
        empresa = validated_data['empresa']
        ultimo = OrdenCompra.objects.filter(empresa=empresa).order_by('-id').first()
        siguiente_num = 1 if not ultimo else int(ultimo.numero_orden.split('-')[-1]) + 1
        validated_data['numero_orden'] = f"{empresa.id}-{siguiente_num:06d}"
        
        orden = OrdenCompra.objects.create(**validated_data)
        
        # Crear detalles
        for detalle_data in detalles_data:
            detalle = DetalleOrdenCompra.objects.create(
                orden_compra=orden,
                **detalle_data
            )
            detalle.calcular_totales()
            detalle.save()
        
        # Calcular totales de la orden
        orden.calcular_totales()
        orden.save()
        
        return orden
    
    @transaction.atomic
    def update(self, instance, validated_data):
        detalles_data = validated_data.pop('detalles', None)
        
        # Actualizar orden
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Si hay detalles, reemplazarlos
        if detalles_data is not None:
            instance.detalles.all().delete()
            
            for detalle_data in detalles_data:
                detalle = DetalleOrdenCompra.objects.create(
                    orden_compra=instance,
                    **detalle_data
                )
                detalle.calcular_totales()
                detalle.save()
            
            # Recalcular totales
            instance.calcular_totales()
        
        instance.save()
        return instance


class DetalleRecepcionSerializer(serializers.ModelSerializer):
    """Serializer para DetalleRecepcion"""
    
    producto_nombre = serializers.CharField(
        source='detalle_orden.producto.nombre',
        read_only=True
    )
    producto_codigo = serializers.CharField(
        source='detalle_orden.producto.codigo',
        read_only=True
    )
    cantidad_ordenada = serializers.DecimalField(
        source='detalle_orden.cantidad',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    
    class Meta:
        model = DetalleRecepcion
        fields = [
            'id', 'detalle_orden', 'producto_nombre', 'producto_codigo',
            'cantidad_ordenada', 'cantidad_recibida', 'costo_unitario', 'notas'
        ]


class RecepcionCompraSerializer(serializers.ModelSerializer):
    """Serializer para RecepcionCompra"""
    
    detalles = DetalleRecepcionSerializer(many=True, required=False)
    orden_numero = serializers.CharField(
        source='orden_compra.numero_orden',
        read_only=True
    )
    proveedor_nombre = serializers.CharField(
        source='orden_compra.proveedor.razon_social',
        read_only=True
    )
    bodega_nombre = serializers.CharField(
        source='bodega.nombre',
        read_only=True
    )
    recibido_por_nombre = serializers.CharField(
        source='recibido_por.get_full_name',
        read_only=True
    )
    
    class Meta:
        model = RecepcionCompra
        fields = [
            'id', 'uuid', 'orden_compra', 'orden_numero',
            'proveedor_nombre', 'bodega', 'bodega_nombre',
            'numero_recepcion', 'fecha_recepcion', 'estado',
            'numero_factura_proveedor', 'fecha_factura_proveedor',
            'notas', 'detalles', 'recibido_por', 'recibido_por_nombre',
            'creado_en', 'actualizado_en'
        ]
        read_only_fields = [
            'uuid', 'estado', 'recibido_por',
            'creado_en', 'actualizado_en'
        ]
    
    def validate(self, data):
        """Validar que no se reciba más de lo ordenado"""
        if self.instance is None:  # Solo en creación
            detalles = data.get('detalles', [])
            for detalle_data in detalles:
                detalle_orden = detalle_data['detalle_orden']
                cantidad_recibida = detalle_data['cantidad_recibida']
                
                # Sumar cantidades ya recibidas
                ya_recibido = sum(
                    d.cantidad_recibida 
                    for d in detalle_orden.recepciones.all()
                )
                
                pendiente = detalle_orden.cantidad - ya_recibido
                
                if cantidad_recibida > pendiente:
                    raise serializers.ValidationError({
                        'detalles': f'No se puede recibir más de lo ordenado. '
                                   f'Pendiente: {pendiente}, '
                                   f'Intentando recibir: {cantidad_recibida}'
                    })
        
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles', [])
        validated_data['empresa'] = self.context['request'].user.empresa
        validated_data['recibido_por'] = self.context['request'].user
        
        # Generar número de recepción
        empresa = validated_data['empresa']
        ultimo = RecepcionCompra.objects.filter(empresa=empresa).order_by('-id').first()
        siguiente_num = 1 if not ultimo else int(ultimo.numero_recepcion.split('-')[-1]) + 1
        validated_data['numero_recepcion'] = f"{empresa.id}-RC-{siguiente_num:06d}"
        
        recepcion = RecepcionCompra.objects.create(**validated_data)
        
        # Crear detalles
        for detalle_data in detalles_data:
            DetalleRecepcion.objects.create(
                recepcion=recepcion,
                **detalle_data
            )
        
        return recepcion


class CuentaPorPagarSerializer(serializers.ModelSerializer):
    """Serializer para CuentaPorPagar"""
    
    proveedor_nombre = serializers.CharField(
        source='proveedor.razon_social',
        read_only=True
    )
    recepcion_numero = serializers.CharField(
        source='recepcion.numero_recepcion',
        read_only=True,
        allow_null=True
    )
    dias_vencidos = serializers.SerializerMethodField()
    
    class Meta:
        model = CuentaPorPagar
        fields = [
            'id', 'uuid', 'proveedor', 'proveedor_nombre',
            'recepcion', 'recepcion_numero', 'numero_cuenta',
            'fecha_emision', 'fecha_vencimiento', 'dias_vencidos',
            'monto_total', 'monto_pagado', 'saldo', 'estado',
            'notas', 'creado_en', 'actualizado_en'
        ]
        read_only_fields = [
            'uuid', 'monto_pagado', 'saldo', 'estado',
            'creado_en', 'actualizado_en'
        ]
    
    def get_dias_vencidos(self, obj):
        from django.utils import timezone
        if obj.estado == CuentaPorPagar.EstadoChoices.PAGADA:
            return 0
        
        hoy = timezone.now().date()
        if hoy > obj.fecha_vencimiento:
            return (hoy - obj.fecha_vencimiento).days
        return 0
    
    def create(self, validated_data):
        validated_data['empresa'] = self.context['request'].user.empresa
        validated_data['saldo'] = validated_data['monto_total']
        return super().create(validated_data)


class PagoProveedorSerializer(serializers.ModelSerializer):
    """Serializer para PagoProveedor"""
    
    proveedor_nombre = serializers.CharField(
        source='proveedor.razon_social',
        read_only=True
    )
    cuenta_numero = serializers.CharField(
        source='cuenta_por_pagar.numero_cuenta',
        read_only=True
    )
    registrado_por_nombre = serializers.CharField(
        source='registrado_por.get_full_name',
        read_only=True
    )
    
    class Meta:
        model = PagoProveedor
        fields = [
            'id', 'uuid', 'proveedor', 'proveedor_nombre',
            'cuenta_por_pagar', 'cuenta_numero', 'numero_pago',
            'fecha_pago', 'forma_pago', 'monto', 'numero_documento',
            'banco', 'notas', 'registrado_por', 'registrado_por_nombre',
            'creado_en', 'actualizado_en'
        ]
        read_only_fields = [
            'uuid', 'registrado_por', 'creado_en', 'actualizado_en'
        ]
    
    def validate(self, data):
        """Validar que el monto no exceda el saldo"""
        cuenta = data.get('cuenta_por_pagar')
        monto = data.get('monto')
        
        if cuenta and monto:
            if monto > cuenta.saldo:
                raise serializers.ValidationError({
                    'monto': f'El monto ({monto}) excede el saldo de la cuenta ({cuenta.saldo})'
                })
        
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        validated_data['empresa'] = self.context['request'].user.empresa
        validated_data['registrado_por'] = self.context['request'].user
        
        # Generar número de pago
        empresa = validated_data['empresa']
        ultimo = PagoProveedor.objects.filter(empresa=empresa).order_by('-id').first()
        siguiente_num = 1 if not ultimo else int(ultimo.numero_pago.split('-')[-1]) + 1
        validated_data['numero_pago'] = f"{empresa.id}-PP-{siguiente_num:06d}"
        
        pago = PagoProveedor.objects.create(**validated_data)
        
        # Actualizar cuenta por pagar
        cuenta = pago.cuenta_por_pagar
        cuenta.monto_pagado += pago.monto
        cuenta.actualizar_estado_pago()
        cuenta.save()
        
        return pago
