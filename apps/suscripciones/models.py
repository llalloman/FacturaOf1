"""
Modelos de Suscripciones y Planes
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

# ── Catálogo base de módulos del sistema ────────────────────────────────────
# Fallback usado por migraciones, seeds y arranque inicial. La fuente
# administrable en ejecución es ModuloSistema.
MODULOS_BASE = [
    {'codigo': 'dashboard',      'label': 'Dashboard',          'ruta': '/',               'grupo': 'Inicio',                    'icono': 'LayoutDashboard', 'orden': 1},
    {'codigo': 'pos',            'label': 'POS',                'ruta': '/pos',            'grupo': 'Ventas',                    'icono': 'Tablet',          'orden': 1, 'external': True},
    {'codigo': 'cotizaciones',   'label': 'Cotizaciones',       'ruta': '/cotizaciones',   'grupo': 'Ventas',                    'icono': 'ClipboardList',   'orden': 2},
    {'codigo': 'pedidos',        'label': 'Mesas y Pedidos',    'ruta': '/pedidos',        'grupo': 'Ventas',                    'icono': 'LayoutGrid',      'orden': 3},
    {'codigo': 'ventas',         'label': 'Ventas',             'ruta': '/ventas',         'grupo': 'Ventas',                    'icono': 'ShoppingCart',    'orden': 4},
    {'codigo': 'clientes',       'label': 'Clientes',           'ruta': '/clientes',       'grupo': 'Ventas',                    'icono': 'Users',           'orden': 5},
    {'codigo': 'facturacion',    'label': 'Facturas',           'ruta': '/facturacion',    'grupo': 'Facturación Electrónica',   'icono': 'FileText',        'orden': 1},
    {'codigo': 'notas_credito',  'label': 'Notas de Crédito',   'ruta': '/notas-credito',  'grupo': 'Facturación Electrónica',   'icono': 'FileCheck2',      'orden': 2},
    {'codigo': 'notas_debito',   'label': 'Notas de Débito',    'ruta': '/notas-debito',   'grupo': 'Facturación Electrónica',   'icono': 'FileMinus',       'orden': 3},
    {'codigo': 'retenciones',    'label': 'Retenciones',        'ruta': '/retenciones',    'grupo': 'Facturación Electrónica',   'icono': 'Receipt',         'orden': 4},
    {'codigo': 'guias_remision', 'label': 'Guías de Remisión',  'ruta': '/guias-remision', 'grupo': 'Facturación Electrónica',   'icono': 'Truck',           'orden': 5},
    {'codigo': 'productos',      'label': 'Productos',          'ruta': '/productos',      'grupo': 'Inventario',                'icono': 'Package',         'orden': 1},
    {'codigo': 'inventarios',    'label': 'Inventarios',        'ruta': '/inventarios',    'grupo': 'Inventario',                'icono': 'Warehouse',       'orden': 2},
    {'codigo': 'proveedores',    'label': 'Proveedores',        'ruta': '/proveedores',    'grupo': 'Compras',                   'icono': 'ShoppingBag',     'orden': 1},
    {'codigo': 'cartera',        'label': 'Cartera',            'ruta': '/cartera',        'grupo': 'Finanzas',                  'icono': 'Landmark',        'orden': 1},
    {'codigo': 'bancos',         'label': 'Bancos',             'ruta': '/bancos',         'grupo': 'Finanzas',                  'icono': 'Banknote',        'orden': 2},
    {'codigo': 'contabilidad',   'label': 'Contabilidad',       'ruta': '/contabilidad',   'grupo': 'Finanzas',                  'icono': 'BookOpen',        'orden': 3},
    {'codigo': 'declaraciones',  'label': 'Declaraciones SRI',  'ruta': '/declaraciones',  'grupo': 'Finanzas',                  'icono': 'FileBarChart2',   'orden': 4},
    {'codigo': 'nomina',         'label': 'Nómina',             'ruta': '/nomina',         'grupo': 'Finanzas',                  'icono': 'UsersRound',      'orden': 5},
    {'codigo': 'reportes',       'label': 'Reportes',           'ruta': '/reportes',       'grupo': 'Reportes',                  'icono': 'TrendingUp',      'orden': 1},
    {'codigo': 'usuarios',       'label': 'Usuarios',           'ruta': '/usuarios',       'grupo': 'Administración',            'icono': 'Users',           'orden': 1},
    {'codigo': 'configuracion',  'label': 'Configuración',      'ruta': '/configuracion',  'grupo': 'Administración',            'icono': 'Settings',        'orden': 2},
    {'codigo': 'firmas_electronicas', 'label': 'Solicitudes de Firma Electrónica', 'ruta': '/firmas-electronicas', 'grupo': 'Administración', 'icono': 'FileSignature', 'orden': 3},
]

MODULOS_DISPONIBLES = [(m['codigo'], m['label']) for m in MODULOS_BASE]
TODOS_LOS_MODULOS = [codigo for codigo, _ in MODULOS_DISPONIBLES]
SECCIONES_BASE = [
    {'codigo': grupo.lower().replace(' ', '_').replace('ó', 'o').replace('é', 'e').replace('á', 'a'), 'nombre': grupo, 'orden': index}
    for index, grupo in enumerate(dict.fromkeys(m['grupo'] for m in MODULOS_BASE).keys(), start=1)
]


class SeccionModulo(models.Model):
    """Tema principal del menú/catálogo que agrupa varios módulos."""
    codigo = models.CharField(_('código'), max_length=50, unique=True)
    nombre = models.CharField(_('nombre'), max_length=100)
    orden = models.PositiveIntegerField(_('orden'), default=0)
    activo = models.BooleanField(_('activo'), default=True)
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)

    class Meta:
        verbose_name = _('sección de módulo')
        verbose_name_plural = _('secciones de módulos')
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre


class ModuloSistema(models.Model):
    """Catálogo administrable de módulos/opciones disponibles en el sistema."""
    seccion = models.ForeignKey(
        SeccionModulo,
        on_delete=models.PROTECT,
        related_name='modulos',
        verbose_name=_('sección'),
        null=True,
        blank=True,
    )
    codigo = models.CharField(_('código'), max_length=50, unique=True)
    label = models.CharField(_('etiqueta'), max_length=100)
    ruta = models.CharField(_('ruta'), max_length=120)
    grupo = models.CharField(_('grupo'), max_length=80)
    icono = models.CharField(_('icono'), max_length=60, blank=True)
    orden = models.PositiveIntegerField(_('orden'), default=0)
    activo = models.BooleanField(_('activo'), default=True)
    external = models.BooleanField(_('abre externo'), default=False)
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)

    class Meta:
        verbose_name = _('módulo del sistema')
        verbose_name_plural = _('módulos del sistema')
        ordering = ['seccion__orden', 'grupo', 'orden', 'label']

    def __str__(self):
        return f'{self.codigo} - {self.label}'

    def save(self, *args, **kwargs):
        if self.seccion_id:
            self.grupo = self.seccion.nombre
        super().save(*args, **kwargs)


def get_modulos_catalogo_queryset():
    return (
        ModuloSistema.objects
        .select_related('seccion')
        .filter(activo=True)
        .order_by('seccion__orden', 'grupo', 'orden', 'label')
    )


def get_todos_modulos_codigos():
    try:
        codigos = list(get_modulos_catalogo_queryset().values_list('codigo', flat=True))
    except Exception:
        return TODOS_LOS_MODULOS
    return codigos or TODOS_LOS_MODULOS


class PlanSuscripcion(models.Model):
    """
    Modelo para los planes de suscripción disponibles
    """
    
    class TipoPlanChoices(models.TextChoices):
        FREE = 'FREE', _('Gratuito')
        BASICO = 'BASICO', _('Básico')
        PROFESIONAL = 'PROFESIONAL', _('Profesional')
        EMPRESARIAL = 'EMPRESARIAL', _('Empresarial')
        ILIMITADO = 'ILIMITADO', _('Ilimitado')
    
    class PeriodoChoices(models.TextChoices):
        MENSUAL = 'MENSUAL', _('Mensual')
        TRIMESTRAL = 'TRIMESTRAL', _('Trimestral')
        SEMESTRAL = 'SEMESTRAL', _('Semestral')
        ANUAL = 'ANUAL', _('Anual')
    
    nombre = models.CharField(_('nombre'), max_length=100)
    codigo = models.CharField(_('código'), max_length=50, unique=True)
    tipo = models.CharField(_('tipo'), max_length=20, choices=TipoPlanChoices.choices)
    periodo = models.CharField(_('periodo'), max_length=20, choices=PeriodoChoices.choices)
    
    # Características del plan
    precio = models.DecimalField(_('precio'), max_digits=10, decimal_places=2)
    facturas_mensuales = models.IntegerField(
        _('facturas mensuales'),
        help_text=_('Número de facturas permitidas por mes (0 = ilimitado)')
    )
    usuarios_permitidos = models.IntegerField(
        _('usuarios permitidos'),
        help_text=_('Número máximo de usuarios (0 = ilimitado)')
    )
    empresas_permitidas = models.IntegerField(
        _('empresas permitidas'),
        default=1,
        help_text=_('Número de empresas que puede administrar')
    )
    soporte_prioritario = models.BooleanField(_('soporte prioritario'), default=False)
    api_access = models.BooleanField(_('acceso API'), default=False)
    reportes_avanzados = models.BooleanField(_('reportes avanzados'), default=False)
    
    # Estado
    activo = models.BooleanField(_('activo'), default=True)
    descripcion = models.TextField(_('descripción'), blank=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    
    class Meta:
        verbose_name = _('plan de suscripción')
        verbose_name_plural = _('planes de suscripción')
        ordering = ['precio']
    
    def __str__(self):
        return f"{self.nombre} - {self.get_periodo_display()} (${self.precio})"
    
    def get_dias_periodo(self):
        """Retorna el número de días del periodo"""
        periodos = {
            self.PeriodoChoices.MENSUAL: 30,
            self.PeriodoChoices.TRIMESTRAL: 90,
            self.PeriodoChoices.SEMESTRAL: 180,
            self.PeriodoChoices.ANUAL: 365,
        }
        return periodos.get(self.periodo, 30)


class Suscripcion(models.Model):
    """
    Modelo para las suscripciones de las empresas
    """
    
    class EstadoChoices(models.TextChoices):
        ACTIVA = 'ACTIVA', _('Activa')
        VENCIDA = 'VENCIDA', _('Vencida')
        CANCELADA = 'CANCELADA', _('Cancelada')
        SUSPENDIDA = 'SUSPENDIDA', _('Suspendida')
        PRUEBA = 'PRUEBA', _('Período de Prueba')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='suscripciones',
        verbose_name=_('empresa')
    )
    plan = models.ForeignKey(
        PlanSuscripcion,
        on_delete=models.PROTECT,
        related_name='suscripciones',
        verbose_name=_('plan')
    )
    
    # Fechas
    fecha_inicio = models.DateTimeField(_('fecha de inicio'))
    fecha_fin = models.DateTimeField(_('fecha de fin'))
    fecha_proximo_pago = models.DateTimeField(_('fecha próximo pago'), null=True, blank=True)
    
    # Estado y configuración
    estado = models.CharField(_('estado'), max_length=20, choices=EstadoChoices.choices, default=EstadoChoices.ACTIVA)
    auto_renovar = models.BooleanField(_('auto renovar'), default=True)
    
    # Seguimiento de uso
    facturas_emitidas_mes_actual = models.IntegerField(_('facturas emitidas este mes'), default=0)
    ultimo_reset_contador = models.DateField(_('último reset contador'), auto_now_add=True)
    
    # Notificaciones
    notificado_por_vencer = models.BooleanField(_('notificado por vencer'), default=False)
    dias_notificacion_vencimiento = models.IntegerField(
        _('días para notificar vencimiento'),
        default=7,
        help_text=_('Días antes del vencimiento para enviar notificación')
    )
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    notas = models.TextField(_('notas'), blank=True)
    
    class Meta:
        verbose_name = _('suscripción')
        verbose_name_plural = _('suscripciones')
        ordering = ['-fecha_inicio']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['fecha_fin']),
        ]
    
    def __str__(self):
        return f"{self.empresa.razon_social} - {self.plan.nombre} ({self.get_estado_display()})"
    
    def save(self, *args, **kwargs):
        # Si es nueva suscripción, calcular fecha_fin
        if not self.pk and not self.fecha_fin:
            self.fecha_fin = self.fecha_inicio + timedelta(days=self.plan.get_dias_periodo())
            self.fecha_proximo_pago = self.fecha_fin
        
        super().save(*args, **kwargs)
    
    def esta_activa(self):
        """Verifica si la suscripción está activa y vigente"""
        if self.estado == self.EstadoChoices.CANCELADA:
            return False
        
        now = timezone.now()
        return self.estado == self.EstadoChoices.ACTIVA and self.fecha_fin > now
    
    def esta_por_vencer(self, dias=None):
        """Verifica si la suscripción está por vencer"""
        if dias is None:
            dias = self.dias_notificacion_vencimiento
        
        now = timezone.now()
        fecha_limite = now + timedelta(days=dias)
        
        return (
            self.estado == self.EstadoChoices.ACTIVA and
            self.fecha_fin <= fecha_limite and
            self.fecha_fin > now
        )
    
    def dias_restantes(self):
        """Retorna los días restantes de la suscripción (aplica para cualquier estado activo/prueba)"""
        if self.estado == self.EstadoChoices.CANCELADA:
            return 0
        diferencia = self.fecha_fin - timezone.now()
        return max(0, diferencia.days)
    
    def puede_emitir_factura(self):
        """Verifica si puede emitir más facturas según el plan"""
        if not self.esta_activa():
            return False, "La suscripción no está activa"

        # Reset contador al inicio de cada período de suscripción (no mensualmente).
        # Esto soporta planes mensuales, trimestrales, semestrales y anuales.
        fecha_inicio_date = self.fecha_inicio.date() if hasattr(self.fecha_inicio, 'date') else self.fecha_inicio
        if self.ultimo_reset_contador < fecha_inicio_date:
            self.facturas_emitidas_mes_actual = 0
            self.ultimo_reset_contador = timezone.now().date()
            self.save(update_fields=['facturas_emitidas_mes_actual', 'ultimo_reset_contador'])

        # Verificar límite (0 = ilimitado)
        if self.plan.facturas_mensuales > 0:
            if self.facturas_emitidas_mes_actual >= self.plan.facturas_mensuales:
                return False, f"Has alcanzado el límite de {self.plan.facturas_mensuales} documentos del período"

        return True, "OK"
    
    def incrementar_contador_facturas(self):
        """Incrementa el contador de facturas emitidas"""
        self.facturas_emitidas_mes_actual += 1
        self.save(update_fields=['facturas_emitidas_mes_actual'])
    
    def renovar(self):
        """Renueva la suscripción por otro periodo"""
        self.fecha_inicio = self.fecha_fin
        self.fecha_fin = self.fecha_inicio + timedelta(days=self.plan.get_dias_periodo())
        self.fecha_proximo_pago = self.fecha_fin
        self.estado = self.EstadoChoices.ACTIVA
        self.notificado_por_vencer = False
        # Resetear contador al renovar
        self.facturas_emitidas_mes_actual = 0
        self.ultimo_reset_contador = timezone.now().date()
        self.save()
        
        # Crear registro de pago
        Pago.objects.create(
            suscripcion=self,
            monto=self.plan.precio,
            tipo='RENOVACION',
            estado='PENDIENTE'
        )
    
    def suspender(self):
        """Suspende la suscripción"""
        self.estado = self.EstadoChoices.SUSPENDIDA
        self.save(update_fields=['estado'])
    
    def cancelar(self):
        """Cancela la suscripción"""
        self.estado = self.EstadoChoices.CANCELADA
        self.auto_renovar = False
        self.save(update_fields=['estado', 'auto_renovar'])
    
    def marcar_como_vencida(self):
        """Marca la suscripción como vencida"""
        self.estado = self.EstadoChoices.VENCIDA
        self.save(update_fields=['estado'])


class Pago(models.Model):
    """
    Modelo para registrar los pagos de suscripciones
    """
    
    class TipoPagoChoices(models.TextChoices):
        NUEVA = 'NUEVA', _('Nueva Suscripción')
        RENOVACION = 'RENOVACION', _('Renovación')
        UPGRADE = 'UPGRADE', _('Upgrade de Plan')
        DOWNGRADE = 'DOWNGRADE', _('Downgrade de Plan')
    
    class EstadoPagoChoices(models.TextChoices):
        PENDIENTE = 'PENDIENTE', _('Pendiente')
        APROBADO = 'APROBADO', _('Aprobado')
        RECHAZADO = 'RECHAZADO', _('Rechazado')
        REEMBOLSADO = 'REEMBOLSADO', _('Reembolsado')
    
    class MetodoPagoChoices(models.TextChoices):
        EFECTIVO = 'EFECTIVO', _('Efectivo')
        TRANSFERENCIA = 'TRANSFERENCIA', _('Transferencia Bancaria')
        TARJETA = 'TARJETA', _('Tarjeta de Crédito/Débito')
        PAYPAL = 'PAYPAL', _('PayPal')
        OTRO = 'OTRO', _('Otro')
    
    suscripcion = models.ForeignKey(
        Suscripcion,
        on_delete=models.CASCADE,
        related_name='pagos',
        verbose_name=_('suscripción')
    )
    
    # Información del pago
    monto = models.DecimalField(_('monto'), max_digits=10, decimal_places=2)
    tipo = models.CharField(_('tipo'), max_length=20, choices=TipoPagoChoices.choices)
    metodo = models.CharField(
        _('método de pago'),
        max_length=20,
        choices=MetodoPagoChoices.choices,
        default=MetodoPagoChoices.TRANSFERENCIA
    )
    estado = models.CharField(_('estado'), max_length=20, choices=EstadoPagoChoices.choices, default=EstadoPagoChoices.PENDIENTE)
    
    # Detalles
    referencia = models.CharField(_('referencia'), max_length=100, blank=True)
    comprobante = models.FileField(_('comprobante'), upload_to='pagos/comprobantes/', null=True, blank=True)
    notas = models.TextField(_('notas'), blank=True)
    
    # Fechas
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_aprobacion = models.DateTimeField(_('fecha de aprobación'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('pago')
        verbose_name_plural = _('pagos')
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        return f"Pago {self.id} - {self.suscripcion.empresa.razon_social} - ${self.monto}"
    
    def aprobar(self):
        """Aprueba el pago y activa/renueva la suscripción"""
        self.estado = self.EstadoPagoChoices.APROBADO
        self.fecha_aprobacion = timezone.now()
        self.save()
        
        # Activar/renovar suscripción
        if self.suscripcion.estado != Suscripcion.EstadoChoices.ACTIVA:
            self.suscripcion.estado = Suscripcion.EstadoChoices.ACTIVA
            self.suscripcion.save()


class ModuloPermiso(models.Model):
    """
    Matriz de permisos: qué módulos del sistema tiene habilitados cada plan.
    El superadmin puede configurar esta matriz desde la interfaz de administración.
    """
    plan = models.ForeignKey(
        PlanSuscripcion,
        on_delete=models.CASCADE,
        related_name='modulos_permitidos',
        verbose_name=_('plan'),
    )
    modulo = models.CharField(
        _('módulo'),
        max_length=50,
    )

    class Meta:
        verbose_name = _('permiso de módulo')
        verbose_name_plural = _('permisos de módulos')
        unique_together = [['plan', 'modulo']]
        ordering = ['plan', 'modulo']

    def __str__(self):
        return f"{self.plan.nombre} → {self.modulo}"
