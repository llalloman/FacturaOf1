from rest_framework import serializers
from .models import Cotizacion, ItemCotizacion


class ItemCotizacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCotizacion
        fields = [
            'id', 'cotizacion', 'producto', 'descripcion', 'codigo',
            'cantidad', 'precio_unitario', 'descuento', 'tarifa_iva',
            'precio_total_sin_impuesto', 'valor_iva',
        ]
        read_only_fields = ['cotizacion', 'precio_total_sin_impuesto', 'valor_iva']


class CotizacionSerializer(serializers.ModelSerializer):
    items       = ItemCotizacionSerializer(many=True, read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    creado_por_nombre = serializers.SerializerMethodField()
    dias_validez = serializers.SerializerMethodField()

    class Meta:
        model = Cotizacion
        fields = [
            'id', 'empresa', 'cliente', 'cliente_nombre', 'creado_por', 'creado_por_nombre',
            'numero', 'fecha_emision', 'fecha_validez', 'dias_validez',
            'subtotal', 'descuento_total', 'subtotal_iva_0', 'subtotal_iva_12', 'subtotal_iva_15',
            'iva', 'total', 'estado', 'observaciones', 'condiciones',
            'factura', 'created_at', 'updated_at', 'items',
        ]
        read_only_fields = [
            'empresa', 'creado_por', 'subtotal', 'descuento_total',
            'subtotal_iva_0', 'subtotal_iva_12', 'subtotal_iva_15',
            'iva', 'total', 'created_at', 'updated_at',
        ]

    def get_cliente_nombre(self, obj):
        return obj.cliente.razon_social

    def get_creado_por_nombre(self, obj):
        if obj.creado_por:
            return f"{obj.creado_por.first_name} {obj.creado_por.last_name}".strip() or obj.creado_por.email
        return None

    def get_dias_validez(self, obj):
        if obj.fecha_validez:
            from django.utils import timezone
            return (obj.fecha_validez - timezone.now().date()).days
        return None


class CotizacionCreateSerializer(serializers.ModelSerializer):
    items = ItemCotizacionSerializer(many=True)

    class Meta:
        model = Cotizacion
        fields = [
            'cliente', 'numero', 'fecha_emision', 'fecha_validez',
            'estado', 'observaciones', 'condiciones', 'items',
        ]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('La cotización debe tener al menos un ítem.')
        return value

    def validate_cliente(self, value):
        if not value.activo:
            raise serializers.ValidationError('No se puede usar un cliente inactivo para nuevas cotizaciones.')
        return value

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        validated_data['empresa'] = request.user.empresa
        validated_data['creado_por'] = request.user

        # Auto-number
        if not validated_data.get('numero'):
            from django.db.models import Count
            count = Cotizacion.objects.filter(empresa=validated_data['empresa']).count()
            validated_data['numero'] = str(count + 1).zfill(6)

        cotizacion = Cotizacion.objects.create(**validated_data)
        for item_data in items_data:
            ItemCotizacion.objects.create(cotizacion=cotizacion, **item_data)
        cotizacion.recalcular_totales()
        return cotizacion

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                ItemCotizacion.objects.create(cotizacion=instance, **item_data)
            instance.recalcular_totales()
        return instance
