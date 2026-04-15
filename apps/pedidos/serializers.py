from rest_framework import serializers
from decimal import Decimal
from .models import Zona, Mesa, Pedido, DetallePedido


class ZonaSerializer(serializers.ModelSerializer):
    mesas_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Zona
        fields = '__all__'
        read_only_fields = ['empresa']


class MesaSerializer(serializers.ModelSerializer):
    zona_nombre = serializers.CharField(source='zona.nombre', read_only=True, default=None)
    pedido_activo_id = serializers.SerializerMethodField()

    class Meta:
        model = Mesa
        fields = '__all__'
        read_only_fields = ['empresa', 'estado']

    def get_pedido_activo_id(self, obj):
        pedido = obj.pedidos.exclude(estado__in=['PAGADO', 'CANCELADO']).first()
        return pedido.id if pedido else None


class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo_principal', read_only=True)

    class Meta:
        model = DetallePedido
        fields = '__all__'
        read_only_fields = ['pedido', 'subtotal', 'iva', 'fecha_agregado', 'usuario']


class DetallePedidoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetallePedido
        fields = ['producto', 'cantidad', 'precio_unitario', 'descuento', 'notas']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cantidad = Decimal(str(attrs.get('cantidad', 0) or 0))
        precio_unitario = Decimal(str(attrs.get('precio_unitario', 0) or 0))
        descuento = Decimal(str(attrs.get('descuento', 0) or 0))

        if descuento < Decimal('0.00'):
            raise serializers.ValidationError({'descuento': 'El descuento no puede ser negativo.'})

        base_bruta = cantidad * precio_unitario
        if descuento > base_bruta:
            raise serializers.ValidationError({'descuento': 'El descuento no puede superar el subtotal bruto del ítem.'})

        return attrs


class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    mesa_numero = serializers.CharField(source='mesa.numero', read_only=True, default=None)
    mesa_nombre = serializers.CharField(source='mesa.nombre', read_only=True, default=None)
    zona_nombre = serializers.CharField(source='mesa.zona.nombre', read_only=True, default=None)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.razon_social', read_only=True, default=None)

    class Meta:
        model = Pedido
        fields = '__all__'
        read_only_fields = [
            'empresa', 'numero_pedido', 'uuid', 'usuario',
            'subtotal', 'iva', 'total',
            'fecha_apertura', 'fecha_cierre', 'fecha_creacion', 'fecha_modificacion',
            'venta',
        ]

    def create(self, validated_data):
        import uuid as uuid_lib
        request = self.context['request']
        empresa = request.user.empresa if hasattr(request.user, 'empresa') else None
        # SUPER_ADMIN must pass empresa explicitly — infer from mesa or caja
        if not empresa:
            mesa = validated_data.get('mesa')
            caja = validated_data.get('caja')
            if mesa:
                empresa = mesa.empresa
            elif caja:
                empresa = caja.empresa

        validated_data['empresa'] = empresa
        validated_data['usuario'] = request.user
        validated_data['numero_pedido'] = f"P-{uuid_lib.uuid4().hex[:8].upper()}"

        pedido = super().create(validated_data)

        # Marcar mesa como ocupada
        if pedido.mesa:
            pedido.mesa.estado = 'OCUPADA'
            pedido.mesa.save(update_fields=['estado'])

        return pedido


class PedidoListSerializer(serializers.ModelSerializer):
    """Versión ligera para listados, sin detalles completos."""
    mesa_numero = serializers.CharField(source='mesa.numero', read_only=True, default=None)
    zona_nombre = serializers.CharField(source='mesa.zona.nombre', read_only=True, default=None)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Pedido
        fields = [
            'id', 'numero_pedido', 'tipo', 'estado',
            'mesa', 'mesa_numero', 'zona_nombre',
            'usuario_nombre', 'personas',
            'subtotal', 'iva', 'total',
            'fecha_apertura', 'items_count',
        ]
