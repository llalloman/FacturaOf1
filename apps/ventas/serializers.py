from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from django.db import transaction
import logging
from .models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta, MovimientoCaja
from apps.clientes.serializers import ClienteSerializer
from apps.productos.serializers import ProductoSerializer
from apps.facturacion.serializers import FacturaSerializer
from apps.empresas.models import Establecimiento, PuntoEmision
from apps.core.permissions import is_platform_user
from apps.core.tenant import active_empresa, require_active_empresa
from apps.facturacion.pricing import calculate_line


logger = logging.getLogger(__name__)


class CajaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caja
        fields = '__all__'
        read_only_fields = ['empresa', 'fecha_creacion']

    def validate(self, attrs):
        empresa = active_empresa(self.context.get('request'))
        bodega = attrs.get('bodega') or getattr(self.instance, 'bodega', None)
        if empresa and bodega and bodega.empresa_id != empresa.id:
            raise serializers.ValidationError({'bodega': 'La bodega no pertenece a la empresa activa.'})
        return attrs


class AperturaCajaSerializer(serializers.ModelSerializer):
    caja_detalle = CajaSerializer(source='caja', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = AperturaCaja
        fields = '__all__'
        read_only_fields = ['fecha_apertura', 'fecha_cierre', 'usuario']
    
    @transaction.atomic
    def create(self, validated_data):
        empresa = require_active_empresa(self.context.get('request'))
        caja = Caja.objects.select_for_update().get(pk=validated_data['caja'].pk)
        if caja.empresa_id != empresa.id:
            raise serializers.ValidationError({'caja': 'La caja no pertenece a la empresa activa.'})
        if caja.aperturas.filter(estado=AperturaCaja.EstadoChoices.ABIERTA).exists():
            raise serializers.ValidationError({'caja': 'La caja ya tiene una apertura activa.'})
        validated_data['caja'] = caja
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)

    def validate(self, attrs):
        request = self.context.get('request')
        empresa = active_empresa(request)
        caja = attrs.get('caja') or getattr(self.instance, 'caja', None)
        if empresa and caja and caja.empresa_id != empresa.id:
            raise serializers.ValidationError({'caja': 'La caja no pertenece a la empresa activa.'})
        return attrs


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
    establecimiento_id = serializers.PrimaryKeyRelatedField(
        source='establecimiento_fiscal', queryset=Establecimiento.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    punto_emision_id = serializers.PrimaryKeyRelatedField(
        source='punto_emision_fiscal', queryset=PuntoEmision.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
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
            'empresa', 'usuario', 'numero_venta',
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
        empresa_contexto = active_empresa(self.context.get('request'))
        cliente = attrs.get('cliente') or getattr(self.instance, 'cliente', None)
        genera_factura = attrs.get('genera_factura')
        caja = attrs.get('caja') or getattr(self.instance, 'caja', None)
        if empresa_contexto and caja and caja.empresa_id != empresa_contexto.id:
            raise serializers.ValidationError({'caja': 'La caja no pertenece a la empresa activa.'})
        empresa_operacion = caja.empresa if caja else empresa_contexto
        if empresa_operacion and cliente and cliente.empresa_id != empresa_operacion.id:
            raise serializers.ValidationError({'cliente': 'El cliente no pertenece a la empresa de la caja.'})
        establecimiento = attrs.get('establecimiento_fiscal')
        punto_emision = attrs.get('punto_emision_fiscal')
        if establecimiento or punto_emision:
            if not establecimiento or not punto_emision:
                raise serializers.ValidationError({'establecimiento_id': 'Establecimiento y punto de emisión deben enviarse juntos.'})
            if caja and (establecimiento.empresa_id != caja.empresa_id or punto_emision.empresa_id != caja.empresa_id or punto_emision.establecimiento_id != establecimiento.id):
                raise serializers.ValidationError({'punto_emision_id': 'El contexto fiscal no pertenece a la empresa de la caja.'})
            if not establecimiento.activo or not punto_emision.activo:
                raise serializers.ValidationError({'punto_emision_id': 'El contexto fiscal está inactivo.'})
        detalles = attrs.get('detalles', [])
        pagos = attrs.get('pagos', [])
        if cliente and not cliente.activo:
            raise serializers.ValidationError({'cliente': 'No se puede usar un cliente inactivo para nuevas ventas.'})
        if not detalles:
            raise serializers.ValidationError({'detalles': 'Agrega al menos un producto o servicio.'})
        if not pagos:
            raise serializers.ValidationError({'pagos': 'Registra al menos un pago.'})
        for index, detalle in enumerate(detalles):
            producto = detalle.get('producto')
            if not producto:
                raise serializers.ValidationError({'detalles': {index: {'producto': 'El producto es obligatorio.'}}})
            if empresa_operacion and producto.empresa_id != empresa_operacion.id:
                raise serializers.ValidationError({'detalles': {index: {'producto': 'El producto no pertenece a la empresa de la caja.'}}})
            bodega = detalle.get('bodega')
            if bodega and empresa_operacion and bodega.empresa_id != empresa_operacion.id:
                raise serializers.ValidationError({'detalles': {index: {'bodega': 'La bodega no pertenece a la empresa de la caja.'}}})
            proveedor = detalle.get('proveedor')
            if proveedor and empresa_operacion and proveedor.empresa_id != empresa_operacion.id:
                raise serializers.ValidationError({'detalles': {index: {'proveedor': 'El proveedor no pertenece a la empresa de la caja.'}}})
            if detalle.get('cantidad') <= 0:
                raise serializers.ValidationError({'detalles': {index: {'cantidad': 'Debe ser mayor que cero.'}}})
            tarifa = producto.get_tarifa_iva() if producto.aplica_iva else Decimal('0.00')
            calculo = calculate_line(
                detalle.get('cantidad'),
                detalle.get('precio_unitario'),
                detalle.get('descuento', 0),
                tarifa,
            )
            if calculo['precio_total_sin_impuesto'] < 0:
                raise serializers.ValidationError({'detalles': {index: {'descuento': 'El descuento no puede superar el importe bruto de la línea.'}}})
            # Los importes fiscales se derivan siempre del precio bruto y del
            # descuento monetario; nunca se aceptan como una segunda fuente.
            detalle.update({
                'subtotal': calculo['precio_total_sin_impuesto'],
                'iva': calculo['valor_impuesto'],
                'total': calculo['total'],
                'descuento': calculo['descuento'],
            })
        total_detalles = sum((detalle['total'] for detalle in detalles), Decimal('0.00')).quantize(Decimal('0.01'))
        for index, pago in enumerate(pagos):
            if pago.get('monto', Decimal('0')) <= 0:
                raise serializers.ValidationError({'pagos': {index: {'monto': 'Debe ser mayor que cero.'}}})
            forma_pago = pago.get('forma_pago')
            cuenta = pago.get('cuenta_bancaria')
            if forma_pago != 'CREDITO':
                if not cuenta:
                    raise serializers.ValidationError({'pagos': f'El pago #{index + 1} requiere una cuenta destino.'})
                if not cuenta.activa:
                    raise serializers.ValidationError({'pagos': f'La cuenta destino del pago #{index + 1} está inactiva.'})
                if caja and cuenta.empresa_id != caja.empresa_id:
                    raise serializers.ValidationError({'pagos': f'La cuenta destino del pago #{index + 1} no pertenece a la empresa de la caja.'})
        total_pagos = sum((pago['monto'] for pago in pagos), Decimal('0.00')).quantize(Decimal('0.01'))
        if total_pagos != total_detalles:
            raise serializers.ValidationError({'pagos': 'La suma de pagos debe coincidir con el total de la venta.'})
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

    @transaction.atomic
    def create(self, validated_data):
        import uuid as uuid_lib
        detalles_data = validated_data.pop('detalles')
        pagos_data = validated_data.pop('pagos')

        request = self.context['request']
        caja = validated_data['caja']
        empresa_contexto = require_active_empresa(request)
        if caja.empresa_id != empresa_contexto.id:
            raise serializers.ValidationError({'caja': 'La caja no pertenece a la empresa activa.'})

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
            relacion = None
            if producto:
                from apps.proveedores.models import ProveedorProducto
                relacion = ProveedorProducto.objects.filter(
                    empresa=caja.empresa,
                    producto=producto,
                    activo=True,
                ).order_by('-es_preferido', 'id').first()
            if producto and not detalle_data.get('costo_unitario'):
                detalle_data['costo_unitario'] = (
                    relacion.costo_referencia if relacion else producto.costo
                )
            if producto and producto.tipo == 'BIEN' and producto.maneja_inventario:
                detalle_data.setdefault('bodega', caja.bodega)
            else:
                detalle_data['bodega'] = None
            if relacion:
                detalle_data.setdefault('proveedor', relacion.proveedor)
            DetalleVenta.objects.create(venta=venta, **detalle_data)

        for pago_data in pagos_data:
            pago_data.setdefault('fecha_pago', venta.fecha_venta)
            pago_data['estado_pago'] = PagoVenta.EstadoPagoChoices.PENDIENTE
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
        from apps.ventas.inventory import registrar_inventario_venta
        registrar_inventario_venta(venta)
        registrar_finanzas_venta(venta)

        return venta


class VentaSyncDetalleSerializer(serializers.Serializer):
    """Payload estable del detalle producido por el POS offline."""
    producto_id = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=6)
    descuento = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    iva = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    costo_unitario = serializers.DecimalField(max_digits=12, decimal_places=6, required=False, default=0)


class VentaSyncPagoSerializer(serializers.Serializer):
    """Acepta las formas de pago del POS y las normaliza al modelo."""
    metodo_pago = serializers.CharField(required=False)
    forma_pago = serializers.CharField(required=False)
    monto = serializers.DecimalField(max_digits=12, decimal_places=2)
    referencia = serializers.CharField(required=False, allow_blank=True, default='')
    cuenta_bancaria = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get('monto', Decimal('0')) <= 0:
            raise serializers.ValidationError({'monto': 'Debe ser mayor que cero.'})
        forma = attrs.get('forma_pago') or attrs.get('metodo_pago')
        equivalencias = {
            'TARJETA': 'TARJETA_DEBITO',
            'TARJETA_DEBITO': 'TARJETA_DEBITO',
            'TARJETA_CREDITO': 'TARJETA_CREDITO',
            'EFECTIVO': 'EFECTIVO',
            'TRANSFERENCIA': 'TRANSFERENCIA',
            'CHEQUE': 'CHEQUE',
            'CREDITO': 'CREDITO',
        }
        forma_normalizada = equivalencias.get(str(forma or '').upper())
        if not forma_normalizada:
            raise serializers.ValidationError({'metodo_pago': 'Forma de pago no soportada.'})
        attrs['forma_pago'] = forma_normalizada
        return attrs


class VentaSyncSerializer(serializers.Serializer):
    """Serializer para sincronización de ventas offline"""
    uuid = serializers.UUIDField()
    numero_venta = serializers.CharField(max_length=50)
    empresa_id = serializers.IntegerField()
    caja_id = serializers.IntegerField()
    usuario_id = serializers.IntegerField()
    cliente_id = serializers.IntegerField()
    bodega_id = serializers.IntegerField(required=False)
    establecimiento_id = serializers.IntegerField(required=False, allow_null=True)
    punto_emision_id = serializers.IntegerField(required=False, allow_null=True)
    genera_factura = serializers.BooleanField(required=False, default=False)
    fecha_venta = serializers.DateTimeField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    descuento = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    iva = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    detalles = VentaSyncDetalleSerializer(many=True)
    pagos = VentaSyncPagoSerializer(many=True)

    def validate(self, attrs):
        from apps.clientes.models import Cliente
        from apps.empresas.models import Empresa
        from apps.inventarios.models import Bodega
        from apps.productos.models import Producto
        from apps.empresas.models import Establecimiento, PuntoEmision

        request = self.context.get('request')
        user = getattr(request, 'user', None)
        empresa = Empresa.objects.filter(pk=attrs['empresa_id'], activa=True).first()
        if not empresa:
            raise serializers.ValidationError({'empresa_id': 'La empresa no existe o está inactiva.'})
        if not user or not user.is_authenticated:
            raise serializers.ValidationError({'detail': 'La sincronización requiere autenticación.'})
        if getattr(request, 'tenant', None) and request.tenant.id != empresa.id:
            raise serializers.ValidationError({'empresa_id': 'La empresa no coincide con el contexto activo.'})
        if not is_platform_user(user, 'pos') and not getattr(user, 'tiene_acceso_empresa', lambda _id: False)(empresa):
            raise serializers.ValidationError({'empresa_id': 'La empresa no pertenece al contexto del usuario.'})

        caja = Caja.objects.filter(pk=attrs['caja_id'], empresa=empresa, activa=True).select_related('bodega').first()
        if not caja:
            raise serializers.ValidationError({'caja_id': 'La caja no pertenece a la empresa o está inactiva.'})
        bodega_id = attrs.get('bodega_id') or caja.bodega_id
        bodega = Bodega.objects.filter(pk=bodega_id, empresa=empresa, activa=True).first()
        if not bodega:
            raise serializers.ValidationError({'bodega_id': 'La bodega no pertenece a la empresa o está inactiva.'})
        cliente = Cliente.objects.filter(pk=attrs['cliente_id'], empresa=empresa, activo=True).first()
        if not cliente:
            raise serializers.ValidationError({'cliente_id': 'El cliente no pertenece a la empresa o está inactivo.'})
        apertura = AperturaCaja.objects.filter(
            caja=caja, estado=AperturaCaja.EstadoChoices.ABIERTA,
        ).order_by('-fecha_apertura').first()
        if not apertura:
            raise serializers.ValidationError({'caja_id': 'La caja no tiene una apertura activa.'})

        establecimiento = None
        punto_emision = None
        if attrs.get('establecimiento_id') or attrs.get('punto_emision_id'):
            if not attrs.get('establecimiento_id') or not attrs.get('punto_emision_id'):
                raise serializers.ValidationError({'establecimiento_id': 'Establecimiento y punto de emisión deben enviarse juntos.'})
            establecimiento = Establecimiento.objects.filter(pk=attrs['establecimiento_id'], empresa=empresa, activo=True).first()
            punto_emision = PuntoEmision.objects.filter(pk=attrs['punto_emision_id'], empresa=empresa, establecimiento=establecimiento, activo=True).first()
            if not establecimiento or not punto_emision:
                raise serializers.ValidationError({'punto_emision_id': 'El contexto fiscal no pertenece a la empresa o está inactivo.'})

        productos = {}
        if not attrs['detalles']:
            raise serializers.ValidationError({'detalles': 'Agrega al menos un producto o servicio.'})
        if not attrs['pagos']:
            raise serializers.ValidationError({'pagos': 'Registra al menos un pago.'})
        for index, detalle in enumerate(attrs['detalles']):
            producto = Producto.objects.filter(pk=detalle['producto_id'], empresa=empresa, activo=True).first()
            if not producto:
                raise serializers.ValidationError({'detalles': {index: {'producto_id': 'Producto inválido para la empresa.'}}})
            if detalle['cantidad'] <= 0:
                raise serializers.ValidationError({'detalles': {index: {'cantidad': 'Debe ser mayor que cero.'}}})
            if detalle['precio_unitario'] < 0:
                raise serializers.ValidationError({'detalles': {index: {'precio_unitario': 'No puede ser negativo.'}}})
            if detalle['descuento'] < 0:
                raise serializers.ValidationError({'detalles': {index: {'descuento': 'No puede ser negativo.'}}})
            tarifa_por_codigo = {
                '0': Decimal('0.00'), '2': Decimal('12.00'), '3': Decimal('14.00'),
                '4': Decimal('15.00'), '6': Decimal('0.00'), '7': Decimal('0.00'),
            }
            esperado = calculate_line(
                detalle['cantidad'],
                detalle['precio_unitario'],
                detalle['descuento'],
                tarifa_por_codigo.get(producto.porcentaje_iva, Decimal('0.00'))
                if producto.aplica_iva else Decimal('0.00'),
            )
            subtotal_enviado = Decimal(str(detalle['subtotal'])).quantize(Decimal('0.01'))
            iva_enviado = Decimal(str(detalle.get('iva', 0))).quantize(Decimal('0.01'))
            total_enviado = Decimal(str(detalle['total'])).quantize(Decimal('0.01'))
            if subtotal_enviado != esperado['precio_total_sin_impuesto']:
                raise serializers.ValidationError({'detalles': {index: {
                    'subtotal': 'Debe ser cantidad x precio unitario bruto menos descuento.'
                }}})
            if iva_enviado != esperado['valor_impuesto'] or total_enviado != esperado['total']:
                raise serializers.ValidationError({'detalles': {index: {
                    'total': 'El IVA y total deben calcularse desde la base neta de la línea.'
                }}})
            productos[producto.id] = producto

        for index, pago in enumerate(attrs['pagos']):
            cuenta_id = pago.get('cuenta_bancaria')
            if cuenta_id:
                from apps.bancos.models import CuentaBancaria
                if not CuentaBancaria.objects.filter(pk=cuenta_id, empresa=empresa, activa=True).exists():
                    raise serializers.ValidationError({'pagos': {index: {'cuenta_bancaria': 'Cuenta inválida para la empresa.'}}})

        attrs['_empresa'] = empresa
        attrs['_caja'] = caja
        attrs['_bodega'] = bodega
        attrs['_cliente'] = cliente
        attrs['_apertura'] = apertura
        attrs['_productos'] = productos
        attrs['_establecimiento'] = establecimiento
        attrs['_punto_emision'] = punto_emision
        return attrs
    
    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        pagos_data = validated_data.pop('pagos')
        empresa = validated_data.pop('_empresa')
        caja = validated_data.pop('_caja')
        bodega = validated_data.pop('_bodega')
        cliente = validated_data.pop('_cliente')
        apertura = validated_data.pop('_apertura')
        productos = validated_data.pop('_productos')
        establecimiento = validated_data.pop('_establecimiento', None)
        punto_emision = validated_data.pop('_punto_emision', None)
        uuid_venta = validated_data.pop('uuid')

        existente = Venta.objects.filter(uuid=uuid_venta).first()
        if existente:
            conflicto = (
                existente.empresa_id != empresa.id
                or existente.numero_venta != validated_data.get('numero_venta')
                or Decimal(str(existente.total)).quantize(Decimal('0.01')) != Decimal(str(validated_data.get('total'))).quantize(Decimal('0.01'))
                or existente.establecimiento_fiscal_id != (establecimiento.id if establecimiento else None)
                or existente.punto_emision_fiscal_id != (punto_emision.id if punto_emision else None)
            )
            if conflicto:
                raise serializers.ValidationError({
                    'uuid': 'Conflicto de sincronización: el UUID ya existe con datos distintos.'
                })
            existente._sync_created = False
            return existente

        subtotal = sum((d['subtotal'] for d in detalles_data), Decimal('0.00')).quantize(Decimal('0.01'))
        descuento = sum((d['descuento'] for d in detalles_data), Decimal('0.00')).quantize(Decimal('0.01'))
        iva = sum((d['iva'] for d in detalles_data), Decimal('0.00')).quantize(Decimal('0.01'))
        total_calculado = (subtotal + iva).quantize(Decimal('0.01'))
        total_cliente = Decimal(str(validated_data['total'])).quantize(Decimal('0.01'))
        total_pagos = sum((p['monto'] for p in pagos_data), Decimal('0.00')).quantize(Decimal('0.01'))
        if total_pagos != total_cliente:
            raise serializers.ValidationError({'pagos': 'La suma de pagos debe coincidir con el total de la venta.'})
        descuento_cabecera = Decimal(str(validated_data.get('descuento', 0))).quantize(Decimal('0.01'))
        if descuento != descuento_cabecera:
            raise serializers.ValidationError({'descuento': 'Debe coincidir con la suma de descuentos de las líneas.'})
        if abs(total_calculado - total_cliente) > Decimal('0.01'):
            raise serializers.ValidationError({'total': 'El total no coincide con los detalles.'})

        subtotal_0 = Decimal('0.00')
        subtotal_12 = Decimal('0.00')
        subtotal_15 = Decimal('0.00')
        for detalle in detalles_data:
            producto = productos[detalle['producto_id']]
            if producto.porcentaje_iva in ('0', '6', '7'):
                subtotal_0 += detalle['subtotal']
            elif producto.porcentaje_iva == '4':
                subtotal_15 += detalle['subtotal']
            else:
                subtotal_12 += detalle['subtotal']

        tipo_venta = 'CREDITO' if any(p['forma_pago'] == 'CREDITO' for p in pagos_data) else 'MOSTRADOR'
        venta = Venta.objects.create(
            uuid=uuid_venta,
            empresa=empresa,
            caja=caja,
            apertura_caja=apertura,
            usuario=self.context['request'].user,
            cliente=cliente,
            tipo_venta=tipo_venta,
            estado='COMPLETADA',
            numero_venta=validated_data['numero_venta'],
            fecha_venta=validated_data['fecha_venta'],
            subtotal=subtotal,
            descuento=descuento,
            subtotal_0=subtotal_0.quantize(Decimal('0.01')),
            subtotal_12=subtotal_12.quantize(Decimal('0.01')),
            subtotal_15=subtotal_15.quantize(Decimal('0.01')),
            iva=iva,
            total=total_calculado,
            genera_factura=validated_data.get('genera_factura', False),
            establecimiento_fiscal=establecimiento,
            punto_emision_fiscal=punto_emision,
            sincronizada=True,
            fecha_sincronizacion=timezone.now(),
        )

        for detalle_data in detalles_data:
            producto = productos[detalle_data['producto_id']]
            DetalleVenta.objects.create(
                venta=venta,
                producto=producto,
                bodega=bodega if producto.tipo == 'BIEN' and producto.maneja_inventario else None,
                cantidad=detalle_data['cantidad'],
                precio_unitario=detalle_data['precio_unitario'],
                descuento=detalle_data['descuento'],
                subtotal=detalle_data['subtotal'],
                iva=detalle_data['iva'],
                total=detalle_data['total'],
                costo_unitario=detalle_data.get('costo_unitario') or producto.costo,
            )

        for pago_data in pagos_data:
            PagoVenta.objects.create(
                venta=venta,
                forma_pago=pago_data['forma_pago'],
                monto=pago_data['monto'],
                referencia=pago_data.get('referencia', ''),
                cuenta_bancaria_id=pago_data.get('cuenta_bancaria'),
                estado_pago=PagoVenta.EstadoPagoChoices.PENDIENTE,
            )

        from apps.ventas.inventory import registrar_inventario_venta
        from apps.ventas.finance import registrar_finanzas_venta
        registrar_inventario_venta(venta)
        registrar_finanzas_venta(venta)

        # La venta offline queda registrada aun cuando el SRI esté caído. Si
        # se solicitó factura, se intenta crear/procesar aquí y el comprobante
        # pendiente queda disponible para el reintento automático de
        # facturación, sin perder la intención original del POS.
        if venta.genera_factura:
            try:
                from apps.facturacion.services.factura_service import (
                    crear_factura_desde_venta, procesar_factura_sri,
                )
                factura = crear_factura_desde_venta(venta)
                procesar_factura_sri(factura)
                venta.refresh_from_db(fields=['factura'])
            except Exception as exc:
                logger.exception(
                    'No se pudo procesar factura solicitada por POS offline para %s: %s',
                    venta.numero_venta,
                    exc,
                )
        venta._sync_created = True
        return venta


class MovimientoCajaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = MovimientoCaja
        fields = '__all__'
        read_only_fields = ['fecha_movimiento', 'usuario']

    def validate(self, attrs):
        empresa = active_empresa(self.context.get('request'))
        apertura = attrs.get('apertura_caja') or getattr(self.instance, 'apertura_caja', None)
        if empresa and apertura and apertura.caja.empresa_id != empresa.id:
            raise serializers.ValidationError({'apertura_caja': 'La apertura no pertenece a la empresa activa.'})
        return attrs
    
    def create(self, validated_data):
        empresa = require_active_empresa(self.context.get('request'))
        if validated_data['apertura_caja'].caja.empresa_id != empresa.id:
            raise serializers.ValidationError({'apertura_caja': 'La apertura no pertenece a la empresa activa.'})
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)
