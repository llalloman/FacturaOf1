from decimal import Decimal, ROUND_HALF_UP
from rest_framework import serializers
from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    precio_con_iva = serializers.SerializerMethodField(read_only=True)
    modo_precio = serializers.ChoiceField(
        choices=['SIN_IVA', 'CON_IVA'],
        write_only=True,
        required=False,
        default='SIN_IVA',
    )
    precio_con_iva_input = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Producto
        fields = [
            'id', 'empresa', 'codigo_principal', 'codigo_auxiliar', 'tipo', 'nombre',
            'descripcion', 'precio', 'precio_con_iva', 'precio_con_iva_input', 'modo_precio',
            'precio_minimo', 'costo', 'aplica_iva', 'porcentaje_iva', 'maneja_inventario',
            'stock_actual', 'stock_minimo', 'activo', 'imagen', 'fecha_creacion',
            'fecha_modificacion',
        ]
        read_only_fields = ['empresa', 'fecha_creacion', 'fecha_modificacion']

    def get_precio_con_iva(self, obj):
        return obj.calcular_precio_con_iva()

    def validate_codigo_principal(self, value):
        """Validar que el código sea único para la empresa"""
        request = self.context.get('request')
        empresa = None
        if request:
            empresa = getattr(request, 'tenant', None) or getattr(getattr(request, 'user', None), 'empresa', None)
            user = getattr(request, 'user', None)
            empresa_id = request.headers.get('X-Empresa-ID')
            if not empresa and empresa_id and getattr(user, 'es_super_admin', False):
                from apps.empresas.models import Empresa
                empresa = Empresa.objects.filter(id=empresa_id).first()
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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        modo_precio = attrs.pop('modo_precio', None)
        precio_con_iva_input = attrs.pop('precio_con_iva_input', None)

        aplica_iva = attrs.get('aplica_iva', getattr(self.instance, 'aplica_iva', True))
        porcentaje_iva = attrs.get('porcentaje_iva', getattr(self.instance, 'porcentaje_iva', '4'))

        if modo_precio == 'CON_IVA':
            if precio_con_iva_input is None:
                raise serializers.ValidationError({'precio_con_iva_input': 'Ingrese el precio final con IVA.'})
            attrs['precio'] = Producto.calcular_precio_sin_iva_desde_total(
                precio_con_iva_input,
                aplica_iva,
                porcentaje_iva,
            )
        elif 'precio' in attrs:
            attrs['precio'] = Decimal(str(attrs['precio'])).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        if 'precio_minimo' in attrs and attrs['precio_minimo'] is not None:
            attrs['precio_minimo'] = Decimal(str(attrs['precio_minimo'])).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        tipo = attrs.get('tipo', getattr(self.instance, 'tipo', Producto.TipoChoices.BIEN))
        if tipo == Producto.TipoChoices.SERVICIO:
            attrs['maneja_inventario'] = False
            attrs['stock_actual'] = Decimal('0.00')
            attrs['stock_minimo'] = Decimal('0.00')

        return attrs
