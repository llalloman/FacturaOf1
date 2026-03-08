"""
Modelos de Empresas - Multi-tenant
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import FileExtensionValidator
from django.utils import timezone


class Empresa(models.Model):
    """
    Modelo para las empresas que facturan (tenants)
    """
    
    class AmbienteChoices(models.TextChoices):
        PRUEBAS = '1', _('Pruebas')
        PRODUCCION = '2', _('Producción')
    
    class TipoContribuyenteChoices(models.TextChoices):
        PERSONA_NATURAL = 'NATURAL', _('Persona Natural')
        SOCIEDAD = 'SOCIEDAD', _('Sociedad')
        PUBLICA = 'PUBLICA', _('Institución Pública')
    
    # Información básica
    ruc = models.CharField(_('RUC'), max_length=13, unique=True)
    razon_social = models.CharField(_('razón social'), max_length=300)
    nombre_comercial = models.CharField(_('nombre comercial'), max_length=300, blank=True)
    
    # Tipo de contribuyente
    tipo_contribuyente = models.CharField(
        _('tipo de contribuyente'),
        max_length=20,
        choices=TipoContribuyenteChoices.choices,
        default=TipoContribuyenteChoices.PERSONA_NATURAL
    )
    contribuyente_especial = models.CharField(
        _('número contribuyente especial'),
        max_length=10,
        blank=True,
        help_text=_('Si es contribuyente especial')
    )
    obligado_contabilidad = models.BooleanField(_('obligado a llevar contabilidad'), default=False)
    gran_contribuyente = models.BooleanField(_('gran contribuyente'), default=False)
    regimen_rimpe = models.BooleanField(_('contribuyente régimen RIMPE'), default=False)
    tipo_rimpe = models.CharField(
        _('tipo RIMPE'), max_length=30, blank=True,
        choices=[
            ('RIMPE_EMPRENDEDOR', 'Contribuyente Régimen RIMPE'),
            ('RIMPE_POPULAR', 'Negocio Popular Régimen RIMPE'),
        ]
    )
    exportador = models.BooleanField(_('exportador'), default=False)
    tipo_exportador = models.CharField(
        _('tipo exportador'), max_length=20, blank=True,
        choices=[('HABITUAL', 'Habitual'), ('NO_HABITUAL', 'No habitual')]
    )
    agente_retencion = models.BooleanField(_('agente de retención'), default=False)

    # Dirección
    ciudad = models.CharField(_('ciudad'), max_length=100, blank=True)
    direccion_matriz = models.TextField(_('dirección matriz'))
    telefono = models.CharField(_('teléfono'), max_length=15)
    email = models.EmailField(_('email'))
    
    # Configuración de facturación electrónica
    ambiente = models.CharField(
        _('ambiente'),
        max_length=1,
        choices=AmbienteChoices.choices,
        default=AmbienteChoices.PRUEBAS,
        help_text=_('1=Pruebas, 2=Producción')
    )
    
    # Certificado digital para firma electrónica
    certificado_digital = models.FileField(
        _('certificado digital'),
        upload_to='certificados/',
        validators=[FileExtensionValidator(allowed_extensions=['p12', 'pfx'])],
        null=True,
        blank=True,
        help_text=_('Archivo .p12 o .pfx del certificado de firma electrónica')
    )
    password_certificado = models.CharField(
        _('contraseña del certificado'),
        max_length=255,
        blank=True,
        help_text=_('Contraseña del certificado digital (se guarda encriptada)')
    )
    fecha_vencimiento_certificado = models.DateField(
        _('fecha de vencimiento del certificado'),
        null=True,
        blank=True
    )
    firmado_automatico = models.BooleanField(_('firmado automático'), default=True)
    
    # Configuración de secuenciales
    establecimiento_codigo = models.CharField(
        _('código de establecimiento'),
        max_length=3,
        default='001',
        help_text=_('Código de 3 dígitos')
    )
    punto_emision_codigo = models.CharField(
        _('código punto de emisión'),
        max_length=3,
        default='001',
        help_text=_('Código de 3 dígitos')
    )
    
    # Logo y marca
    logo = models.ImageField(_('logo'), upload_to='logos/', null=True, blank=True)
    mensaje_personalizado = models.TextField(_('mensaje personalizado'), blank=True)
    
    # Estado
    activa = models.BooleanField(_('activa'), default=True)
    verificada = models.BooleanField(_('verificada'), default=False, help_text=_('Verificada por el SRI'))
    onboarding_completado = models.BooleanField(_('onboarding completado'), default=False)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    
    class Meta:
        verbose_name = _('empresa')
        verbose_name_plural = _('empresas')
        ordering = ['razon_social']
    
    def __str__(self):
        return f"{self.razon_social} ({self.ruc})"
    
    def tiene_suscripcion_activa(self):
        """Verifica si la empresa tiene una suscripción activa"""
        from apps.suscripciones.models import Suscripcion
        
        suscripcion_activa = self.suscripciones.filter(
            estado=Suscripcion.EstadoChoices.ACTIVA,
            fecha_fin__gt=timezone.now()
        ).first()
        
        return suscripcion_activa is not None
    
    def get_suscripcion_activa(self):
        """Obtiene la suscripción activa de la empresa"""
        from apps.suscripciones.models import Suscripcion
        
        return self.suscripciones.filter(
            estado=Suscripcion.EstadoChoices.ACTIVA,
            fecha_fin__gt=timezone.now()
        ).first()
    
    def puede_facturar(self):
        """Verifica si la empresa puede emitir facturas"""
        if not self.activa:
            return False, "La empresa está inactiva"
        
        if not self.certificado_digital:
            return False, "No se ha configurado el certificado digital"
        
        suscripcion = self.get_suscripcion_activa()
        if not suscripcion:
            return False, "No tiene una suscripción activa"
        
        return suscripcion.puede_emitir_factura()
    
    def get_siguiente_secuencial(self, tipo_comprobante):
        """Obtiene el siguiente secuencial para un tipo de comprobante"""
        from apps.facturacion.models import Secuencial
        
        secuencial, created = Secuencial.objects.get_or_create(
            empresa=self,
            tipo_comprobante=tipo_comprobante,
            establecimiento=self.establecimiento_codigo,
            punto_emision=self.punto_emision_codigo
        )
        
        return secuencial.get_siguiente()
    
    def esta_en_produccion(self):
        """Verifica si la empresa está en ambiente de producción"""
        return self.ambiente == self.AmbienteChoices.PRODUCCION
    
    def certificado_vigente(self):
        """Verifica si el certificado digital está vigente"""
        if not self.fecha_vencimiento_certificado:
            return False
        return self.fecha_vencimiento_certificado > timezone.now().date()


class Establecimiento(models.Model):
    """
    Modelo para establecimientos adicionales de la empresa
    """
    
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='establecimientos',
        verbose_name=_('empresa')
    )
    
    codigo = models.CharField(_('código'), max_length=3, help_text=_('Código de 3 dígitos'))
    nombre = models.CharField(_('nombre'), max_length=200)
    direccion = models.TextField(_('dirección'))
    telefono = models.CharField(_('teléfono'), max_length=15, blank=True)
    activo = models.BooleanField(_('activo'), default=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('establecimiento')
        verbose_name_plural = _('establecimientos')
        unique_together = ['empresa', 'codigo']
        ordering = ['codigo']
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class PuntoEmision(models.Model):
    """
    Modelo para puntos de emisión de los establecimientos
    """
    
    establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        related_name='puntos_emision',
        verbose_name=_('establecimiento')
    )
    
    codigo = models.CharField(_('código'), max_length=3, help_text=_('Código de 3 dígitos'))
    nombre = models.CharField(_('nombre'), max_length=200)
    activo = models.BooleanField(_('activo'), default=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('punto de emisión')
        verbose_name_plural = _('puntos de emisión')
        unique_together = ['establecimiento', 'codigo']
        ordering = ['codigo']
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"
