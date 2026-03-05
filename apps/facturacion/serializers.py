from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import ComprobanteElectronico, Factura, DetalleFactura


class DetalleFacturaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.SerializerMethodField()

    class Meta:
        model = DetalleFactura
        fields = [
            'id', 'producto', 'producto_nombre', 'descripcion',
            'cantidad', 'precio_unitario', 'descuento',
            'precio_total_sin_impuesto', 'valor_impuesto',
        ]

    def get_producto_nombre(self, obj):
        if obj.producto:
            return obj.producto.nombre
        return obj.descripcion


class FacturaSerializer(serializers.ModelSerializer):
    # ── Campos de solo lectura proyectados desde comprobante / cliente ──────────
    numero_factura = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    fecha_emision = serializers.SerializerMethodField()
    clave_acceso = serializers.SerializerMethodField()
    numero_autorizacion = serializers.SerializerMethodField()
    fecha_autorizacion = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()

    # ── Salida de detalles (solo lectura) ────────────────────────────────────────
    detalles = DetalleFacturaSerializer(many=True, read_only=True)

    # ── Campos de entrada para creación ─────────────────────────────────────────
    fecha_emision_input = serializers.DateField(write_only=True, required=False)
    detalles_input = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False, default=list
    )

    class Meta:
        model = Factura
        fields = [
            'id', 'cliente', 'cliente_nombre',
            'numero_factura', 'estado',
            'fecha_emision', 'fecha_emision_input',
            'subtotal_sin_impuestos', 'total', 'total_descuento',
            'forma_pago', 'observaciones',
            'clave_acceso', 'numero_autorizacion', 'fecha_autorizacion',
            'detalles', 'detalles_input',
        ]
        read_only_fields = ['subtotal_sin_impuestos', 'total', 'total_descuento']

    # ── Getters proyectados ──────────────────────────────────────────────────────
    def get_numero_factura(self, obj):
        return obj.comprobante.numero_comprobante

    def get_estado(self, obj):
        return obj.comprobante.estado

    def get_fecha_emision(self, obj):
        return obj.comprobante.fecha_emision

    def get_clave_acceso(self, obj):
        return obj.comprobante.clave_acceso

    def get_numero_autorizacion(self, obj):
        return obj.comprobante.numero_autorizacion

    def get_fecha_autorizacion(self, obj):
        return obj.comprobante.fecha_autorizacion

    def get_cliente_nombre(self, obj):
        return obj.cliente.razon_social

    # ── Creación ─────────────────────────────────────────────────────────────────
    def create(self, validated_data):
        from apps.productos.models import Producto
        from apps.facturacion.models import Secuencial

        detalles_data = validated_data.pop('detalles_input', [])
        fecha_raw = validated_data.pop('fecha_emision_input', None)

        request = self.context.get('request')
        empresa = getattr(request, 'tenant', None)
        if not empresa and request and request.user.is_authenticated:
            empresa = getattr(request.user, 'empresa', None)

        if not empresa:
            raise serializers.ValidationError('No hay empresa configurada para este usuario.')

        # ── Secuencial ────────────────────────────────────────────────────────────
        secuencial_obj, _ = Secuencial.objects.get_or_create(
            empresa=empresa,
            tipo_comprobante='01',
            establecimiento=empresa.establecimiento_codigo,
            punto_emision=empresa.punto_emision_codigo,
            defaults={'secuencial_actual': 0},
        )
        siguiente = secuencial_obj.get_siguiente()
        numero_comprobante = (
            f"{empresa.establecimiento_codigo}-"
            f"{empresa.punto_emision_codigo}-"
            f"{siguiente}"
        )

        # ── ComprobanteElectronico ────────────────────────────────────────────────
        if fecha_raw:
            from datetime import datetime, date as date_type
            if isinstance(fecha_raw, date_type):
                fecha_dt = timezone.make_aware(
                    datetime.combine(fecha_raw, datetime.min.time())
                )
            else:
                fecha_dt = timezone.now()
        else:
            fecha_dt = timezone.now()

        comprobante = ComprobanteElectronico.objects.create(
            empresa=empresa,
            usuario_creador=request.user if request else None,
            tipo_comprobante='01',
            establecimiento=empresa.establecimiento_codigo,
            punto_emision=empresa.punto_emision_codigo,
            secuencial=siguiente,
            numero_comprobante=numero_comprobante,
            fecha_emision=fecha_dt,
            estado=ComprobanteElectronico.EstadoChoices.BORRADOR,
        )

        # ── Factura ───────────────────────────────────────────────────────────────
        factura = Factura.objects.create(
            comprobante=comprobante,
            subtotal_sin_impuestos=Decimal('0.00'),
            total=Decimal('0.00'),
            **validated_data,
        )

        # ── Detalles ──────────────────────────────────────────────────────────────
        subtotal_total = Decimal('0.00')
        iva_total = Decimal('0.00')

        for item in detalles_data:
            producto_id = item.get('producto')
            producto = None
            codigo_principal = 'SIN-COD'
            descripcion = item.get('descripcion', 'Ítem')
            tarifa = Decimal('15.00')
            codigo_porcentaje = '4'

            if producto_id:
                try:
                    producto = Producto.objects.get(id=producto_id)
                    codigo_principal = producto.codigo_principal
                    descripcion = producto.nombre
                    if producto.aplica_iva:
                        pct = Decimal(str(producto.porcentaje_iva))
                        tarifa = pct
                        if pct == 0:
                            codigo_porcentaje = '0'
                        elif pct == 12:
                            codigo_porcentaje = '2'
                        elif pct == 14:
                            codigo_porcentaje = '3'
                        elif pct == 15:
                            codigo_porcentaje = '4'
                    else:
                        tarifa = Decimal('0.00')
                        codigo_porcentaje = '0'
                except Producto.DoesNotExist:
                    pass

            cantidad = Decimal(str(item.get('cantidad', 1)))
            precio_unitario = Decimal(str(item.get('precio_unitario', 0)))
            descuento = Decimal(str(item.get('descuento', 0)))

            detalle = DetalleFactura.objects.create(
                factura=factura,
                producto=producto,
                codigo_principal=codigo_principal,
                descripcion=descripcion,
                cantidad=cantidad,
                precio_unitario=precio_unitario,
                descuento=descuento,
                tarifa=tarifa,
                codigo_porcentaje=codigo_porcentaje,
            )
            subtotal_total += detalle.precio_total_sin_impuesto
            iva_total += detalle.valor_impuesto

        # ── Actualizar totales ────────────────────────────────────────────────────
        descuento_gral = Decimal(str(factura.total_descuento or '0.00'))
        factura.subtotal_sin_impuestos = subtotal_total
        factura.total = subtotal_total + iva_total - descuento_gral
        factura.save(update_fields=['subtotal_sin_impuestos', 'total'])

        return factura


class ComprobanteElectronicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComprobanteElectronico
        fields = '__all__'
