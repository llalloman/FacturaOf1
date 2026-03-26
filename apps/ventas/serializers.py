from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from .models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta, MovimientoCaja
from apps.clientes.serializers import ClienteSerializer
from apps.productos.serializers import ProductoSerializer
from apps.facturacion.serializers import FacturaSerializer


class CajaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caja
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_creacion']


class AperturaCajaSerializer(serializers.ModelSerializer):
    caja_detalle = CajaSerializer(source='caja', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = AperturaCaja
        fields = '__all__'
        read_only_fields = ['fecha_apertura', 'fecha_cierre', 'usuario']
    
    def create(self, validated_data):
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoSerializer(source='producto', read_only=True)
    
    class Meta:
        model = DetalleVenta
        fields = '__all__'
        read_only_fields = ['venta']


class PagoVentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PagoVenta
        fields = '__all__'
        read_only_fields = ['venta']

    def to_internal_value(self, data):
        # Map metodo_pago → forma_pago BEFORE field validation
        if 'metodo_pago' in data and 'forma_pago' not in data:
            data = dict(data)
            data['forma_pago'] = data.pop('metodo_pago')
        return super().to_internal_value(data)


class VentaSerializer(serializers.ModelSerializer):
    cliente_detalle = ClienteSerializer(source='cliente', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    caja_nombre = serializers.CharField(source='caja.nombre', read_only=True)
    factura_detalle = FacturaSerializer(source='factura', read_only=True)
    detalles = DetalleVentaSerializer(many=True)
    pagos = PagoVentaSerializer(many=True)

    class Meta:
        model = Venta
        fields = '__all__'
        read_only_fields = [
            'empresa', 'fecha_venta', 'usuario', 'numero_venta',
            'apertura_caja', 'subtotal', 'subtotal_0', 'subtotal_12',
            'subtotal_15', 'iva', 'total', 'descuento',
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cliente = attrs.get('cliente') or getattr(self.instance, 'cliente', None)
        genera_factura = attrs.get('genera_factura')
        if genera_factura and cliente:
            detalles = attrs.get('detalles', [])
            total_estimado = sum(
                Decimal(str(item.get('total', 0) or 0))
                for item in detalles
            )
            from apps.facturacion.services.factura_service import (
                MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE,
                cliente_consumidor_final_supera_limite,
            )
            if cliente_consumidor_final_supera_limite(cliente, total_estimado):
                raise serializers.ValidationError({'cliente': MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE})
        return attrs

    def create(self, validated_data):
        import uuid as uuid_lib
        detalles_data = validated_data.pop('detalles')
        pagos_data = validated_data.pop('pagos')

        request = self.context['request']
        caja = validated_data['caja']

        # ── Inyectar campos del contexto ──────────────────────────────────
        # Obtener empresa desde la caja (funciona para SUPER_ADMIN sin empresa y para tenant users)
        validated_data['empresa'] = caja.empresa
        validated_data['usuario'] = request.user
        validated_data['numero_venta'] = f"V-{uuid_lib.uuid4().hex[:8].upper()}"

        # ── Buscar o crear apertura de caja ───────────────────────────────
        apertura = AperturaCaja.objects.filter(caja=caja, estado='ABIERTA').first()
        if not apertura:
            apertura = AperturaCaja.objects.create(
                caja=caja,
                usuario=request.user,
                estado='ABIERTA',
                monto_apertura=Decimal('0.00'),
            )
        validated_data['apertura_caja'] = apertura

        # ── Calcular totales desde los detalles ───────────────────────────
        subtotal = Decimal('0')
        subtotal_0 = Decimal('0')
        subtotal_12 = Decimal('0')
        subtotal_15 = Decimal('0')
        iva_total = Decimal('0')

        for d in detalles_data:
            sub = Decimal(str(d.get('subtotal', Decimal(str(d['cantidad'])) * Decimal(str(d['precio_unitario']))))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            iva_d = Decimal(str(d.get('iva', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            subtotal += sub
            iva_total += iva_d
            producto = d.get('producto')
            pct = getattr(producto, 'porcentaje_iva', '2') if producto else '2'
            if pct == '4':
                subtotal_15 += sub
            elif pct in ('0', '6', '7'):
                subtotal_0 += sub
            else:
                subtotal_12 += sub

        validated_data['subtotal'] = subtotal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        validated_data['subtotal_0'] = subtotal_0.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        validated_data['subtotal_12'] = subtotal_12.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        validated_data['subtotal_15'] = subtotal_15.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        validated_data['iva'] = iva_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        validated_data['total'] = (subtotal + iva_total).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        validated_data.setdefault('descuento', Decimal('0.00'))

        # ── Crear venta ───────────────────────────────────────────────────
        venta = Venta.objects.create(**validated_data)

        for detalle_data in detalles_data:
            DetalleVenta.objects.create(venta=venta, **detalle_data)

        for pago_data in pagos_data:
            PagoVenta.objects.create(venta=venta, **pago_data)

        # ── Auto-generar factura electrónica si se solicitó ───────────────
        if venta.genera_factura:
            # Validar readiness fiscal (onboarding)
            empresa = venta.empresa
            if not getattr(empresa, 'onboarding_completado', False):
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'empresa': 'Debes completar la configuración fiscal de tu empresa para emitir facturas electrónicas.'})
            try:
                from apps.facturacion.services.factura_service import (
                    crear_factura_desde_venta, procesar_factura_sri,
                )
                factura = crear_factura_desde_venta(venta)
                procesar_factura_sri(factura)
            except Exception:
                # La venta se guarda correctamente aunque la factura falle
                pass

        return venta


class VentaSyncSerializer(serializers.Serializer):
    """Serializer para sincronización de ventas offline"""
    uuid = serializers.UUIDField()
    numero_venta = serializers.CharField(max_length=50)
    empresa_id = serializers.IntegerField()
    caja_id = serializers.IntegerField()
    usuario_id = serializers.IntegerField()
    cliente_id = serializers.IntegerField()
    fecha_venta = serializers.DateTimeField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    descuento = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    iva = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    detalles = DetalleVentaSerializer(many=True)
    pagos = PagoVentaSerializer(many=True)
    
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        pagos_data = validated_data.pop('pagos')
        
        # Verificar si ya existe por UUID
        uuid_venta = validated_data.pop('uuid')
        venta, created = Venta.objects.get_or_create(
            uuid=uuid_venta,
            defaults=validated_data
        )
        
        if created:
            # Crear detalles y pagos solo si es nueva
            for detalle_data in detalles_data:
                DetalleVenta.objects.create(venta=venta, **detalle_data)
            
            for pago_data in pagos_data:
                PagoVenta.objects.create(venta=venta, **pago_data)
        
        return venta


class MovimientoCajaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = MovimientoCaja
        fields = '__all__'
        read_only_fields = ['fecha_movimiento', 'usuario']
    
    def create(self, validated_data):
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)
