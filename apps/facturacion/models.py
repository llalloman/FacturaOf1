"""
Modelos de Facturación Electrónica
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from decimal import Decimal


class Secuencial(models.Model):
    """
    Modelo para controlar los secuenciales de comprobantes
    """
    
    class TipoComprobanteChoices(models.TextChoices):
        FACTURA = '01', _('Factura')
        NOTA_CREDITO = '04', _('Nota de Crédito')
        NOTA_DEBITO = '05', _('Nota de Débito')
        GUIA_REMISION = '06', _('Guía de Remisión')
        RETENCION = '07', _('Comprobante de Retención')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='secuenciales',
        verbose_name=_('empresa')
    )
    tipo_comprobante = models.CharField(
        _('tipo de comprobante'),
        max_length=2,
        choices=TipoComprobanteChoices.choices
    )
    establecimiento = models.CharField(_('establecimiento'), max_length=3)
    punto_emision = models.CharField(_('punto de emisión'), max_length=3)
    secuencial_actual = models.IntegerField(_('secuencial actual'), default=0)
    
    class Meta:
        verbose_name = _('secuencial')
        verbose_name_plural = _('secuenciales')
        unique_together = ['empresa', 'tipo_comprobante', 'establecimiento', 'punto_emision']
    
    def __str__(self):
        return f"{self.empresa.razon_social} - {self.get_tipo_comprobante_display()} - {self.establecimiento}-{self.punto_emision}"
    
    def get_siguiente(self):
        """Obtiene y actualiza el siguiente secuencial"""
        self.secuencial_actual += 1
        self.save(update_fields=['secuencial_actual'])
        return str(self.secuencial_actual).zfill(9)
    
    def get_formato_completo(self, secuencial):
        """Retorna el número de comprobante en formato completo"""
        return f"{self.establecimiento}-{self.punto_emision}-{secuencial}"


class ComprobanteElectronico(models.Model):
    """
    Modelo base para todos los comprobantes electrónicos
    """
    
    class EstadoChoices(models.TextChoices):
        BORRADOR = 'BORRADOR', _('Borrador')
        FIRMADO = 'FIRMADO', _('Firmado')
        ENVIADO = 'ENVIADO', _('Enviado al SRI')
        AUTORIZADO = 'AUTORIZADO', _('Autorizado')
        RECHAZADO = 'RECHAZADO', _('Rechazado')
        NO_AUTORIZADO = 'NO_AUTORIZADO', _('No Autorizado')
        ANULADO = 'ANULADO', _('Anulado')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='comprobantes',
        verbose_name=_('empresa')
    )
    usuario_creador = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        related_name='comprobantes_creados',
        verbose_name=_('usuario creador')
    )
    
    # Identificación del comprobante
    tipo_comprobante = models.CharField(_('tipo de comprobante'), max_length=2)
    establecimiento = models.CharField(_('establecimiento'), max_length=3)
    punto_emision = models.CharField(_('punto de emisión'), max_length=3)
    secuencial = models.CharField(_('secuencial'), max_length=9)
    numero_comprobante = models.CharField(_('número de comprobante'), max_length=17)  # 001-001-000000001
    
    # Clave de acceso (48 dígitos)
    clave_acceso = models.CharField(_('clave de acceso'), max_length=49, unique=True, null=True, blank=True)
    
    # Fechas
    fecha_emision = models.DateTimeField(_('fecha de emisión'))
    
    # Archivos
    xml_generado = models.TextField(_('XML generado'), blank=True)
    xml_firmado = models.TextField(_('XML firmado'), blank=True)
    pdf_ride = models.FileField(_('PDF RIDE'), upload_to='ride/', null=True, blank=True)
    
    # Estado y autorización
    estado = models.CharField(_('estado'), max_length=20, choices=EstadoChoices.choices, default=EstadoChoices.BORRADOR)
    numero_autorizacion = models.CharField(_('número de autorización'), max_length=49, blank=True)
    fecha_autorizacion = models.DateTimeField(_('fecha de autorización'), null=True, blank=True)
    
    # Respuestas del SRI
    respuesta_sri = models.JSONField(_('respuesta del SRI'), null=True, blank=True)
    mensajes_sri = models.TextField(_('mensajes del SRI'), blank=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    
    class Meta:
        verbose_name = _('comprobante electrónico')
        verbose_name_plural = _('comprobantes electrónicos')
        ordering = ['-fecha_emision']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['clave_acceso']),
            models.Index(fields=['numero_comprobante']),
        ]
    
    def __str__(self):
        return f"{self.numero_comprobante} - {self.get_estado_display()}"


class Factura(models.Model):
    """
    Modelo para Facturas Electrónicas
    """
    
    comprobante = models.OneToOneField(
        ComprobanteElectronico,
        on_delete=models.CASCADE,
        related_name='factura',
        verbose_name=_('comprobante')
    )
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        related_name='facturas',
        verbose_name=_('cliente')
    )
    
    # Totales
    subtotal_sin_impuestos = models.DecimalField(
        _('subtotal sin impuestos'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    subtotal_0 = models.DecimalField(
        _('subtotal 0%'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    subtotal_12 = models.DecimalField(
        _('subtotal 12%'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    subtotal_15 = models.DecimalField(
        _('subtotal 15%'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_descuento = models.DecimalField(
        _('total descuento'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    iva_12 = models.DecimalField(
        _('IVA 12%'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    iva_15 = models.DecimalField(
        _('IVA 15%'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total = models.DecimalField(
        _('total'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    
    # Información adicional
    observaciones = models.TextField(_('observaciones'), blank=True)
    informacion_adicional = models.JSONField(_('información adicional'), null=True, blank=True)
    
    # Forma de pago
    forma_pago = models.CharField(
        _('forma de pago'),
        max_length=20,
        choices=[
            ('01', 'Sin utilización del sistema financiero'),
            ('15', 'Compensación de deudas'),
            ('16', 'Tarjeta de débito'),
            ('17', 'Dinero electrónico'),
            ('18', 'Tarjeta prepago'),
            ('19', 'Tarjeta de crédito'),
            ('20', 'Otros con utilización del sistema financiero'),
            ('21', 'Endoso de títulos'),
        ],
        default='20'
    )
    
    class Meta:
        verbose_name = _('factura')
        verbose_name_plural = _('facturas')
        ordering = ['-comprobante__fecha_emision']
    
    def __str__(self):
        return f"Factura {self.comprobante.numero_comprobante} - {self.cliente.razon_social}"


class DetalleFactura(models.Model):
    """
    Modelo para los detalles (items) de una factura
    """
    
    factura = models.ForeignKey(
        Factura,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('factura')
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name=_('producto')
    )
    
    # Información del item
    codigo_principal = models.CharField(_('código principal'), max_length=25)
    codigo_auxiliar = models.CharField(_('código auxiliar'), max_length=25, blank=True)
    descripcion = models.CharField(_('descripción'), max_length=300)
    cantidad = models.DecimalField(
        _('cantidad'),
        max_digits=12,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0.000001'))]
    )
    precio_unitario = models.DecimalField(
        _('precio unitario'),
        max_digits=12,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    descuento = models.DecimalField(
        _('descuento'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    precio_total_sin_impuesto = models.DecimalField(
        _('precio total sin impuesto'),
        max_digits=12,
        decimal_places=2
    )
    
    # Impuestos
    codigo_impuesto = models.CharField(
        _('código impuesto'),
        max_length=1,
        default='2',
        choices=[('2', 'IVA'), ('3', 'ICE')]
    )
    codigo_porcentaje = models.CharField(
        _('código porcentaje'),
        max_length=2,
        choices=[
            ('0', '0%'),
            ('2', '12%'),
            ('3', '14%'),
            ('4', '15%'),
            ('6', 'No Objeto de Impuesto'),
            ('7', 'Exento de IVA'),
        ],
        default='2'
    )
    tarifa = models.DecimalField(_('tarifa'), max_digits=5, decimal_places=2)
    valor_impuesto = models.DecimalField(_('valor impuesto'), max_digits=12, decimal_places=2)
    
    class Meta:
        verbose_name = _('detalle de factura')
        verbose_name_plural = _('detalles de factura')
        ordering = ['id']
    
    def __str__(self):
        return f"{self.descripcion} - {self.cantidad} x ${self.precio_unitario}"
    
    def save(self, *args, **kwargs):
        # Calcular precio total sin impuesto
        self.precio_total_sin_impuesto = (
            self.cantidad * self.precio_unitario - self.descuento
        )
        
        # Calcular valor del impuesto
        self.valor_impuesto = self.precio_total_sin_impuesto * (self.tarifa / 100)
        
        super().save(*args, **kwargs)


class NotaCredito(models.Model):
    """
    Nota de Crédito Electrónica (codDoc=04).
    Se emite para anular total o parcialmente una Factura autorizada por el SRI.
    """
    comprobante = models.OneToOneField(
        ComprobanteElectronico,
        on_delete=models.CASCADE,
        related_name='nota_credito',
        verbose_name=_('comprobante'),
    )
    factura_origen = models.ForeignKey(
        Factura,
        on_delete=models.PROTECT,
        related_name='notas_credito',
        verbose_name=_('factura de origen'),
    )
    motivo = models.CharField(_('motivo'), max_length=300)

    # Totales (espejo de la factura original o parciales)
    subtotal_sin_impuestos = models.DecimalField(
        _('subtotal sin impuestos'), max_digits=12, decimal_places=2,
        default=Decimal('0.00'),
    )
    total_descuento = models.DecimalField(
        _('total descuento'), max_digits=12, decimal_places=2,
        default=Decimal('0.00'),
    )
    total = models.DecimalField(
        _('valor de modificación'), max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )

    class Meta:
        verbose_name = _('nota de crédito')
        verbose_name_plural = _('notas de crédito')
        ordering = ['-comprobante__fecha_emision']

    def __str__(self):
        return f"NC {self.comprobante.numero_comprobante} → {self.factura_origen.comprobante.numero_comprobante}"


class DetalleNotaCredito(models.Model):
    """
    Ítem de una Nota de Crédito.
    """
    nota_credito = models.ForeignKey(
        NotaCredito,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('nota de crédito'),
    )
    codigo_principal = models.CharField(_('código principal'), max_length=25)
    descripcion = models.CharField(_('descripción'), max_length=300)
    cantidad = models.DecimalField(_('cantidad'), max_digits=12, decimal_places=6)
    precio_unitario = models.DecimalField(_('precio unitario'), max_digits=12, decimal_places=6)
    descuento = models.DecimalField(_('descuento'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    precio_total_sin_impuesto = models.DecimalField(_('precio total sin impuesto'), max_digits=12, decimal_places=2)
    codigo_impuesto = models.CharField(_('código impuesto'), max_length=1, default='2')
    codigo_porcentaje = models.CharField(_('código porcentaje'), max_length=2, default='2')
    tarifa = models.DecimalField(_('tarifa'), max_digits=5, decimal_places=2)
    valor_impuesto = models.DecimalField(_('valor impuesto'), max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = _('detalle de nota de crédito')
        verbose_name_plural = _('detalles de nota de crédito')
        ordering = ['id']

    def __str__(self):
        return f"{self.descripcion} - {self.cantidad}"


# ─── Comprobante de Retención (codDoc=07) ─────────────────────────────────────

class Retencion(models.Model):
    """
    Comprobante de Retención Electrónico (codDoc=07).
    Lo emite el agente de retención (la empresa) cuando paga a un proveedor.
    """
    comprobante = models.OneToOneField(
        ComprobanteElectronico,
        on_delete=models.CASCADE,
        related_name='retencion',
        verbose_name=_('comprobante'),
    )
    # Sujeto retenido (proveedor)
    proveedor = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        related_name='retenciones',
        verbose_name=_('proveedor / sujeto retenido'),
    )
    # Período fiscal en formato MM/YYYY
    periodo_fiscal = models.CharField(_('período fiscal'), max_length=7)

    class Meta:
        verbose_name = _('retención')
        verbose_name_plural = _('retenciones')
        ordering = ['-comprobante__fecha_emision']

    def __str__(self):
        return f"RET {self.comprobante.numero_comprobante} — {self.proveedor.razon_social}"

    @property
    def total_retenido(self):
        return sum(d.valor_retenido for d in self.impuestos.all())


class ImpuestoRetencion(models.Model):
    """
    Cada línea de impuesto dentro del comprobante de retención.
    Un comprobante puede tener varios impuestos (ej: Renta 1% + IVA 30%).
    """
    # Códigos de impuesto SRI
    COD_RENTA = '1'
    COD_IVA   = '2'
    COD_ISD   = '6'

    retencion = models.ForeignKey(
        Retencion,
        on_delete=models.CASCADE,
        related_name='impuestos',
        verbose_name=_('retención'),
    )
    # Código del impuesto: 1=Renta, 2=IVA, 6=ISD
    codigo = models.CharField(_('código impuesto'), max_length=1)
    # Código del porcentaje (303, 322, 3440, etc. según tabla SRI)
    codigo_porcentaje = models.CharField(_('código porcentaje'), max_length=4)
    # Porcentaje de retención (ej: 1.00, 2.00, 10.00, 30.00 etc.)
    tarifa = models.DecimalField(_('tarifa %'), max_digits=5, decimal_places=2)
    # Base imponible sobre la que se retiene
    base_imponible = models.DecimalField(_('base imponible'), max_digits=12, decimal_places=2)
    # Valor retenido = base_imponible * tarifa / 100
    valor_retenido = models.DecimalField(_('valor retenido'), max_digits=12, decimal_places=2)
    # Documento de sustento (la factura del proveedor)
    cod_doc_sustento = models.CharField(_('cod. doc. sustento'), max_length=2, default='01')
    num_doc_sustento = models.CharField(_('nro. doc. sustento'), max_length=17)
    fecha_emision_doc_sustento = models.DateField(_('fecha emisión doc. sustento'))

    class Meta:
        verbose_name = _('impuesto de retención')
        verbose_name_plural = _('impuestos de retención')
        ordering = ['id']

    def __str__(self):
        return f"Cod {self.codigo} {self.codigo_porcentaje} {self.tarifa}% — ${self.valor_retenido}"


# ─── Guía de Remisión (codDoc=06) ─────────────────────────────────────────────

class GuiaRemision(models.Model):
    """
    Guía de Remisión Electrónica (codDoc=06).
    Ampara el traslado de mercadería dentro del territorio nacional.
    """
    comprobante = models.OneToOneField(
        ComprobanteElectronico,
        on_delete=models.CASCADE,
        related_name='guia_remision',
        verbose_name=_('comprobante'),
    )
    # Datos del transportista
    ruc_transportista = models.CharField(_('RUC transportista'), max_length=13)
    razon_social_transportista = models.CharField(_('razón social transportista'), max_length=300)
    # Placa del vehículo
    placa = models.CharField(_('placa'), max_length=20)
    # Fechas de traslado
    fecha_inicio_transporte = models.DateField(_('fecha inicio transporte'))
    fecha_fin_transporte    = models.DateField(_('fecha fin transporte'))
    # Dirección del punto de partida
    dir_partida = models.CharField(_('dirección de partida'), max_length=300)

    class Meta:
        verbose_name = _('guía de remisión')
        verbose_name_plural = _('guías de remisión')
        ordering = ['-comprobante__fecha_emision']

    def __str__(self):
        return f"GR {self.comprobante.numero_comprobante} — {self.razon_social_transportista}"


class DestinatarioGuia(models.Model):
    """
    Destinatario en la Guía de Remisión.
    Una guía puede tener varios destinatarios (diferentes destinos en la misma entrega).
    """
    guia = models.ForeignKey(
        GuiaRemision, on_delete=models.CASCADE,
        related_name='destinatarios', verbose_name=_('guía de remisión'),
    )
    # Identificación del destinatario
    identificacion_destinatario = models.CharField(_('identificación'), max_length=20)
    razon_social_destinatario   = models.CharField(_('razón social'), max_length=300)
    dir_dest_destinatario       = models.CharField(_('dirección destino'), max_length=300)
    motorista_y_ca              = models.CharField(_('motivo traslado'), max_length=300, default='Venta')
    # Ruta
    ruta = models.CharField(_('ruta'), max_length=300, blank=True)
    # Documento que sustenta el traslado (ej: factura)
    cod_doc_sustento        = models.CharField(_('cod. doc. sustento'), max_length=2, default='01')
    num_doc_sustento        = models.CharField(_('nro. doc. sustento'), max_length=17, blank=True)
    fecha_emision_doc_sust  = models.DateField(_('fecha emisión doc. sustento'), null=True, blank=True)
    # Número de autorización del doc. sustento
    num_autorizacion_doc_sust = models.CharField(_('nro. autorización doc. sustento'), max_length=49, blank=True)

    class Meta:
        verbose_name = _('destinatario de guía')
        verbose_name_plural = _('destinatarios de guía')
        ordering = ['id']

    def __str__(self):
        return f"{self.razon_social_destinatario} — {self.dir_dest_destinatario}"


class DetalleGuiaRemision(models.Model):
    """
    Ítem de mercadería dentro de un destinatario de la Guía de Remisión.
    """
    destinatario = models.ForeignKey(
        DestinatarioGuia, on_delete=models.CASCADE,
        related_name='detalles', verbose_name=_('destinatario'),
    )
    codigo_interno     = models.CharField(_('código interno'), max_length=25)
    descripcion        = models.CharField(_('descripción'), max_length=300)
    cantidad           = models.DecimalField(_('cantidad'), max_digits=12, decimal_places=6)

    class Meta:
        verbose_name = _('detalle de guía de remisión')
        verbose_name_plural = _('detalles de guía de remisión')
        ordering = ['id']

    def __str__(self):
        return f"{self.descripcion} - {self.cantidad}"


# ─── Nota de Débito (codDoc=05) ───────────────────────────────────────────────

class NotaDebito(models.Model):
    """
    Nota de Débito Electrónica (codDoc=05).
    Se emite para cobrar ajustes, intereses o cargos adicionales al cliente
    relacionados con una factura ya emitida.
    """
    comprobante = models.OneToOneField(
        ComprobanteElectronico,
        on_delete=models.CASCADE,
        related_name='nota_debito',
        verbose_name=_('comprobante'),
    )
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        related_name='notas_debito',
        verbose_name=_('cliente'),
    )
    factura_origen = models.ForeignKey(
        Factura,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notas_debito',
        verbose_name=_('factura de origen (opcional)'),
    )
    motivo = models.CharField(_('motivo'), max_length=300)

    # Totales recalculados a partir de los detalles
    subtotal_sin_impuestos = models.DecimalField(
        _('subtotal sin impuestos'), max_digits=12, decimal_places=2,
        default=Decimal('0.00'),
    )
    total = models.DecimalField(
        _('total'), max_digits=12, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
    )

    class Meta:
        verbose_name = _('nota de débito')
        verbose_name_plural = _('notas de débito')
        ordering = ['-comprobante__fecha_emision']

    def __str__(self):
        ref = self.factura_origen.comprobante.numero_comprobante if self.factura_origen else '—'
        return f"ND {self.comprobante.numero_comprobante} → {ref}"


class DetalleNotaDebito(models.Model):
    """
    Ítem de una Nota de Débito (razón del cargo).
    """
    nota_debito = models.ForeignKey(
        NotaDebito,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('nota de débito'),
    )
    razon = models.CharField(_('razón'), max_length=300)
    valor = models.DecimalField(
        _('valor'), max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    # Impuesto IVA sobre este cargo
    codigo_impuesto   = models.CharField(_('código impuesto'), max_length=1, default='2')
    codigo_porcentaje = models.CharField(_('código porcentaje'), max_length=2, default='4')
    tarifa            = models.DecimalField(_('tarifa'), max_digits=5, decimal_places=2, default=Decimal('15.00'))
    valor_impuesto    = models.DecimalField(_('valor impuesto'), max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = _('detalle de nota de débito')
        verbose_name_plural = _('detalles de nota de débito')
        ordering = ['id']

    def __str__(self):
        return f"{self.razon} - ${self.valor}"
