from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class PagoConfiguracion(models.Model):
    empresa = models.OneToOneField(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='configuracion_pagos',
        verbose_name=_('empresa'),
    )
    cuenta_payphone = models.ForeignKey(
        'bancos.CuentaBancaria',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuraciones_payphone',
        verbose_name=_('cuenta PayPhone'),
    )
    caja_ventas = models.ForeignKey(
        'ventas.Caja',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuraciones_pagos',
        verbose_name=_('caja para ventas online'),
    )
    usuario_ventas = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuraciones_pagos_online',
        verbose_name=_('usuario para ventas online'),
    )
    auto_generar_venta_firmas = models.BooleanField(_('generar venta por firmas pagadas'), default=True)
    auto_generar_venta_suscripciones = models.BooleanField(_('generar venta por suscripciones pagadas'), default=True)
    activo = models.BooleanField(_('activo'), default=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'online_payment_configurations'
        verbose_name = _('configuración de pagos online')
        verbose_name_plural = _('configuraciones de pagos online')

    def __str__(self):
        return f'Pagos online - {self.empresa}'


class PagoOnline(models.Model):
    class Provider(models.TextChoices):
        PAYPHONE = 'PAYPHONE', _('PayPhone')
        TRANSFERENCIA = 'TRANSFERENCIA', _('Transferencia bancaria')

    class Metodo(models.TextChoices):
        PAYPHONE = 'PAYPHONE', _('PayPhone')
        TARJETA_CREDITO = 'TARJETA_CREDITO', _('Tarjeta de crédito')
        TARJETA_DEBITO = 'TARJETA_DEBITO', _('Tarjeta de débito')
        TRANSFERENCIA = 'TRANSFERENCIA', _('Transferencia')
        MANUAL = 'MANUAL', _('Manual')

    class Estado(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        APPROVED = 'APPROVED', _('Aprobado')
        FAILED = 'FAILED', _('Fallido')
        CANCELLED = 'CANCELLED', _('Cancelado')

    class Origen(models.TextChoices):
        FIRMA = 'FIRMA', _('Firma electrónica')
        SUSCRIPCION = 'SUSCRIPCION', _('Suscripción ERP')
        VENTA = 'VENTA', _('Venta')
        CARTERA = 'CARTERA', _('Cartera')
        OTRO = 'OTRO', _('Otro')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pagos_online',
        verbose_name=_('empresa'),
    )
    origen = models.CharField(_('origen'), max_length=20, choices=Origen.choices)
    origen_id = models.CharField(_('id origen'), max_length=80, blank=True)
    provider = models.CharField(_('proveedor'), max_length=30, choices=Provider.choices, default=Provider.PAYPHONE)
    metodo = models.CharField(_('método'), max_length=30, choices=Metodo.choices, default=Metodo.PAYPHONE)
    estado = models.CharField(_('estado'), max_length=20, choices=Estado.choices, default=Estado.PENDING)
    currency = models.CharField(_('moneda'), max_length=3, default='USD')
    base_amount = models.DecimalField(_('monto base'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    processing_fee = models.DecimalField(_('recargo transacción'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    processing_fee_tax = models.DecimalField(_('IVA recargo'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(_('monto total'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    client_transaction_id = models.CharField(_('transacción cliente'), max_length=100, unique=True)
    provider_transaction_id = models.CharField(_('transacción proveedor'), max_length=120, blank=True)
    authorization_code = models.CharField(_('código autorización'), max_length=120, blank=True)
    venta = models.ForeignKey('ventas.Venta', on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_online')
    pago_venta = models.ForeignKey('ventas.PagoVenta', on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_online')
    movimiento_bancario = models.ForeignKey('bancos.MovimientoBancario', on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_online')
    pago_suscripcion = models.ForeignKey('suscripciones.Pago', on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_online')
    raw_request = models.JSONField(_('request proveedor'), default=dict, blank=True)
    raw_response = models.JSONField(_('response proveedor'), default=dict, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    error_message = models.TextField(_('error proveedor'), blank=True)
    application_error = models.TextField(_('error aplicación interna'), blank=True)
    confirmed_at = models.DateTimeField(_('fecha confirmación'), null=True, blank=True)
    applied_at = models.DateTimeField(_('fecha aplicación interna'), null=True, blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'online_payments'
        verbose_name = _('pago online')
        verbose_name_plural = _('pagos online')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['origen', 'origen_id']),
            models.Index(fields=['provider', 'client_transaction_id']),
            models.Index(fields=['created_at']),
        ]

    def mark_application_error(self, message):
        self.application_error = str(message or '')
        self.save(update_fields=['application_error', 'updated_at'])

    def mark_applied(self, venta=None, pago_venta=None, movimiento=None):
        self.venta = venta or self.venta
        self.pago_venta = pago_venta or self.pago_venta
        self.movimiento_bancario = movimiento or self.movimiento_bancario
        self.applied_at = self.applied_at or timezone.now()
        self.application_error = ''
        self.save(update_fields=['venta', 'pago_venta', 'movimiento_bancario', 'applied_at', 'application_error', 'updated_at'])

    def __str__(self):
        return f'{self.provider} {self.client_transaction_id} - {self.estado}'
