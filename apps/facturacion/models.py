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
