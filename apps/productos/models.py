"""
Modelos de Productos/Servicios
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from decimal import Decimal, ROUND_HALF_UP


class Producto(models.Model):
    """
    Modelo para productos y servicios
    """
    
    class TipoChoices(models.TextChoices):
        BIEN = 'BIEN', _('Bien')
        SERVICIO = 'SERVICIO', _('Servicio')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='productos',
        verbose_name=_('empresa')
    )
    
    # Información básica
    codigo_principal = models.CharField(_('código principal'), max_length=25)
    codigo_auxiliar = models.CharField(_('código auxiliar'), max_length=25, blank=True)
    tipo = models.CharField(_('tipo'), max_length=10, choices=TipoChoices.choices, default=TipoChoices.BIEN)
    nombre = models.CharField(_('nombre'), max_length=300)
    descripcion = models.TextField(_('descripción'), blank=True)
    
    # Precios
    precio = models.DecimalField(
        _('precio'),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    precio_minimo = models.DecimalField(
        _('precio mínimo'),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        help_text=_('Precio mínimo de venta')
    )
    costo = models.DecimalField(
        _('costo'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    # Impuestos
    aplica_iva = models.BooleanField(_('aplica IVA'), default=True)
    porcentaje_iva = models.CharField(
        _('porcentaje IVA'),
        max_length=2,
        choices=[
            ('0', '0%'),
            ('2', '12%'),
            ('4', '15%'),
            ('6', 'No Objeto de Impuesto'),
            ('7', 'Exento de IVA'),
        ],
        default='4'
    )
    
    # Inventario
    maneja_inventario = models.BooleanField(_('maneja inventario'), default=False)
    stock_actual = models.DecimalField(
        _('stock actual'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    stock_minimo = models.DecimalField(
        _('stock mínimo'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    # Estado
    activo = models.BooleanField(_('activo'), default=True)

    # Imagen
    imagen = models.ImageField(_('imagen'), upload_to='productos/', null=True, blank=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    
    class Meta:
        verbose_name = _('producto')
        verbose_name_plural = _('productos')
        unique_together = ['empresa', 'codigo_principal']
        ordering = ['nombre']
        indexes = [
            models.Index(fields=['empresa', 'activo']),
            models.Index(fields=['codigo_principal']),
        ]
    
    def __str__(self):
        return f"{self.codigo_principal} - {self.nombre}"
    
    def get_tarifa_iva(self):
        """Retorna la tarifa de IVA como decimal"""
        tarifas = {
            '0': Decimal('0.00'),
            '2': Decimal('12.00'),
            '4': Decimal('15.00'),
            '6': Decimal('0.00'),
            '7': Decimal('0.00'),
        }
        return tarifas.get(self.porcentaje_iva, Decimal('0.00'))

    def get_factor_iva(self):
        return Decimal('1.00') + (self.get_tarifa_iva() / Decimal('100.00'))

    def calcular_precio_con_iva(self):
        """Calcula el precio incluyendo IVA"""
        if self.aplica_iva:
            return (self.precio * self.get_factor_iva()).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return self.precio.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    @classmethod
    def calcular_precio_sin_iva_desde_total(cls, precio_total, aplica_iva, porcentaje_iva):
        precio_total = Decimal(str(precio_total or 0))
        if not aplica_iva:
            return precio_total.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        tarifas = {
            '0': Decimal('0.00'),
            '2': Decimal('12.00'),
            '4': Decimal('15.00'),
            '6': Decimal('0.00'),
            '7': Decimal('0.00'),
        }
        tarifa = tarifas.get(porcentaje_iva, Decimal('0.00'))
        factor = Decimal('1.00') + (tarifa / Decimal('100.00'))
        if factor == Decimal('0.00'):
            return precio_total.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        return (precio_total / factor).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    
    def tiene_stock_disponible(self, cantidad):
        """Verifica si hay stock disponible"""
        if not self.maneja_inventario:
            return True
        return self.stock_actual >= cantidad
    
    def reducir_stock(self, cantidad):
        """Reduce el stock del producto"""
        if self.maneja_inventario:
            self.stock_actual -= cantidad
            self.save(update_fields=['stock_actual'])
    
    def aumentar_stock(self, cantidad):
        """Aumenta el stock del producto"""
        if self.maneja_inventario:
            self.stock_actual += cantidad
            self.save(update_fields=['stock_actual'])
