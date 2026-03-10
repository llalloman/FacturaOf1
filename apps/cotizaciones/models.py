from decimal import Decimal
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


class Cotizacion(models.Model):
    """
    Cotización / Proforma emitida a un cliente.
    Puede convertirse en Factura (acción `convertir_a_factura`).
    """

    class EstadoChoices(models.TextChoices):
        BORRADOR   = 'BORRADOR',   _('Borrador')
        ENVIADA    = 'ENVIADA',    _('Enviada al cliente')
        ACEPTADA   = 'ACEPTADA',   _('Aceptada')
        RECHAZADA  = 'RECHAZADA',  _('Rechazada')
        VENCIDA    = 'VENCIDA',    _('Vencida')
        FACTURADA  = 'FACTURADA',  _('Convertida a factura')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cotizaciones',
        verbose_name=_('empresa'),
    )
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        related_name='cotizaciones',
        verbose_name=_('cliente'),
    )
    creado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        related_name='cotizaciones_creadas',
        verbose_name=_('creado por'),
    )

    numero = models.CharField(_('número de cotización'), max_length=30, blank=True)
    fecha_emision  = models.DateField(_('fecha de emisión'), default=timezone.now)
    fecha_validez  = models.DateField(_('válida hasta'), null=True, blank=True)

    # Totales calculados
    subtotal        = models.DecimalField(_('subtotal'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    descuento_total = models.DecimalField(_('descuento total'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal_iva_0  = models.DecimalField(_('subtotal IVA 0%'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal_iva_12 = models.DecimalField(_('subtotal IVA 12%'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal_iva_15 = models.DecimalField(_('subtotal IVA 15%'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    iva             = models.DecimalField(_('IVA'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total           = models.DecimalField(_('total'), max_digits=12, decimal_places=2, default=Decimal('0.00'))

    estado = models.CharField(_('estado'), max_length=20, choices=EstadoChoices.choices, default=EstadoChoices.BORRADOR)
    observaciones = models.TextField(_('observaciones'), blank=True)
    condiciones   = models.TextField(_('condiciones de pago / entrega'), blank=True)

    # Referencia a factura resultante (si se convirtió)
    factura = models.OneToOneField(
        'facturacion.Factura',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cotizacion_origen',
        verbose_name=_('factura generada'),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('cotización')
        verbose_name_plural = _('cotizaciones')
        ordering = ['-created_at']

    def __str__(self):
        return f"COT-{self.numero or self.id} — {self.cliente.razon_social}"

    def recalcular_totales(self):
        """Recalcula subtotal, IVA y total a partir de los items."""
        subtotal = Decimal('0.00')
        descuento = Decimal('0.00')
        iva_0 = iva_12 = iva_15 = iva = Decimal('0.00')

        for item in self.items.all():
            base = item.precio_total_sin_impuesto
            subtotal += base
            descuento += item.descuento
            if item.tarifa_iva == Decimal('0.00'):
                iva_0 += base
            elif item.tarifa_iva == Decimal('12.00'):
                iva_12 += base
                iva += item.valor_iva
            elif item.tarifa_iva == Decimal('15.00'):
                iva_15 += base
                iva += item.valor_iva

        self.subtotal        = subtotal
        self.descuento_total = descuento
        self.subtotal_iva_0  = iva_0
        self.subtotal_iva_12 = iva_12
        self.subtotal_iva_15 = iva_15
        self.iva             = iva
        self.total           = subtotal + iva
        self.save(update_fields=[
            'subtotal', 'descuento_total', 'subtotal_iva_0',
            'subtotal_iva_12', 'subtotal_iva_15', 'iva', 'total',
        ])

    def actualizar_vencimiento(self):
        """Marca la cotización como VENCIDA si pasó la fecha de validez."""
        if (
            self.fecha_validez
            and self.estado not in ('FACTURADA', 'RECHAZADA', 'VENCIDA')
            and self.fecha_validez < timezone.now().date()
        ):
            self.estado = self.EstadoChoices.VENCIDA
            self.save(update_fields=['estado'])


class ItemCotizacion(models.Model):
    """Línea de producto/servicio dentro de una cotización."""

    cotizacion = models.ForeignKey(
        Cotizacion,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name=_('cotización'),
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name=_('producto'),
    )
    descripcion    = models.CharField(_('descripción'), max_length=300)
    codigo         = models.CharField(_('código'), max_length=25, blank=True)
    cantidad       = models.DecimalField(_('cantidad'), max_digits=12, decimal_places=4, default=Decimal('1.0000'))
    precio_unitario = models.DecimalField(_('precio unitario'), max_digits=12, decimal_places=4)
    descuento       = models.DecimalField(_('descuento'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tarifa_iva     = models.DecimalField(_('tarifa IVA %'), max_digits=5, decimal_places=2, default=Decimal('15.00'))
    precio_total_sin_impuesto = models.DecimalField(_('subtotal'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    valor_iva      = models.DecimalField(_('valor IVA'), max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = _('ítem de cotización')
        verbose_name_plural = _('ítems de cotización')
        ordering = ['id']

    def __str__(self):
        return f"{self.descripcion} × {self.cantidad}"

    def save(self, *args, **kwargs):
        base = (self.cantidad * self.precio_unitario) - self.descuento
        self.precio_total_sin_impuesto = base.quantize(Decimal('0.01'))
        self.valor_iva = (base * self.tarifa_iva / 100).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)
