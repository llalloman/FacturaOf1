"""
Modelos de Inventarios - Gestión completa de stock
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone


class Bodega(models.Model):
    """
    Bodegas/Almacenes de la empresa
    """
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='bodegas',
        verbose_name=_('empresa')
    )
    codigo = models.CharField(_('código'), max_length=10)
    nombre = models.CharField(_('nombre'), max_length=200)
    direccion = models.TextField(_('dirección'), blank=True)
    es_principal = models.BooleanField(_('bodega principal'), default=False)
    activa = models.BooleanField(_('activa'), default=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('bodega')
        verbose_name_plural = _('bodegas')
        unique_together = ['empresa', 'codigo']
        ordering = ['nombre']
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class StockProducto(models.Model):
    """
    Stock de productos por bodega (inventario actual)
    """
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.CASCADE,
        related_name='stock_bodegas',
        verbose_name=_('producto')
    )
    bodega = models.ForeignKey(
        Bodega,
        on_delete=models.CASCADE,
        related_name='stocks',
        verbose_name=_('bodega')
    )
    
    cantidad = models.DecimalField(
        _('cantidad'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    costo_promedio = models.DecimalField(
        _('costo promedio'),
        max_digits=12,
        decimal_places=6,
        default=Decimal('0.00')
    )
    
    # Metadata
    ultima_actualizacion = models.DateTimeField(_('última actualización'), auto_now=True)
    
    class Meta:
        verbose_name = _('stock de producto')
        verbose_name_plural = _('stock de productos')
        unique_together = ['producto', 'bodega']
        indexes = [
            models.Index(fields=['producto', 'bodega']),
        ]
    
    def __str__(self):
        return f"{self.producto.nombre} - {self.bodega.nombre}: {self.cantidad}"


class LoteInventario(models.Model):
    """Stock por lote para productos con control de caducidad."""

    class EstadoChoices(models.TextChoices):
        DISPONIBLE = 'DISPONIBLE', _('Disponible')
        AGOTADO = 'AGOTADO', _('Agotado')
        VENCIDO = 'VENCIDO', _('Vencido')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='lotes_inventario',
        verbose_name=_('empresa')
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.CASCADE,
        related_name='lotes_inventario',
        verbose_name=_('producto')
    )
    bodega = models.ForeignKey(
        Bodega,
        on_delete=models.CASCADE,
        related_name='lotes_inventario',
        verbose_name=_('bodega')
    )
    numero_lote = models.CharField(_('número de lote'), max_length=80)
    fecha_caducidad = models.DateField(_('fecha de caducidad'), null=True, blank=True)
    cantidad_disponible = models.DecimalField(
        _('cantidad disponible'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    costo_unitario = models.DecimalField(
        _('costo unitario'),
        max_digits=12,
        decimal_places=6,
        default=Decimal('0.00')
    )
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.DISPONIBLE,
    )
    activo = models.BooleanField(_('activo'), default=True)
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)

    class Meta:
        verbose_name = _('lote de inventario')
        verbose_name_plural = _('lotes de inventario')
        ordering = ['fecha_caducidad', 'numero_lote']
        unique_together = ['empresa', 'producto', 'bodega', 'numero_lote']
        indexes = [
            models.Index(fields=['empresa', 'producto', 'bodega']),
            models.Index(fields=['fecha_caducidad', 'estado']),
        ]

    def __str__(self):
        return f"{self.producto.nombre} - Lote {self.numero_lote} ({self.cantidad_disponible})"

    def actualizar_estado(self):
        hoy = timezone.now().date()
        if self.fecha_caducidad and self.fecha_caducidad < hoy:
            self.estado = self.EstadoChoices.VENCIDO
        elif self.cantidad_disponible <= 0:
            self.estado = self.EstadoChoices.AGOTADO
        else:
            self.estado = self.EstadoChoices.DISPONIBLE


class MovimientoInventario(models.Model):
    """
    Movimientos de inventario (entradas, salidas, ajustes, transferencias)
    """
    
    class TipoMovimientoChoices(models.TextChoices):
        ENTRADA_COMPRA = 'ENTRADA_COMPRA', _('Entrada por Compra')
        SALIDA_VENTA = 'SALIDA_VENTA', _('Salida por Venta')
        AJUSTE_ENTRADA = 'AJUSTE_ENTRADA', _('Ajuste Entrada')
        AJUSTE_SALIDA = 'AJUSTE_SALIDA', _('Ajuste Salida')
        TRANSFERENCIA_SALIDA = 'TRANSFERENCIA_SALIDA', _('Transferencia Salida')
        TRANSFERENCIA_ENTRADA = 'TRANSFERENCIA_ENTRADA', _('Transferencia Entrada')
        DEVOLUCION_ENTRADA = 'DEVOLUCION_ENTRADA', _('Devolución Entrada')
        DEVOLUCION_SALIDA = 'DEVOLUCION_SALIDA', _('Devolución Salida')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='movimientos_inventario',
        verbose_name=_('empresa')
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        related_name='movimientos',
        verbose_name=_('producto')
    )
    bodega = models.ForeignKey(
        Bodega,
        on_delete=models.PROTECT,
        related_name='movimientos',
        verbose_name=_('bodega')
    )
    lote = models.ForeignKey(
        LoteInventario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos',
        verbose_name=_('lote')
    )
    
    tipo_movimiento = models.CharField(
        _('tipo de movimiento'),
        max_length=30,
        choices=TipoMovimientoChoices.choices
    )
    cantidad = models.DecimalField(
        _('cantidad'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    costo_unitario = models.DecimalField(
        _('costo unitario'),
        max_digits=12,
        decimal_places=6,
        default=Decimal('0.00')
    )
    
    # Referencias
    venta_id = models.CharField(_('ID venta'), max_length=50, blank=True)
    documento_referencia = models.CharField(_('documento referencia'), max_length=100, blank=True)
    
    # Usuario y fechas
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        related_name='movimientos_inventario',
        verbose_name=_('usuario')
    )
    fecha_movimiento = models.DateTimeField(_('fecha movimiento'), default=timezone.now)
    observaciones = models.TextField(_('observaciones'), blank=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('movimiento de inventario')
        verbose_name_plural = _('movimientos de inventario')
        ordering = ['-fecha_movimiento']
        indexes = [
            models.Index(fields=['empresa', 'fecha_movimiento']),
            models.Index(fields=['producto', 'bodega']),
            models.Index(fields=['venta_id']),
        ]
    
    def __str__(self):
        return f"{self.get_tipo_movimiento_display()} - {self.producto.nombre} ({self.cantidad})"


class TransferenciaInventario(models.Model):
    """
    Transferencias entre bodegas
    """
    
    class EstadoChoices(models.TextChoices):
        PENDIENTE = 'PENDIENTE', _('Pendiente')
        EN_TRANSITO = 'EN_TRANSITO', _('En Tránsito')
        RECIBIDA = 'RECIBIDA', _('Recibida')
        CANCELADA = 'CANCELADA', _('Cancelada')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='transferencias',
        verbose_name=_('empresa')
    )
    
    numero_transferencia = models.CharField(_('número'), max_length=20, unique=True)
    bodega_origen = models.ForeignKey(
        Bodega,
        on_delete=models.PROTECT,
        related_name='transferencias_salida',
        verbose_name=_('bodega origen')
    )
    bodega_destino = models.ForeignKey(
        Bodega,
        on_delete=models.PROTECT,
        related_name='transferencias_entrada',
        verbose_name=_('bodega destino')
    )
    
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.PENDIENTE
    )
    
    fecha_envio = models.DateTimeField(_('fecha envío'), default=timezone.now)
    fecha_recepcion = models.DateTimeField(_('fecha recepción'), null=True, blank=True)
    
    observaciones = models.TextField(_('observaciones'), blank=True)
    
    usuario_envia = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        related_name='transferencias_enviadas',
        verbose_name=_('usuario envía')
    )
    usuario_recibe = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transferencias_recibidas',
        verbose_name=_('usuario recibe')
    )
    
    class Meta:
        verbose_name = _('transferencia de inventario')
        verbose_name_plural = _('transferencias de inventario')
        ordering = ['-fecha_envio']
    
    def __str__(self):
        return f"{self.numero_transferencia} - {self.bodega_origen} → {self.bodega_destino}"


class DetalleTransferencia(models.Model):
    """
    Detalle de productos en una transferencia
    """
    transferencia = models.ForeignKey(
        TransferenciaInventario,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('transferencia')
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        verbose_name=_('producto')
    )
    
    cantidad_enviada = models.DecimalField(
        _('cantidad enviada'),
        max_digits=12,
        decimal_places=2
    )
    cantidad_recibida = models.DecimalField(
        _('cantidad recibida'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    class Meta:
        verbose_name = _('detalle de transferencia')
        verbose_name_plural = _('detalles de transferencia')
    
    def __str__(self):
        return f"{self.producto.nombre} - {self.cantidad_enviada}"
