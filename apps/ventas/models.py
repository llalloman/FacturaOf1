"""
Modelos de Ventas y Punto de Venta (POS)
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone
import uuid


class Caja(models.Model):
    """
    Cajas registradoras/Puntos de venta
    """
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cajas',
        verbose_name=_('empresa')
    )
    bodega = models.ForeignKey(
        'inventarios.Bodega',
        on_delete=models.PROTECT,
        related_name='cajas',
        verbose_name=_('bodega')
    )
    
    codigo = models.CharField(_('código'), max_length=10)
    nombre = models.CharField(_('nombre'), max_length=200)
    descripcion = models.TextField(_('descripción'), blank=True)
    
    # Configuración de impresión
    impresora_termica = models.CharField(_('impresora térmica'), max_length=200, blank=True)
    ancho_papel = models.IntegerField(_('ancho papel (mm)'), default=80)
    
    activa = models.BooleanField(_('activa'), default=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('caja')
        verbose_name_plural = _('cajas')
        unique_together = ['empresa', 'codigo']
        ordering = ['nombre']
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class AperturaCaja(models.Model):
    """
    Aperturas y cierres de caja
    """
    
    class EstadoChoices(models.TextChoices):
        ABIERTA = 'ABIERTA', _('Abierta')
        CERRADA = 'CERRADA', _('Cerrada')
    
    caja = models.ForeignKey(
        Caja,
        on_delete=models.PROTECT,
        related_name='aperturas',
        verbose_name=_('caja')
    )
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        related_name='aperturas_caja',
        verbose_name=_('usuario')
    )
    
    # Apertura
    fecha_apertura = models.DateTimeField(_('fecha apertura'), default=timezone.now)
    monto_apertura = models.DecimalField(
        _('monto apertura'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    # Cierre
    fecha_cierre = models.DateTimeField(_('fecha cierre'), null=True, blank=True)
    monto_cierre = models.DecimalField(
        _('monto cierre'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    monto_esperado = models.DecimalField(
        _('monto esperado'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    diferencia = models.DecimalField(
        _('diferencia'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    estado = models.CharField(
        _('estado'),
        max_length=10,
        choices=EstadoChoices.choices,
        default=EstadoChoices.ABIERTA
    )
    
    observaciones = models.TextField(_('observaciones'), blank=True)
    
    class Meta:
        verbose_name = _('apertura de caja')
        verbose_name_plural = _('aperturas de caja')
        ordering = ['-fecha_apertura']
        indexes = [
            models.Index(fields=['caja', 'estado']),
            models.Index(fields=['fecha_apertura']),
        ]
    
    def __str__(self):
        return f"{self.caja.nombre} - {self.fecha_apertura.strftime('%d/%m/%Y %H:%M')}"


class Venta(models.Model):
    """
    Ventas del punto de venta (puede o no generar factura electrónica)
    """
    
    class EstadoChoices(models.TextChoices):
        PENDIENTE = 'PENDIENTE', _('Pendiente')
        COMPLETADA = 'COMPLETADA', _('Completada')
        ANULADA = 'ANULADA', _('Anulada')
    
    class TipoVentaChoices(models.TextChoices):
        MOSTRADOR = 'MOSTRADOR', _('Mostrador')
        CREDITO = 'CREDITO', _('Crédito')
        PEDIDO = 'PEDIDO', _('Pedido')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='ventas',
        verbose_name=_('empresa')
    )
    
    # Identificación
    numero_venta = models.CharField(_('número de venta'), max_length=20)
    uuid = models.UUIDField(_('UUID'), unique=True, editable=False, default=uuid.uuid4)  # Para sincronización
    
    # Caja y usuario
    caja = models.ForeignKey(
        Caja,
        on_delete=models.PROTECT,
        related_name='ventas',
        verbose_name=_('caja')
    )
    apertura_caja = models.ForeignKey(
        AperturaCaja,
        on_delete=models.PROTECT,
        related_name='ventas',
        verbose_name=_('apertura caja')
    )
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        related_name='ventas',
        verbose_name=_('usuario')
    )
    
    # Cliente
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        related_name='ventas',
        verbose_name=_('cliente')
    )
    
    # Tipo y estado
    tipo_venta = models.CharField(
        _('tipo de venta'),
        max_length=20,
        choices=TipoVentaChoices.choices,
        default=TipoVentaChoices.MOSTRADOR
    )
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.COMPLETADA
    )
    
    # Totales
    subtotal = models.DecimalField(_('subtotal'), max_digits=12, decimal_places=2)
    descuento = models.DecimalField(_('descuento'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal_0 = models.DecimalField(_('subtotal 0%'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal_12 = models.DecimalField(_('subtotal 12%'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal_15 = models.DecimalField(_('subtotal 15%'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    iva = models.DecimalField(_('IVA'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(_('total'), max_digits=12, decimal_places=2)
    
    # Facturación electrónica
    genera_factura = models.BooleanField(_('genera factura electrónica'), default=False)
    factura = models.OneToOneField(
        'facturacion.Factura',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='venta',
        verbose_name=_('factura electrónica')
    )
    
    # Fechas y sync
    fecha_venta = models.DateTimeField(_('fecha venta'), default=timezone.now)
    sincronizada = models.BooleanField(_('sincronizada'), default=False)
    fecha_sincronizacion = models.DateTimeField(_('fecha sincronización'), null=True, blank=True)
    
    observaciones = models.TextField(_('observaciones'), blank=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    
    class Meta:
        verbose_name = _('venta')
        verbose_name_plural = _('ventas')
        ordering = ['-fecha_venta']
        indexes = [
            models.Index(fields=['empresa', 'fecha_venta']),
            models.Index(fields=['uuid']),
            models.Index(fields=['numero_venta']),
            models.Index(fields=['sincronizada']),
        ]
    
    def __str__(self):
        return f"{self.numero_venta} - {self.fecha_venta.strftime('%d/%m/%Y')} - ${self.total}"


class DetalleVenta(models.Model):
    """
    Detalle de items de una venta
    """
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('venta')
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        related_name='detalles_venta',
        verbose_name=_('producto')
    )
    
    cantidad = models.DecimalField(_('cantidad'), max_digits=12, decimal_places=2)
    precio_unitario = models.DecimalField(_('precio unitario'), max_digits=12, decimal_places=2)
    descuento = models.DecimalField(_('descuento'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(_('subtotal'), max_digits=12, decimal_places=2)
    iva = models.DecimalField(_('IVA'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(_('total'), max_digits=12, decimal_places=2)
    
    # Costo para calcular utilidad
    costo_unitario = models.DecimalField(_('costo unitario'), max_digits=12, decimal_places=6, default=Decimal('0.00'))
    
    class Meta:
        verbose_name = _('detalle de venta')
        verbose_name_plural = _('detalles de venta')
        ordering = ['id']
    
    def __str__(self):
        return f"{self.producto.nombre} x {self.cantidad}"


class PagoVenta(models.Model):
    """
    Pagos de una venta (puede ser múltiples formas de pago)
    """
    
    class FormaPagoChoices(models.TextChoices):
        EFECTIVO = 'EFECTIVO', _('Efectivo')
        TARJETA_DEBITO = 'TARJETA_DEBITO', _('Tarjeta Débito')
        TARJETA_CREDITO = 'TARJETA_CREDITO', _('Tarjeta Crédito')
        TRANSFERENCIA = 'TRANSFERENCIA', _('Transferencia')
        CHEQUE = 'CHEQUE', _('Cheque')
        CREDITO = 'CREDITO', _('Crédito')
    
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name='pagos',
        verbose_name=_('venta')
    )
    
    forma_pago = models.CharField(
        _('forma de pago'),
        max_length=20,
        choices=FormaPagoChoices.choices
    )
    monto = models.DecimalField(_('monto'), max_digits=12, decimal_places=2)
    referencia = models.CharField(_('referencia'), max_length=100, blank=True)
    
    fecha_pago = models.DateTimeField(_('fecha pago'), default=timezone.now)
    
    class Meta:
        verbose_name = _('pago de venta')
        verbose_name_plural = _('pagos de venta')
        ordering = ['fecha_pago']
    
    def __str__(self):
        return f"{self.get_forma_pago_display()} - ${self.monto}"


class MovimientoCaja(models.Model):
    """
    Movimientos adicionales de caja (ingresos/egresos no relacionados a ventas)
    """
    
    class TipoMovimientoChoices(models.TextChoices):
        INGRESO = 'INGRESO', _('Ingreso')
        EGRESO = 'EGRESO', _('Egreso')
    
    apertura_caja = models.ForeignKey(
        AperturaCaja,
        on_delete=models.PROTECT,
        related_name='movimientos',
        verbose_name=_('apertura caja')
    )
    
    tipo = models.CharField(
        _('tipo'),
        max_length=10,
        choices=TipoMovimientoChoices.choices
    )
    monto = models.DecimalField(_('monto'), max_digits=12, decimal_places=2)
    concepto = models.CharField(_('concepto'), max_length=200)
    descripcion = models.TextField(_('descripción'), blank=True)
    
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        verbose_name=_('usuario')
    )
    fecha_movimiento = models.DateTimeField(_('fecha movimiento'), default=timezone.now)
    
    class Meta:
        verbose_name = _('movimiento de caja')
        verbose_name_plural = _('movimientos de caja')
        ordering = ['-fecha_movimiento']
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.concepto} - ${self.monto}"
