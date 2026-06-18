from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
import logging
from .models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta, MovimientoCaja
from apps.clientes.serializers import ClienteSerializer
from apps.productos.serializers import ProductoSerializer
from apps.facturacion.serializers import FacturaSerializer


logger = logging.getLogger(__name__)


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
        read_only_fields = ['venta', 'movimiento_bancario', 'fecha_pago']

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
    tipo_documento = serializers.SerializerMethodField()
    estado_documento = serializers.SerializerMethodField()
    total_facturado = serializers.SerializerMethodField()
    diferencia_vs_factura = serializers.SerializerMethodField()
    costo_total = serializers.SerializerMethodField()
    utilidad_bruta = serializers.SerializerMethodField()
    margen_bruto = serializers.SerializerMethodField()
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

    def get_tipo_documento(self, obj):
        return 'FACTURA' if obj.factura_id else 'NOTA_VENTA'

    def get_estado_documento(self, obj):
        if not obj.factura_id:
            return 'NOTA_VENTA'
        comp = getattr(obj.factura, 'comprobante', None)
        return getattr(comp, 'estado', 'SIN_COMPROBANTE')

    def get_total_facturado(self, obj):
        if not obj.factura_id:
            return None
        return obj.factura.total

    def get_diferencia_vs_factura(self, obj):
        if not obj.factura_id:
            return None
        total_venta = Decimal(str(obj.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_factura = Decimal(str(obj.factura.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return (total_venta - total_factura).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_costo_total(self, obj):
        total = sum(
            Decimal(str(detalle.costo_unitario or 0)) * Decimal(str(detalle.cantidad or 0))
            for detalle in obj.detalles.all()
        )
        return total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_utilidad_bruta(self, obj):
        costo = self.get_costo_total(obj)
        subtotal = Decimal(str(obj.subtotal or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return (subtotal - costo).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_margen_bruto(self, obj):
        subtotal = Decimal(str(obj.subtotal or 0))
        if subtotal <= 0:
            return Decimal('0.00')
        utilidad = Decimal(str(self.get_utilidad_bruta(obj)))
        return ((utilidad / subtotal) * Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cliente = attrs.get('cliente') or getattr(self.instance, 'cliente', None)
        genera_factura = attrs.get('genera_factura')
        caja = attrs.get('caja') or getattr(self.instance, 'caja', None)
        detalles = attrs.get('detalles', [])
        pagos = attrs.get('pagos', [])
        if cliente and not cliente.activo:
            raise serializers.ValidationError({'cliente': 'No se puede usar un cliente inactivo para nuevas ventas.'})
        if not detalles:
            raise serializers.ValidationError({'detalles': 'Agrega al menos un producto o servicio.'})
        if not pagos:
            raise serializers.ValidationError({'pagos': 'Registra al menos un pago.'})
        for index, pago in enumerate(pagos):
            forma_pago = pago.get('forma_pago')
            cuenta = pago.get('cuenta_bancaria')
            if forma_pago != 'CREDITO':
                if not cuenta:
                    raise serializers.ValidationError({'pagos': f'El pago #{index + 1} requiere una cuenta destino.'})
                if not cuenta.activa:
                    raise serializers.ValidationError({'pagos': f'La cuenta destino del pago #{index + 1} está inactiva.'})
                if caja and cuenta.empresa_id != caja.empresa_id:
                    raise serializers.ValidationError({'pagos': f'La cuenta destino del pago #{index + 1} no pertenece a la empresa de la caja.'})
        if genera_factura and cliente:
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
        descuento_total = Decimal('0')

        for d in detalles_data:
            sub = Decimal(str(d.get('subtotal', Decimal(str(d['cantidad'])) * Decimal(str(d['precio_unitario']))))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            iva_d = Decimal(str(d.get('iva', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            descuento_d = Decimal(str(d.get('descuento', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            subtotal += sub
            iva_total += iva_d
            descuento_total += descuento_d
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
        validated_data['descuento'] = descuento_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # ── Crear venta ───────────────────────────────────────────────────
        venta = Venta.objects.create(**validated_data)

        for detalle_data in detalles_data:
            producto = detalle_data.get('producto')
            if producto and not detalle_data.get('costo_unitario'):
                detalle_data['costo_unitario'] = producto.costo
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
                venta.refresh_from_db(fields=['factura'])
            except Exception as exc:
                # La venta queda registrada; el error se registra para gestion SRI posterior.
                logger.exception(
                    'No se pudo generar/procesar factura SRI para la venta %s: %s',
                    venta.numero_venta,
                    exc,
                )

        from apps.ventas.finance import registrar_finanzas_venta
        registrar_finanzas_venta(venta)

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
