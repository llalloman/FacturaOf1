"""
Nómina Ecuador.

El módulo mantiene un encabezado de rol con totales consolidados y agrega
rubros/detalles para explicar ingresos, descuentos y provisiones por empleado.
"""
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# Valores base usados como fallback. Los valores operativos deben salir de
# ParametroNomina para permitir actualización por año/empresa.
APORTE_PERSONAL_IESS = Decimal('0.0945')
APORTE_PATRONAL_IESS = Decimal('0.1215')
DECIMO_TERCERO_FACTOR = Decimal('0.083333')
DECIMO_CUARTO_SBU = Decimal('460.00')

ZERO = Decimal('0.00')
CENT = Decimal('0.01')


def money(value):
    return Decimal(value or 0).quantize(CENT)


class ParametroNomina(models.Model):
    """Parámetros legales/operativos de nómina por empresa y año."""

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='parametros_nomina',
        verbose_name=_('empresa'),
    )
    anio = models.PositiveSmallIntegerField(_('año'))
    sbu = models.DecimalField(_('salario básico unificado'), max_digits=10, decimal_places=2, default=DECIMO_CUARTO_SBU)
    aporte_personal_iess = models.DecimalField(_('aporte personal IESS'), max_digits=6, decimal_places=4, default=APORTE_PERSONAL_IESS)
    aporte_patronal_iess = models.DecimalField(_('aporte patronal IESS'), max_digits=6, decimal_places=4, default=APORTE_PATRONAL_IESS)
    decimo_tercero_factor = models.DecimalField(_('factor décimo tercero'), max_digits=8, decimal_places=6, default=DECIMO_TERCERO_FACTOR)
    vacaciones_factor = models.DecimalField(_('factor vacaciones'), max_digits=8, decimal_places=6, default=Decimal('0.041667'))
    fondo_reserva_factor = models.DecimalField(_('factor fondos de reserva'), max_digits=8, decimal_places=6, default=Decimal('0.083333'))
    activo = models.BooleanField(_('activo'), default=True)
    notas = models.TextField(_('notas'), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('parámetro de nómina')
        verbose_name_plural = _('parámetros de nómina')
        unique_together = [('empresa', 'anio')]
        ordering = ['-anio']

    def __str__(self):
        return f'{self.empresa} - {self.anio}'

    @classmethod
    def for_empresa_anio(cls, empresa, anio):
        parametro = cls.objects.filter(empresa=empresa, anio=anio, activo=True).first()
        if parametro:
            return parametro
        return cls(
            empresa=empresa,
            anio=anio,
            sbu=DECIMO_CUARTO_SBU,
            aporte_personal_iess=APORTE_PERSONAL_IESS,
            aporte_patronal_iess=APORTE_PATRONAL_IESS,
            decimo_tercero_factor=DECIMO_TERCERO_FACTOR,
            vacaciones_factor=Decimal('0.041667'),
            fondo_reserva_factor=Decimal('0.083333'),
            activo=True,
        )


class RubroNomina(models.Model):
    """Catálogo de rubros que pueden usarse en roles de pago."""

    class TipoChoices(models.TextChoices):
        INGRESO = 'INGRESO', _('Ingreso')
        DESCUENTO = 'DESCUENTO', _('Descuento')
        PROVISION = 'PROVISION', _('Provisión')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='rubros_nomina',
        verbose_name=_('empresa'),
    )
    codigo = models.CharField(_('código'), max_length=40)
    nombre = models.CharField(_('nombre'), max_length=150)
    tipo = models.CharField(_('tipo'), max_length=15, choices=TipoChoices.choices)
    aplica_iess = models.BooleanField(_('aplica IESS'), default=False)
    aplica_ir = models.BooleanField(_('aplica impuesto a la renta'), default=False)
    es_recurrente = models.BooleanField(_('puede ser recurrente'), default=True)
    automatico = models.BooleanField(_('automático del sistema'), default=False)
    activo = models.BooleanField(_('activo'), default=True)
    orden = models.PositiveSmallIntegerField(_('orden'), default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('rubro de nómina')
        verbose_name_plural = _('rubros de nómina')
        unique_together = [('empresa', 'codigo')]
        ordering = ['tipo', 'orden', 'nombre']

    def __str__(self):
        return f'{self.codigo} - {self.nombre}'


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


class ConceptoEmpleadoNomina(models.Model):
    """Rubro recurrente de un empleado que se incorpora al generar roles."""

    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.CASCADE, related_name='conceptos_empleado_nomina')
    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='conceptos_nomina')
    rubro = models.ForeignKey(RubroNomina, on_delete=models.PROTECT, related_name='conceptos_empleado')
    descripcion = models.CharField(_('descripción'), max_length=200, blank=True)
    valor = models.DecimalField(_('valor'), max_digits=10, decimal_places=2)
    fecha_inicio = models.DateField(_('fecha inicio'), null=True, blank=True)
    fecha_fin = models.DateField(_('fecha fin'), null=True, blank=True)
    activo = models.BooleanField(_('activo'), default=True)
    notas = models.TextField(_('notas'), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('concepto recurrente de empleado')
        verbose_name_plural = _('conceptos recurrentes de empleados')
        ordering = ['empleado__apellidos', 'rubro__orden']

    def clean(self):
        if self.empleado_id and self.empresa_id and self.empleado.empresa_id != self.empresa_id:
            raise ValidationError('El empleado no pertenece a la empresa.')
        if self.rubro_id and self.empresa_id and self.rubro.empresa_id != self.empresa_id:
            raise ValidationError('El rubro no pertenece a la empresa.')

    def vigente_en(self, fecha):
        if not self.activo:
            return False
        if self.fecha_inicio and self.fecha_inicio > fecha:
            return False
        if self.fecha_fin and self.fecha_fin < fecha:
            return False
        return True


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
    mes   = models.PositiveSmallIntegerField(_('mes'))
    estado = models.CharField(_('estado'), max_length=20,
                              choices=EstadoChoices.choices,
                              default=EstadoChoices.BORRADOR)

    # Ingresos consolidados
    sueldo_base         = models.DecimalField(_('sueldo base'), max_digits=10, decimal_places=2, default=0)
    horas_extra_25      = models.DecimalField(_('horas extra 25%'), max_digits=8, decimal_places=2, default=0)
    horas_extra_100     = models.DecimalField(_('horas extra 100%'), max_digits=8, decimal_places=2, default=0)
    comisiones          = models.DecimalField(_('comisiones'), max_digits=10, decimal_places=2, default=0)
    bonos               = models.DecimalField(_('bonos'), max_digits=10, decimal_places=2, default=0)
    otros_ingresos      = models.DecimalField(_('otros ingresos'), max_digits=10, decimal_places=2, default=0)

    # Aportes/Provisiones consolidados
    aporte_patronal     = models.DecimalField(_('aporte patronal IESS'), max_digits=10, decimal_places=2, default=0)
    decimo_tercero      = models.DecimalField(_('décimo tercero'), max_digits=10, decimal_places=2, default=0)
    decimo_cuarto       = models.DecimalField(_('décimo cuarto'), max_digits=10, decimal_places=2, default=0)
    fondos_reserva      = models.DecimalField(_('fondos de reserva'), max_digits=10, decimal_places=2, default=0)
    vacaciones          = models.DecimalField(_('vacaciones'), max_digits=10, decimal_places=2, default=0)

    # Descuentos consolidados
    aporte_personal     = models.DecimalField(_('aporte personal IESS'), max_digits=10, decimal_places=2, default=0)
    impuesto_renta      = models.DecimalField(_('impuesto a la renta retenido'), max_digits=10, decimal_places=2, default=0)
    anticipos           = models.DecimalField(_('anticipos'), max_digits=10, decimal_places=2, default=0)
    otros_descuentos    = models.DecimalField(_('otros descuentos'), max_digits=10, decimal_places=2, default=0)

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
        return f"Rol {self.empleado} - {self.mes}/{self.anio}"

    @property
    def esta_pagado(self):
        return self.estado == self.EstadoChoices.PAGADO

    def _calcular_desde_detalles(self):
        detalles = list(self.detalles.all()) if self.pk else []
        if not detalles:
            return False

        ingresos = [d for d in detalles if d.tipo == RubroNomina.TipoChoices.INGRESO]
        descuentos = [d for d in detalles if d.tipo == RubroNomina.TipoChoices.DESCUENTO]
        parametro = ParametroNomina.for_empresa_anio(self.empresa, self.anio)

        def total_codigo(codigo):
            return money(sum((d.valor_total for d in detalles if d.codigo == codigo), ZERO))

        total_ingresos = money(sum((d.valor_total for d in ingresos), ZERO))
        total_descuentos_manuales = money(sum((d.valor_total for d in descuentos), ZERO))
        base_iess = money(sum((d.valor_total for d in ingresos if d.aplica_iess), ZERO))

        self.sueldo_base = total_codigo('SUELDO_BASE')
        self.horas_extra_25 = total_codigo('HORAS_EXTRA_25')
        self.horas_extra_100 = total_codigo('HORAS_EXTRA_100')
        self.comisiones = total_codigo('COMISIONES')
        self.bonos = total_codigo('BONOS')
        ingresos_clasificados = self.sueldo_base + self.horas_extra_25 + self.horas_extra_100 + self.comisiones + self.bonos
        self.otros_ingresos = money(total_ingresos - ingresos_clasificados)

        if self.empleado.afiliado_iess:
            self.aporte_personal = money(base_iess * parametro.aporte_personal_iess)
            self.aporte_patronal = money(base_iess * parametro.aporte_patronal_iess)
        else:
            self.aporte_personal = ZERO
            self.aporte_patronal = ZERO

        self.impuesto_renta = total_codigo('IMPUESTO_RENTA')
        self.anticipos = total_codigo('ANTICIPOS')
        descuentos_clasificados = self.impuesto_renta + self.anticipos
        self.otros_descuentos = money(total_descuentos_manuales - descuentos_clasificados)

        self.decimo_tercero = money(base_iess * parametro.decimo_tercero_factor)
        self.decimo_cuarto = money(parametro.sbu / Decimal('12'))
        self.vacaciones = money(base_iess * parametro.vacaciones_factor)
        self.fondos_reserva = money(base_iess * parametro.fondo_reserva_factor)

        self.total_ingresos = total_ingresos
        self.total_descuentos = money(self.aporte_personal + total_descuentos_manuales)
        self.liquido_a_pagar = money(self.total_ingresos - self.total_descuentos)
        return True

    def calcular(self):
        """Calcula totales. Si hay detalle, el detalle manda sobre campos manuales."""
        if self._calcular_desde_detalles():
            return

        self.total_ingresos = money(
            self.sueldo_base + self.horas_extra_25 + self.horas_extra_100
            + self.comisiones + self.bonos + self.otros_ingresos
        )
        parametro = ParametroNomina.for_empresa_anio(self.empresa, self.anio)
        if self.empleado.afiliado_iess:
            self.aporte_personal = money(self.sueldo_base * parametro.aporte_personal_iess)
            self.aporte_patronal = money(self.sueldo_base * parametro.aporte_patronal_iess)
        else:
            self.aporte_personal = ZERO
            self.aporte_patronal = ZERO
        self.decimo_tercero = money(self.sueldo_base * parametro.decimo_tercero_factor)
        self.decimo_cuarto = money(parametro.sbu / Decimal('12'))
        self.vacaciones = money(self.sueldo_base * parametro.vacaciones_factor)
        self.total_descuentos = money(
            self.aporte_personal + self.impuesto_renta + self.anticipos + self.otros_descuentos
        )
        self.liquido_a_pagar = money(self.total_ingresos - self.total_descuentos)

    def save(self, *args, **kwargs):
        self.calcular()
        super().save(*args, **kwargs)


class DetalleRolPago(models.Model):
    """Línea de ingreso, descuento o provisión de un rol."""

    rol = models.ForeignKey(RolPago, on_delete=models.CASCADE, related_name='detalles')
    rubro = models.ForeignKey(RubroNomina, on_delete=models.PROTECT, related_name='detalles_rol')
    tipo = models.CharField(_('tipo'), max_length=15, choices=RubroNomina.TipoChoices.choices)
    codigo = models.CharField(_('código'), max_length=40)
    descripcion = models.CharField(_('descripción'), max_length=200)
    cantidad = models.DecimalField(_('cantidad'), max_digits=10, decimal_places=2, default=Decimal('1.00'))
    valor_unitario = models.DecimalField(_('valor unitario'), max_digits=10, decimal_places=2)
    valor_total = models.DecimalField(_('valor total'), max_digits=10, decimal_places=2, default=0)
    aplica_iess = models.BooleanField(_('aplica IESS'), default=False)
    aplica_ir = models.BooleanField(_('aplica impuesto a la renta'), default=False)
    automatico = models.BooleanField(_('automático'), default=False)
    orden = models.PositiveSmallIntegerField(_('orden'), default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('detalle de rol')
        verbose_name_plural = _('detalles de rol')
        ordering = ['tipo', 'orden', 'id']

    def clean(self):
        if self.rubro_id and self.rol_id and self.rubro.empresa_id != self.rol.empresa_id:
            raise ValidationError('El rubro no pertenece a la empresa del rol.')

    def save(self, *args, **kwargs):
        if self.rubro_id:
            self.tipo = self.rubro.tipo
            self.codigo = self.rubro.codigo
            if not self.descripcion:
                self.descripcion = self.rubro.nombre
            self.aplica_iess = self.rubro.aplica_iess
            self.aplica_ir = self.rubro.aplica_ir
        self.valor_total = money(Decimal(self.cantidad or 0) * Decimal(self.valor_unitario or 0))
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.descripcion} {self.valor_total}'


class PagoRol(models.Model):
    """Pago de un rol de nómina y su enlace opcional a bancos."""

    rol = models.OneToOneField(RolPago, on_delete=models.CASCADE, related_name='pago_nomina')
    cuenta_bancaria = models.ForeignKey(
        'bancos.CuentaBancaria',
        on_delete=models.PROTECT,
        related_name='pagos_nomina',
        null=True,
        blank=True,
    )
    movimiento_bancario = models.OneToOneField(
        'bancos.MovimientoBancario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pago_nomina',
    )
    fecha_pago = models.DateField(_('fecha pago'), default=timezone.localdate)
    monto = models.DecimalField(_('monto'), max_digits=10, decimal_places=2)
    referencia = models.CharField(_('referencia'), max_length=100, blank=True)
    notas = models.TextField(_('notas'), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('pago de rol')
        verbose_name_plural = _('pagos de roles')
        ordering = ['-fecha_pago', '-id']

    def clean(self):
        if self.cuenta_bancaria_id and self.rol_id and self.cuenta_bancaria.empresa_id != self.rol.empresa_id:
            raise ValidationError('La cuenta bancaria no pertenece a la empresa del rol.')

    def __str__(self):
        return f'Pago rol {self.rol_id} - {self.monto}'
