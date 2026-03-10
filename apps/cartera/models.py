from decimal import Decimal
from django.db import models
from django.utils.translation import gettext_lazy as _


class CuentaPorCobrar(models.Model):
    """
    Representa una deuda pendiente de un cliente (originada en una factura a crédito).
    Se puede crear manualmente o automáticamente al emitir una factura con forma_pago CREDITO.
    """

    class EstadoChoices(models.TextChoices):
        PENDIENTE   = 'PENDIENTE',   _('Pendiente')
        PARCIAL     = 'PARCIAL',     _('Parcial')
        PAGADO      = 'PAGADO',      _('Pagado')
        VENCIDA     = 'VENCIDA',     _('Vencida')
        INCOBRABLE  = 'INCOBRABLE',  _('Incobrable')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cuentas_por_cobrar',
        verbose_name=_('empresa'),
    )
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        related_name='cuentas_por_cobrar',
        verbose_name=_('cliente'),
    )
    factura = models.OneToOneField(
        'facturacion.Factura',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cuenta_por_cobrar',
        verbose_name=_('factura origen'),
    )

    numero_cuenta   = models.CharField(_('número de cuenta'), max_length=30, blank=True)
    fecha_emision   = models.DateField(_('fecha de emisión'))
    fecha_vencimiento = models.DateField(_('fecha de vencimiento'))
    monto_total     = models.DecimalField(_('monto total'), max_digits=12, decimal_places=2)
    saldo           = models.DecimalField(_('saldo pendiente'), max_digits=12, decimal_places=2)
    estado          = models.CharField(
        _('estado'), max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.PENDIENTE,
    )
    notas = models.TextField(_('notas'), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('cuenta por cobrar')
        verbose_name_plural = _('cuentas por cobrar')
        ordering = ['fecha_vencimiento', '-created_at']

    def __str__(self):
        return f"CxC {self.numero_cuenta or self.id} — {self.cliente.razon_social}"

    @property
    def dias_vencimiento(self):
        """Días hasta (negativo = días vencida)."""
        from django.utils import timezone
        delta = self.fecha_vencimiento - timezone.now().date()
        return delta.days

    @property
    def bucket_aging(self):
        """Bucket de aging: 'vigente', '1-30', '31-60', '61-90', '+90'"""
        dias = self.dias_vencimiento
        if dias >= 0:
            return 'vigente'
        elif dias >= -30:
            return '1-30'
        elif dias >= -60:
            return '31-60'
        elif dias >= -90:
            return '61-90'
        return '+90'

    def actualizar_estado(self):
        from django.utils import timezone
        if self.saldo <= Decimal('0.00'):
            self.estado = self.EstadoChoices.PAGADO
        elif self.saldo < self.monto_total:
            self.estado = self.EstadoChoices.PARCIAL
        elif self.fecha_vencimiento < timezone.now().date():
            self.estado = self.EstadoChoices.VENCIDA
        else:
            self.estado = self.EstadoChoices.PENDIENTE
        self.save(update_fields=['estado', 'saldo'])


class PagoCliente(models.Model):
    """Un pago registrado contra una CuentaPorCobrar."""

    FORMA_PAGO_CHOICES = [
        ('EFECTIVO',       'Efectivo'),
        ('TRANSFERENCIA',  'Transferencia bancaria'),
        ('TARJETA_DEBITO', 'Tarjeta débito'),
        ('TARJETA_CREDITO','Tarjeta crédito'),
        ('CHEQUE',         'Cheque'),
        ('OTRO',           'Otro'),
    ]

    cuenta = models.ForeignKey(
        CuentaPorCobrar,
        on_delete=models.CASCADE,
        related_name='pagos',
        verbose_name=_('cuenta por cobrar'),
    )
    fecha_pago  = models.DateField(_('fecha de pago'))
    monto       = models.DecimalField(_('monto'), max_digits=12, decimal_places=2)
    forma_pago  = models.CharField(_('forma de pago'), max_length=20, choices=FORMA_PAGO_CHOICES, default='EFECTIVO')
    referencia  = models.CharField(_('referencia'), max_length=200, blank=True)
    notas       = models.TextField(_('notas'), blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('pago de cliente')
        verbose_name_plural = _('pagos de clientes')
        ordering = ['-fecha_pago']

    def __str__(self):
        return f"Pago ${self.monto} — {self.fecha_pago} — {self.cuenta}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalcular saldo de la cuenta
        cuenta = self.cuenta
        total_pagado = cuenta.pagos.aggregate(
            total=models.Sum('monto')
        )['total'] or Decimal('0.00')
        cuenta.saldo = max(Decimal('0.00'), cuenta.monto_total - total_pagado)
        cuenta.actualizar_estado()
