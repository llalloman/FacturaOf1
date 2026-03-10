"""
Contabilidad básica:
  - CuentaContable — Plan de cuentas (árbol jerárquico, NEC/NIIF Ecuador)
  - AsientoContable — Diario contable
  - LineaAsiento    — Débito/Crédito por cuenta
"""
from decimal import Decimal
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError


class CuentaContable(models.Model):
    """
    Cuenta del Plan de Cuentas (jerarquía de hasta 6 niveles).
    Ej: 1 > 1.1 > 1.1.01 > 1.1.01.01
    """

    class TipoChoices(models.TextChoices):
        ACTIVO      = 'ACTIVO',      _('Activo')
        PASIVO      = 'PASIVO',      _('Pasivo')
        PATRIMONIO  = 'PATRIMONIO',  _('Patrimonio')
        INGRESO     = 'INGRESO',     _('Ingreso')
        GASTO       = 'GASTO',       _('Gasto')
        COSTO       = 'COSTO',       _('Costo')

    class NaturalezaChoices(models.TextChoices):
        DEUDORA    = 'DEUDORA',    _('Deudora (Débito+)')
        ACREEDORA  = 'ACREEDORA', _('Acreedora (Crédito+)')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cuentas_contables',
        verbose_name=_('empresa'),
    )
    padre = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='hijos',
        verbose_name=_('cuenta padre'),
    )
    codigo  = models.CharField(_('código'), max_length=20)
    nombre  = models.CharField(_('nombre'), max_length=200)
    tipo    = models.CharField(_('tipo'), max_length=20, choices=TipoChoices.choices)
    naturaleza = models.CharField(_('naturaleza'), max_length=15, choices=NaturalezaChoices.choices, default=NaturalezaChoices.DEUDORA)
    nivel   = models.PositiveSmallIntegerField(_('nivel'), default=1)
    es_hoja = models.BooleanField(_('es hoja (acepta movimientos)'), default=True)
    activa  = models.BooleanField(_('activa'), default=True)

    class Meta:
        verbose_name = _('cuenta contable')
        verbose_name_plural = _('cuentas contables')
        unique_together = [('empresa', 'codigo')]
        ordering = ['codigo']

    def __str__(self):
        return f"{self.codigo} — {self.nombre}"

    def saldo(self):
        """Saldo actual (débitos - créditos según naturaleza)."""
        from django.db.models import Sum
        agg = self.lineas.aggregate(
            total_debe=Sum('debe'),
            total_haber=Sum('haber'),
        )
        debe  = agg['total_debe']  or Decimal('0.00')
        haber = agg['total_haber'] or Decimal('0.00')
        if self.naturaleza == self.NaturalezaChoices.DEUDORA:
            return debe - haber
        return haber - debe


class AsientoContable(models.Model):
    """
    Asiento del diario contable. Cada asiento debe cuadrar (∑debe = ∑haber).
    """

    class TipoChoices(models.TextChoices):
        MANUAL      = 'MANUAL',      _('Manual')
        VENTA       = 'VENTA',       _('Venta')
        COMPRA      = 'COMPRA',      _('Compra')
        PAGO        = 'PAGO',        _('Pago')
        COBRO       = 'COBRO',       _('Cobro')
        AJUSTE      = 'AJUSTE',      _('Ajuste')
        APERTURA    = 'APERTURA',    _('Apertura')
        CIERRE      = 'CIERRE',      _('Cierre')

    empresa   = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='asientos',
        verbose_name=_('empresa'),
    )
    creado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        related_name='asientos_creados',
        verbose_name=_('creado por'),
    )

    numero      = models.CharField(_('número'), max_length=30)
    fecha       = models.DateField(_('fecha'))
    tipo        = models.CharField(_('tipo'), max_length=20, choices=TipoChoices.choices, default=TipoChoices.MANUAL)
    descripcion = models.CharField(_('descripción'), max_length=500)
    referencia  = models.CharField(_('referencia'), max_length=200, blank=True,
                                   help_text='Nro. factura, orden, etc.')
    bloqueado   = models.BooleanField(_('bloqueado'), default=False,
                                      help_text='No permite edición ni reversión')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('asiento contable')
        verbose_name_plural = _('asientos contables')
        ordering = ['-fecha', '-numero']

    def __str__(self):
        return f"Asiento {self.numero} — {self.fecha}"

    @property
    def total_debe(self):
        return self.lineas.aggregate(t=models.Sum('debe'))['t'] or Decimal('0.00')

    @property
    def total_haber(self):
        return self.lineas.aggregate(t=models.Sum('haber'))['t'] or Decimal('0.00')

    @property
    def cuadrado(self):
        return abs(self.total_debe - self.total_haber) < Decimal('0.01')

    def clean(self):
        if self.pk and not self.cuadrado:
            raise ValidationError('El asiento no cuadra: ∑Debe ≠ ∑Haber')


class LineaAsiento(models.Model):
    """Línea individual de débito o crédito en un asiento."""

    asiento = models.ForeignKey(
        AsientoContable,
        on_delete=models.CASCADE,
        related_name='lineas',
        verbose_name=_('asiento'),
    )
    cuenta = models.ForeignKey(
        CuentaContable,
        on_delete=models.PROTECT,
        related_name='lineas',
        verbose_name=_('cuenta'),
    )
    descripcion = models.CharField(_('descripción'), max_length=300, blank=True)
    debe  = models.DecimalField(_('débito'),  max_digits=14, decimal_places=2, default=Decimal('0.00'))
    haber = models.DecimalField(_('crédito'), max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = _('línea de asiento')
        verbose_name_plural = _('líneas de asiento')
        ordering = ['id']

    def __str__(self):
        return f"{self.cuenta.codigo} D:{self.debe} H:{self.haber}"

    def clean(self):
        if self.debe < 0 or self.haber < 0:
            raise ValidationError('Los valores de débito y crédito deben ser >= 0.')
        if self.debe == 0 and self.haber == 0:
            raise ValidationError('Una línea debe tener débito o crédito distinto de cero.')
