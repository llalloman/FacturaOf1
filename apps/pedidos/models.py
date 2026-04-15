"""
Modelos de Pedidos — Genérico para restaurantes, bares, cafeterías y cualquier negocio
que necesite gestión de mesas y órdenes antes de convertirlas en venta.

Flujo:
  Mesa (opcional) → Pedido (ABIERTO) → se agregan DetallePedido
  → Pedido (EN_PREPARACION / LISTO) → cobro → Venta (apps.ventas)
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
import uuid


class Zona(models.Model):
    """
    Zona o área del local: Salón, Terraza, Barra, Delivery, etc.
    Totalmente opcional; sirve para agrupar mesas.
    """
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='zonas',
        verbose_name=_('empresa'),
    )
    nombre = models.CharField(_('nombre'), max_length=100)
    descripcion = models.CharField(_('descripción'), max_length=200, blank=True)
    orden = models.PositiveSmallIntegerField(_('orden'), default=0)
    activa = models.BooleanField(_('activa'), default=True)

    class Meta:
        verbose_name = _('zona')
        verbose_name_plural = _('zonas')
        unique_together = ['empresa', 'nombre']
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre


class Mesa(models.Model):
    """
    Punto de servicio: mesa de restaurante, taburete de barra, cubículo, etc.
    Puede usarse en cualquier tipo de negocio — se identifica con número/alias libre.
    """

    class EstadoChoices(models.TextChoices):
        LIBRE = 'LIBRE', _('Libre')
        OCUPADA = 'OCUPADA', _('Ocupada')
        RESERVADA = 'RESERVADA', _('Reservada')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='mesas',
        verbose_name=_('empresa'),
    )
    zona = models.ForeignKey(
        Zona,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mesas',
        verbose_name=_('zona'),
    )
    numero = models.CharField(_('número / código'), max_length=20)
    nombre = models.CharField(_('nombre descriptivo'), max_length=100, blank=True)
    capacidad = models.PositiveSmallIntegerField(_('capacidad (personas)'), default=4)
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.LIBRE,
    )
    activa = models.BooleanField(_('activa'), default=True)

    class Meta:
        verbose_name = _('mesa')
        verbose_name_plural = _('mesas')
        unique_together = ['empresa', 'numero']
        ordering = ['zona', 'numero']

    def __str__(self):
        label = self.nombre or self.numero
        return f"Mesa {label}"


class Pedido(models.Model):
    """
    Orden de compra en proceso — genérica para cualquier tipo de negocio.
    Se convierte en Venta (apps.ventas) al momento del cobro.
    """

    class EstadoChoices(models.TextChoices):
        ABIERTO = 'ABIERTO', _('Abierto')
        EN_PREPARACION = 'EN_PREPARACION', _('En preparación')
        LISTO = 'LISTO', _('Listo para entregar')
        PAGADO = 'PAGADO', _('Pagado')
        CANCELADO = 'CANCELADO', _('Cancelado')

    class TipoPedidoChoices(models.TextChoices):
        MESA = 'MESA', _('Mesa')
        MOSTRADOR = 'MOSTRADOR', _('Mostrador / Barra')
        PARA_LLEVAR = 'PARA_LLEVAR', _('Para llevar')
        DELIVERY = 'DELIVERY', _('Delivery')

    # ── Identificación ────────────────────────────────────────────────────
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='pedidos',
        verbose_name=_('empresa'),
    )
    numero_pedido = models.CharField(_('número de pedido'), max_length=20, editable=False)
    uuid = models.UUIDField(_('UUID'), unique=True, editable=False, default=uuid.uuid4)

    # ── Ubicación ─────────────────────────────────────────────────────────
    mesa = models.ForeignKey(
        Mesa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
        verbose_name=_('mesa'),
    )

    # ── Operadores ───────────────────────────────────────────────────────
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        related_name='pedidos_tomados',
        verbose_name=_('usuario'),
    )
    caja = models.ForeignKey(
        'ventas.Caja',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
        verbose_name=_('caja'),
    )

    # ── Cliente ───────────────────────────────────────────────────────────
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
        verbose_name=_('cliente'),
    )

    # ── Tipo y estado ─────────────────────────────────────────────────────
    tipo = models.CharField(
        _('tipo'),
        max_length=20,
        choices=TipoPedidoChoices.choices,
        default=TipoPedidoChoices.MESA,
    )
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.ABIERTO,
    )
    personas = models.PositiveSmallIntegerField(_('número de personas'), default=1)
    observaciones = models.TextField(_('observaciones'), blank=True)

    # ── Totales (calculados al guardar) ───────────────────────────────────
    subtotal = models.DecimalField(_('subtotal'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    iva = models.DecimalField(_('IVA'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(_('total'), max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # ── Vínculo con Venta ─────────────────────────────────────────────────
    venta = models.OneToOneField(
        'ventas.Venta',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedido_origen',
        verbose_name=_('venta generada'),
    )

    # ── Fechas ────────────────────────────────────────────────────────────
    fecha_apertura = models.DateTimeField(_('fecha apertura'), default=timezone.now)
    fecha_cierre = models.DateTimeField(_('fecha cierre'), null=True, blank=True)
    fecha_creacion = models.DateTimeField(_('fecha creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha modificación'), auto_now=True)

    class Meta:
        verbose_name = _('pedido')
        verbose_name_plural = _('pedidos')
        ordering = ['-fecha_apertura']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['mesa', 'estado']),
            models.Index(fields=['uuid']),
        ]

    def __str__(self):
        return f"{self.numero_pedido} — {self.get_estado_display()}"

    def recalcular_totales(self):
        """Recalcula subtotal, IVA y total a partir de los detalles activos."""
        detalles = self.detalles.exclude(estado='CANCELADO')
        self.subtotal = sum((d.subtotal for d in detalles), Decimal('0.00')).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )
        self.iva = sum((d.iva for d in detalles), Decimal('0.00')).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )
        self.total = (self.subtotal + self.iva).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )
        self.save(update_fields=['subtotal', 'iva', 'total'])


class DetallePedido(models.Model):
    """
    Ítem de un pedido.  Maneja estados propios (comanda de cocina/barra).
    """

    class EstadoItemChoices(models.TextChoices):
        PENDIENTE = 'PENDIENTE', _('Pendiente')
        EN_PREPARACION = 'EN_PREPARACION', _('En preparación')
        LISTO = 'LISTO', _('Listo')
        ENTREGADO = 'ENTREGADO', _('Entregado')
        CANCELADO = 'CANCELADO', _('Cancelado')

    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('pedido'),
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        related_name='detalles_pedido',
        verbose_name=_('producto'),
    )
    cantidad = models.DecimalField(_('cantidad'), max_digits=10, decimal_places=2)
    precio_unitario = models.DecimalField(_('precio unitario'), max_digits=12, decimal_places=6)
    descuento = models.DecimalField(_('descuento'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(_('subtotal'), max_digits=12, decimal_places=2)
    iva = models.DecimalField(_('IVA'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    notas = models.CharField(_('notas / modificaciones'), max_length=200, blank=True,
                             help_text=_('Ej: sin cebolla, término medio, etc.'))
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoItemChoices.choices,
        default=EstadoItemChoices.PENDIENTE,
    )
    usuario = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        verbose_name=_('tomado por'),
    )
    fecha_agregado = models.DateTimeField(_('fecha agregado'), default=timezone.now)

    class Meta:
        verbose_name = _('detalle de pedido')
        verbose_name_plural = _('detalles de pedido')
        ordering = ['fecha_agregado']

    def __str__(self):
        return f"{self.producto.nombre} x{self.cantidad}"

    def save(self, *args, **kwargs):
        # Mantener base sin redondear para evitar arrastre de +0.01 al calcular IVA.
        base_bruta = self.cantidad * self.precio_unitario
        descuento = Decimal(str(self.descuento or '0.00'))
        if descuento < Decimal('0.00'):
            descuento = Decimal('0.00')
        base_neta = max(Decimal('0.00'), base_bruta - descuento)
        self.descuento = descuento.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        self.subtotal = base_neta.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # IVA simple según tarifa del producto
        if self.producto.aplica_iva:
            tarifas = {'0': Decimal('0'), '2': Decimal('12'), '4': Decimal('15')}
            pct = tarifas.get(self.producto.porcentaje_iva, Decimal('0'))
            self.iva = (base_neta * pct / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            self.iva = Decimal('0.00')
        super().save(*args, **kwargs)
