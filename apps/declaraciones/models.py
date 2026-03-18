"""
Declaraciones SRI — Modelos persistentes para Form 104, Form 103 y ATS.
"""
from decimal import Decimal
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator


class DeclaracionMensual(models.Model):
    """
    Registro persistente de una declaración mensual (IVA 104, Ret. Fuente 103, ATS).
    Almacena el snapshot de datos calculados para que el usuario pueda
    revisarlo, editarlo parcialmente y marcar como "presentada".
    """

    class TipoFormulario(models.TextChoices):
        FORM_104 = '104', _('Formulario 104 — IVA')
        FORM_103 = '103', _('Formulario 103 — Retenciones Fuente')
        ATS      = 'ATS', _('Anexo Transaccional Simplificado')

    class Estado(models.TextChoices):
        BORRADOR   = 'BORRADOR',   _('Borrador')
        CALCULADA  = 'CALCULADA',  _('Calculada')
        PRESENTADA = 'PRESENTADA', _('Presentada al SRI')
        VENCIDA    = 'VENCIDA',    _('Plazo vencido sin presentar')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='declaraciones',
        verbose_name=_('empresa'),
    )

    tipo_formulario = models.CharField(
        _('tipo de formulario'),
        max_length=3,
        choices=TipoFormulario.choices,
    )
    anio = models.PositiveSmallIntegerField(_('año'))
    mes = models.PositiveSmallIntegerField(
        _('mes'),
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )

    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=Estado.choices,
        default=Estado.BORRADOR,
    )

    # ── Datos calculados (snapshot del período) ────────────────────────────
    datos_json = models.JSONField(
        _('datos calculados'),
        default=dict,
        blank=True,
        help_text=_('Snapshot JSON del cálculo: ventas, compras, retenciones, totales.'),
    )

    # ── Resumen rápido (para listar sin parsear JSON) ──────────────────────
    total_ventas = models.DecimalField(
        _('total ventas'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    total_compras = models.DecimalField(
        _('total compras'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    iva_ventas = models.DecimalField(
        _('IVA ventas'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    iva_compras = models.DecimalField(
        _('IVA compras'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    impuesto_a_pagar = models.DecimalField(
        _('impuesto a pagar'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    credito_tributario = models.DecimalField(
        _('crédito tributario'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )
    total_retenido = models.DecimalField(
        _('total retenido'), max_digits=14, decimal_places=2, default=Decimal('0.00'),
    )

    # ── Fechas de control ──────────────────────────────────────────────────
    fecha_limite = models.DateField(
        _('fecha límite de presentación'),
        null=True, blank=True,
    )
    fecha_presentacion = models.DateTimeField(
        _('fecha de presentación'),
        null=True, blank=True,
    )
    numero_formulario_sri = models.CharField(
        _('nro. formulario SRI'),
        max_length=30, blank=True, default='',
        help_text=_('Número de presentación asignado por el SRI.'),
    )

    notas = models.TextField(_('notas'), blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('declaración mensual')
        verbose_name_plural = _('declaraciones mensuales')
        unique_together = ['empresa', 'tipo_formulario', 'anio', 'mes']
        ordering = ['-anio', '-mes', 'tipo_formulario']

    def __str__(self):
        return f"Form {self.tipo_formulario} — {self.get_mes_nombre()} {self.anio} — {self.empresa.razon_social}"

    MESES = [
        '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]

    def get_mes_nombre(self):
        return self.MESES[self.mes] if 1 <= self.mes <= 12 else '?'
