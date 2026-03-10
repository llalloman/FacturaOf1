"""
Nómina Ecuador (IESS, Impuesto a la Renta retención en la fuente).
  - Empleado     — ficha del colaborador
  - RolPago      — rol de pagos mensual (encabezado)
  - IngresoRol   — ingresos del rol (sueldo, horas extra, bonos, etc.)
  - DescuentoRol — descuentos del rol (aporte personal IESS, IR, anticipos, etc.)
"""
from decimal import Decimal
from django.db import models
from django.utils.translation import gettext_lazy as _


# ── Tarifas IESS 2024 Ecuador ───────────────────────────────────────────────
APORTE_PERSONAL_IESS = Decimal('0.0945')   # 9.45%
APORTE_PATRONAL_IESS = Decimal('0.1215')   # 12.15%
DECIMO_TERCERO_FACTOR = Decimal('1') / Decimal('12')
DECIMO_CUARTO_SBU = Decimal('460.00')       # SBU 2024


class Empleado(models.Model):

    class TipoContratoChoices(models.TextChoices):
        INDEFINIDO  = 'INDEFINIDO',  _('Contrato Indefinido')
        FIJO        = 'FIJO',        _('Contrato a Plazo Fijo')
        OBRA        = 'OBRA',        _('Por Obra o Servicio')
        HONORARIOS  = 'HONORARIOS',  _('Honorarios Profesionales')
        PASANTIA    = 'PASANTIA',    _('Pasantía')

    class EstadoChoices(models.TextChoices):
        ACTIVO  = 'ACTIVO',  _('Activo')
        INACTIVO= 'INACTIVO',_('Inactivo')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='empleados',
        verbose_name=_('empresa'),
    )
    cedula          = models.CharField(_('cédula / pasaporte'), max_length=20)
    nombres         = models.CharField(_('nombres'), max_length=100)
    apellidos       = models.CharField(_('apellidos'), max_length=100)
    cargo           = models.CharField(_('cargo'), max_length=150)
    departamento    = models.CharField(_('departamento'), max_length=100, blank=True)
    tipo_contrato   = models.CharField(_('tipo contrato'), max_length=20,
                                       choices=TipoContratoChoices.choices,
                                       default=TipoContratoChoices.INDEFINIDO)
    estado          = models.CharField(_('estado'), max_length=10,
                                       choices=EstadoChoices.choices,
                                       default=EstadoChoices.ACTIVO)
    fecha_ingreso   = models.DateField(_('fecha ingreso'))
    fecha_salida    = models.DateField(_('fecha salida'), null=True, blank=True)
    sueldo_base     = models.DecimalField(_('sueldo base'), max_digits=10, decimal_places=2)
    afiliado_iess   = models.BooleanField(_('afiliado IESS'), default=True)
    numero_iess     = models.CharField(_('número afiliación IESS'), max_length=20, blank=True)
    cuenta_bancaria = models.CharField(_('cuenta bancaria pago'), max_length=50, blank=True)
    banco           = models.CharField(_('banco'), max_length=100, blank=True)
    email           = models.EmailField(_('email'), blank=True)
    telefono        = models.CharField(_('teléfono'), max_length=20, blank=True)

    class Meta:
        verbose_name = _('empleado')
        verbose_name_plural = _('empleados')
        unique_together = [('empresa', 'cedula')]
        ordering = ['apellidos', 'nombres']

    def __str__(self):
        return f"{self.apellidos}, {self.nombres}"

    @property
    def nombre_completo(self):
        return f"{self.nombres} {self.apellidos}"


class RolPago(models.Model):
    """Rol de pagos mensual para un empleado."""

    class EstadoChoices(models.TextChoices):
        BORRADOR  = 'BORRADOR',  _('Borrador')
        APROBADO  = 'APROBADO',  _('Aprobado')
        PAGADO    = 'PAGADO',    _('Pagado')

    empresa  = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='roles_pago',
        verbose_name=_('empresa'),
    )
    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name='roles_pago',
        verbose_name=_('empleado'),
    )
    anio  = models.PositiveSmallIntegerField(_('año'))
    mes   = models.PositiveSmallIntegerField(_('mes'))   # 1–12
    estado = models.CharField(_('estado'), max_length=20,
                              choices=EstadoChoices.choices,
                              default=EstadoChoices.BORRADOR)

    # ── Ingresos ──────
    sueldo_base         = models.DecimalField(_('sueldo base'), max_digits=10, decimal_places=2, default=0)
    horas_extra_25      = models.DecimalField(_('horas extra 25%'), max_digits=8, decimal_places=2, default=0)
    horas_extra_100     = models.DecimalField(_('horas extra 100%'), max_digits=8, decimal_places=2, default=0)
    comisiones          = models.DecimalField(_('comisiones'), max_digits=10, decimal_places=2, default=0)
    bonos               = models.DecimalField(_('bonos'), max_digits=10, decimal_places=2, default=0)
    otros_ingresos      = models.DecimalField(_('otros ingresos'), max_digits=10, decimal_places=2, default=0)

    # ── Aportes/Provisiones ──────
    aporte_patronal     = models.DecimalField(_('aporte patronal IESS 12.15%'), max_digits=10, decimal_places=2, default=0)
    decimo_tercero      = models.DecimalField(_('décimo tercero'), max_digits=10, decimal_places=2, default=0)
    decimo_cuarto       = models.DecimalField(_('décimo cuarto'), max_digits=10, decimal_places=2, default=0)
    fondos_reserva      = models.DecimalField(_('fondos de reserva'), max_digits=10, decimal_places=2, default=0)
    vacaciones          = models.DecimalField(_('vacaciones'), max_digits=10, decimal_places=2, default=0)

    # ── Descuentos ──────
    aporte_personal     = models.DecimalField(_('aporte personal IESS 9.45%'), max_digits=10, decimal_places=2, default=0)
    impuesto_renta      = models.DecimalField(_('impuesto a la renta retenido'), max_digits=10, decimal_places=2, default=0)
    anticipos           = models.DecimalField(_('anticipos'), max_digits=10, decimal_places=2, default=0)
    otros_descuentos    = models.DecimalField(_('otros descuentos'), max_digits=10, decimal_places=2, default=0)

    # ── Totales (calculados) ──────
    total_ingresos      = models.DecimalField(_('total ingresos'), max_digits=10, decimal_places=2, default=0)
    total_descuentos    = models.DecimalField(_('total descuentos'), max_digits=10, decimal_places=2, default=0)
    liquido_a_pagar     = models.DecimalField(_('líquido a pagar'), max_digits=10, decimal_places=2, default=0)

    notas     = models.TextField(_('notas'), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('rol de pago')
        verbose_name_plural = _('roles de pago')
        unique_together = [('empresa', 'empleado', 'anio', 'mes')]
        ordering = ['-anio', '-mes', 'empleado__apellidos']

    def __str__(self):
        return f"Rol {self.empleado} — {self.mes}/{self.anio}"

    def calcular(self):
        """Calcula totales y descuentos IESS automáticamente."""
        # Total ingresos brutos
        self.total_ingresos = (
            self.sueldo_base + self.horas_extra_25 + self.horas_extra_100
            + self.comisiones + self.bonos + self.otros_ingresos
        )
        # IESS
        if self.empleado.afiliado_iess:
            self.aporte_personal  = (self.sueldo_base * APORTE_PERSONAL_IESS).quantize(Decimal('0.01'))
            self.aporte_patronal  = (self.sueldo_base * APORTE_PATRONAL_IESS).quantize(Decimal('0.01'))
        else:
            self.aporte_personal = Decimal('0.00')
            self.aporte_patronal = Decimal('0.00')
        # Provisiones
        self.decimo_tercero = (self.sueldo_base * DECIMO_TERCERO_FACTOR).quantize(Decimal('0.01'))
        self.decimo_cuarto  = (DECIMO_CUARTO_SBU / Decimal('12')).quantize(Decimal('0.01'))
        self.vacaciones     = (self.sueldo_base / Decimal('24')).quantize(Decimal('0.01'))
        # Total descuentos (solo los que se restan del líquido)
        self.total_descuentos = (
            self.aporte_personal + self.impuesto_renta
            + self.anticipos + self.otros_descuentos
        )
        self.liquido_a_pagar = self.total_ingresos - self.total_descuentos

    def save(self, *args, **kwargs):
        self.calcular()
        super().save(*args, **kwargs)
