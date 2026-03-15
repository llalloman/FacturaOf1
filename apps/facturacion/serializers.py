from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import ComprobanteElectronico, Factura, DetalleFactura, Retencion, ImpuestoRetencion, GuiaRemision, DestinatarioGuia, DetalleGuiaRemision, NotaDebito, DetalleNotaDebito, NotaCredito, DetalleNotaCredito, Secuencial


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
    mensajes_sri = serializers.SerializerMethodField()
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
            'mensajes_sri',
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

    def get_mensajes_sri(self, obj):
        return obj.comprobante.mensajes_sri or ''

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

            # Mapa: código SRI → tarifa real (porcentaje_iva guarda el código SRI, no el %)
            _IVA_TARIFA_MAP = {
                '0': Decimal('0'),
                '2': Decimal('12'),
                '3': Decimal('14'),
                '4': Decimal('15'),
                '6': Decimal('0'),
                '7': Decimal('0'),
            }

            if producto_id:
                try:
                    producto = Producto.objects.get(id=producto_id)
                    codigo_principal = producto.codigo_principal
                    descripcion = producto.nombre
                    if producto.aplica_iva:
                        codigo_porcentaje = producto.porcentaje_iva  # ya es el código SRI ('4', '2', etc.)
                        tarifa = _IVA_TARIFA_MAP.get(codigo_porcentaje, Decimal('15'))
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


# ─── Retención ────────────────────────────────────────────────────────────────

class ImpuestoRetencionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImpuestoRetencion
        fields = [
            'id', 'codigo', 'codigo_porcentaje', 'tarifa',
            'base_imponible', 'valor_retenido',
            'cod_doc_sustento', 'num_doc_sustento', 'fecha_emision_doc_sustento',
        ]


class RetencionSerializer(serializers.ModelSerializer):
    numero_retencion    = serializers.SerializerMethodField()
    estado              = serializers.SerializerMethodField()
    fecha_emision       = serializers.SerializerMethodField()
    numero_autorizacion = serializers.SerializerMethodField()
    mensajes_sri        = serializers.SerializerMethodField()
    proveedor_nombre    = serializers.SerializerMethodField()
    total_retenido      = serializers.SerializerMethodField()
    impuestos           = ImpuestoRetencionSerializer(many=True, read_only=True)

    impuestos_input     = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=True,
    )
    fecha_emision_input = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = Retencion
        fields = [
            'id', 'proveedor', 'proveedor_nombre', 'periodo_fiscal',
            'numero_retencion', 'estado', 'fecha_emision', 'fecha_emision_input',
            'numero_autorizacion', 'mensajes_sri',
            'total_retenido', 'impuestos', 'impuestos_input',
        ]

    def get_numero_retencion(self, obj):    return obj.comprobante.numero_comprobante
    def get_estado(self, obj):              return obj.comprobante.estado
    def get_fecha_emision(self, obj):       return obj.comprobante.fecha_emision
    def get_numero_autorizacion(self, obj): return obj.comprobante.numero_autorizacion
    def get_mensajes_sri(self, obj):        return obj.comprobante.mensajes_sri
    def get_proveedor_nombre(self, obj):    return obj.proveedor.razon_social
    def get_total_retenido(self, obj):      return float(obj.total_retenido)

    def create(self, validated_data):
        from apps.facturacion.services.factura_service import crear_retencion
        from django.utils import timezone as tz
        from datetime import datetime, date

        impuestos_input = validated_data.pop('impuestos_input')
        fecha_input     = validated_data.pop('fecha_emision_input', None)
        proveedor       = validated_data['proveedor']
        periodo_fiscal  = validated_data['periodo_fiscal']

        request = self.context.get('request')
        empresa = getattr(request, 'tenant', None) or getattr(request.user, 'empresa', None)
        usuario = request.user if request else None

        fecha_emision = None
        if fecha_input:
            fecha_emision = tz.make_aware(datetime.combine(fecha_input, datetime.min.time()))

        for imp in impuestos_input:
            if isinstance(imp.get('fecha_emision_doc_sustento'), str):
                imp['fecha_emision_doc_sustento'] = date.fromisoformat(imp['fecha_emision_doc_sustento'])

        return crear_retencion(
            empresa=empresa,
            usuario=usuario,
            proveedor=proveedor,
            periodo_fiscal=periodo_fiscal,
            impuestos_data=impuestos_input,
            fecha_emision=fecha_emision,
        )


# ─── Guía de Remisión ─────────────────────────────────────────────────────────

class DetalleGuiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleGuiaRemision
        fields = ['id', 'codigo_interno', 'descripcion', 'cantidad']


class DestinatarioGuiaSerializer(serializers.ModelSerializer):
    detalles = DetalleGuiaSerializer(many=True, read_only=True)
    detalles_input = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=True,
    )

    class Meta:
        model = DestinatarioGuia
        fields = [
            'id', 'identificacion_destinatario', 'razon_social_destinatario',
            'dir_dest_destinatario', 'motorista_y_ca', 'ruta',
            'cod_doc_sustento', 'num_doc_sustento',
            'fecha_emision_doc_sust', 'num_autorizacion_doc_sust',
            'detalles', 'detalles_input',
        ]


class GuiaRemisionSerializer(serializers.ModelSerializer):
    numero_guia         = serializers.SerializerMethodField()
    estado              = serializers.SerializerMethodField()
    fecha_emision       = serializers.SerializerMethodField()
    numero_autorizacion = serializers.SerializerMethodField()
    mensajes_sri        = serializers.SerializerMethodField()
    destinatarios       = DestinatarioGuiaSerializer(many=True, read_only=True)

    destinatarios_input     = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=True,
    )
    fecha_emision_input     = serializers.DateField(write_only=True, required=False)
    fecha_inicio_transporte = serializers.DateField(required=True)
    fecha_fin_transporte    = serializers.DateField(required=True)

    class Meta:
        model = GuiaRemision
        fields = [
            'id', 'numero_guia', 'estado', 'fecha_emision', 'fecha_emision_input',
            'numero_autorizacion', 'mensajes_sri',
            'ruc_transportista', 'razon_social_transportista', 'placa',
            'fecha_inicio_transporte', 'fecha_fin_transporte', 'dir_partida',
            'destinatarios', 'destinatarios_input',
        ]

    def get_numero_guia(self, obj):         return obj.comprobante.numero_comprobante
    def get_estado(self, obj):              return obj.comprobante.estado
    def get_fecha_emision(self, obj):       return obj.comprobante.fecha_emision
    def get_numero_autorizacion(self, obj): return obj.comprobante.numero_autorizacion
    def get_mensajes_sri(self, obj):        return obj.comprobante.mensajes_sri

    def create(self, validated_data):
        from apps.facturacion.services.factura_service import crear_guia_remision
        from django.utils import timezone as tz
        from datetime import datetime

        destinatarios_input = validated_data.pop('destinatarios_input')
        fecha_input         = validated_data.pop('fecha_emision_input', None)
        ruc_transportista   = validated_data.pop('ruc_transportista')
        razon_social_transp = validated_data.pop('razon_social_transportista')
        placa               = validated_data.pop('placa')
        fecha_inicio        = validated_data.pop('fecha_inicio_transporte')
        fecha_fin           = validated_data.pop('fecha_fin_transporte')
        dir_partida         = validated_data.pop('dir_partida')

        request = self.context.get('request')
        empresa = getattr(request, 'tenant', None) or getattr(request.user, 'empresa', None)
        usuario = request.user if request else None

        fecha_emision = None
        if fecha_input:
            fecha_emision = tz.make_aware(datetime.combine(fecha_input, datetime.min.time()))

        return crear_guia_remision(
            empresa=empresa,
            usuario=usuario,
            ruc_transportista=ruc_transportista,
            razon_social_transportista=razon_social_transp,
            placa=placa,
            fecha_inicio_transporte=fecha_inicio,
            fecha_fin_transporte=fecha_fin,
            dir_partida=dir_partida,
            destinatarios_data=destinatarios_input,
            fecha_emision=fecha_emision,
        )


# ─── Nota de Débito ───────────────────────────────────────────────────────────

class DetalleNotaDebitoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleNotaDebito
        fields = ['id', 'razon', 'valor', 'codigo_porcentaje', 'tarifa', 'valor_impuesto']


class NotaDebitoSerializer(serializers.ModelSerializer):
    numero_nota         = serializers.SerializerMethodField()
    estado              = serializers.SerializerMethodField()
    fecha_emision       = serializers.SerializerMethodField()
    numero_autorizacion = serializers.SerializerMethodField()
    mensajes_sri        = serializers.SerializerMethodField()
    cliente_nombre      = serializers.SerializerMethodField()
    detalles            = DetalleNotaDebitoSerializer(many=True, read_only=True)

    detalles_input      = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=True,
    )
    fecha_emision_input = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = NotaDebito
        fields = [
            'id', 'cliente', 'cliente_nombre', 'factura_origen', 'motivo',
            'numero_nota', 'estado', 'fecha_emision', 'fecha_emision_input',
            'numero_autorizacion', 'mensajes_sri',
            'subtotal_sin_impuestos', 'total',
            'detalles', 'detalles_input',
        ]
        read_only_fields = ['subtotal_sin_impuestos', 'total']

    def get_numero_nota(self, obj):         return obj.comprobante.numero_comprobante
    def get_estado(self, obj):              return obj.comprobante.estado
    def get_fecha_emision(self, obj):       return obj.comprobante.fecha_emision
    def get_numero_autorizacion(self, obj): return obj.comprobante.numero_autorizacion
    def get_mensajes_sri(self, obj):        return obj.comprobante.mensajes_sri
    def get_cliente_nombre(self, obj):      return obj.cliente.razon_social

    def create(self, validated_data):
        from apps.facturacion.services.factura_service import crear_nota_debito
        from django.utils import timezone as tz
        from datetime import datetime

        detalles_input = validated_data.pop('detalles_input')
        fecha_input    = validated_data.pop('fecha_emision_input', None)
        cliente        = validated_data['cliente']
        motivo         = validated_data['motivo']
        factura_origen = validated_data.get('factura_origen')

        request = self.context.get('request')
        empresa = getattr(request, 'tenant', None) or getattr(request.user, 'empresa', None)
        usuario = request.user if request else None

        fecha_emision = None
        if fecha_input:
            fecha_emision = tz.make_aware(datetime.combine(fecha_input, datetime.min.time()))

        return crear_nota_debito(
            empresa=empresa,
            usuario=usuario,
            cliente=cliente,
            motivo=motivo,
            detalles_data=detalles_input,
            factura_origen=factura_origen,
            fecha_emision=fecha_emision,
        )


# ─── Nota de Crédito ──────────────────────────────────────────────────────────

class DetalleNotaCreditoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleNotaCredito
        fields = [
            'id', 'codigo_principal', 'descripcion', 'cantidad',
            'precio_unitario', 'descuento', 'precio_total_sin_impuesto',
            'tarifa', 'valor_impuesto',
        ]


class NotaCreditoSerializer(serializers.ModelSerializer):
    numero_nota_credito = serializers.SerializerMethodField()
    estado              = serializers.SerializerMethodField()
    fecha_emision       = serializers.SerializerMethodField()
    numero_autorizacion = serializers.SerializerMethodField()
    mensajes_sri        = serializers.SerializerMethodField()
    numero_factura_origen = serializers.SerializerMethodField()
    cliente_nombre      = serializers.SerializerMethodField()
    detalles            = DetalleNotaCreditoSerializer(many=True, read_only=True)

    class Meta:
        model = NotaCredito
        fields = [
            'id', 'factura_origen', 'numero_factura_origen', 'cliente_nombre',
            'motivo', 'numero_nota_credito', 'estado',
            'fecha_emision', 'numero_autorizacion', 'mensajes_sri',
            'subtotal_sin_impuestos', 'total_descuento', 'total',
            'detalles',
        ]
        read_only_fields = ['subtotal_sin_impuestos', 'total_descuento', 'total']

    def get_numero_nota_credito(self, obj): return obj.comprobante.numero_comprobante
    def get_estado(self, obj):              return obj.comprobante.estado
    def get_fecha_emision(self, obj):       return obj.comprobante.fecha_emision
    def get_numero_autorizacion(self, obj): return obj.comprobante.numero_autorizacion
    def get_mensajes_sri(self, obj):        return obj.comprobante.mensajes_sri or ''
    def get_numero_factura_origen(self, obj): return obj.factura_origen.comprobante.numero_comprobante
    def get_cliente_nombre(self, obj):      return obj.factura_origen.cliente.razon_social


class SecuencialSerializer(serializers.ModelSerializer):
    tipo_comprobante_display = serializers.CharField(
        source='get_tipo_comprobante_display', read_only=True
    )

    class Meta:
        model = Secuencial
        fields = [
            'id', 'empresa', 'tipo_comprobante', 'tipo_comprobante_display',
            'establecimiento', 'punto_emision', 'secuencial_actual', 'configurado',
        ]
        read_only_fields = ['configurado']

    def validate_secuencial_actual(self, value):
        # SUPER_ADMIN can set any value (e.g. to correct a mistake)
        request = self.context.get('request')
        if request and getattr(request.user, 'rol', None) == 'SUPER_ADMIN':
            return value
        # On update: never allow reducing the current sequential value
        if self.instance is not None and value < self.instance.secuencial_actual:
            raise serializers.ValidationError(
                'No se puede reducir el secuencial actual.'
            )
        return value
