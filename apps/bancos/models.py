"""
Bancos / Tesorería
  - CuentaBancaria   — Cuentas corrientes y de ahorros por empresa
  - MovimientoBancario — Extracto bancario (depósitos, retiros, transferencias)
"""
from decimal import Decimal
from django.db import models
from django.utils.translation import gettext_lazy as _


class CuentaBancaria(models.Model):

    class TipoChoices(models.TextChoices):
        CORRIENTE = 'CORRIENTE', _('Cuenta Corriente')
        AHORROS   = 'AHORROS',   _('Cuenta de Ahorros')
        CAJA      = 'CAJA',      _('Caja')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cuentas_bancarias',
        verbose_name=_('empresa'),
    )
    banco          = models.CharField(_('banco'), max_length=100)
    numero_cuenta  = models.CharField(_('número de cuenta'), max_length=50)
    tipo           = models.CharField(_('tipo'), max_length=20, choices=TipoChoices.choices)
    moneda         = models.CharField(_('moneda'), max_length=10, default='USD')
    saldo_inicial  = models.DecimalField(_('saldo inicial'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    activa         = models.BooleanField(_('activa'), default=True)
    descripcion    = models.CharField(_('descripción'), max_length=200, blank=True)

    class Meta:
        verbose_name = _('cuenta bancaria')
        verbose_name_plural = _('cuentas bancarias')
        unique_together = [('empresa', 'numero_cuenta')]
        ordering = ['banco', 'numero_cuenta']

    def __str__(self):
        return f"{self.banco} — {self.numero_cuenta}"

    @property
    def saldo_actual(self):
        from django.db.models import Sum
        agg = self.movimientos.filter(conciliado=True).aggregate(
            ingresos=Sum('monto', filter=models.Q(tipo__in=['DEPOSITO', 'TRANSFERENCIA_ENTRADA', 'NOTA_CREDITO'])),
            egresos=Sum('monto', filter=models.Q(tipo__in=['RETIRO', 'TRANSFERENCIA_SALIDA', 'NOTA_DEBITO', 'CHEQUE', 'PAGO'])),
        )
        ingresos = agg['ingresos'] or Decimal('0.00')
        egresos  = agg['egresos']  or Decimal('0.00')
        return self.saldo_inicial + ingresos - egresos

    @property
    def saldo_disponible(self):
        """Incluye movimientos no conciliados (libros)."""
        from django.db.models import Sum
        agg = self.movimientos.aggregate(
            ingresos=Sum('monto', filter=models.Q(tipo__in=['DEPOSITO', 'TRANSFERENCIA_ENTRADA', 'NOTA_CREDITO'])),
            egresos=Sum('monto', filter=models.Q(tipo__in=['RETIRO', 'TRANSFERENCIA_SALIDA', 'NOTA_DEBITO', 'CHEQUE', 'PAGO'])),
        )
        ingresos = agg['ingresos'] or Decimal('0.00')
        egresos  = agg['egresos']  or Decimal('0.00')
        return self.saldo_inicial + ingresos - egresos


class MovimientoBancario(models.Model):

    class TipoChoices(models.TextChoices):
        DEPOSITO             = 'DEPOSITO',             _('Depósito')
        RETIRO               = 'RETIRO',               _('Retiro')
        TRANSFERENCIA_ENTRADA= 'TRANSFERENCIA_ENTRADA',_('Transferencia Entrada')
        TRANSFERENCIA_SALIDA = 'TRANSFERENCIA_SALIDA', _('Transferencia Salida')
        NOTA_CREDITO         = 'NOTA_CREDITO',         _('Nota de Crédito Banco')
        NOTA_DEBITO          = 'NOTA_DEBITO',          _('Nota de Débito Banco')
        CHEQUE               = 'CHEQUE',               _('Cheque Emitido')
        PAGO                 = 'PAGO',                 _('Pago')
        OTRO                 = 'OTRO',                 _('Otro')

    cuenta     = models.ForeignKey(
        CuentaBancaria,
        on_delete=models.CASCADE,
        related_name='movimientos',
        verbose_name=_('cuenta bancaria'),
    )
    fecha         = models.DateField(_('fecha'))
    tipo          = models.CharField(_('tipo'), max_length=30, choices=TipoChoices.choices)
    descripcion   = models.CharField(_('descripción'), max_length=300)
    referencia    = models.CharField(_('referencia'), max_length=100, blank=True,
                                     help_text='Nro. cheque, transf., factura, etc.')
    monto         = models.DecimalField(_('monto'), max_digits=14, decimal_places=2)
    conciliado    = models.BooleanField(_('conciliado'), default=False)
    beneficiario  = models.CharField(_('beneficiario/origen'), max_length=200, blank=True)
    notas         = models.TextField(_('notas'), blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('movimiento bancario')
        verbose_name_plural = _('movimientos bancarios')
        ordering = ['-fecha', '-id']

    def __str__(self):
        return f"{self.fecha} | {self.tipo} | {self.monto}"

    @property
    def es_entrada(self):
        return self.tipo in (
            self.TipoChoices.DEPOSITO,
            self.TipoChoices.TRANSFERENCIA_ENTRADA,
            self.TipoChoices.NOTA_CREDITO,
        )
