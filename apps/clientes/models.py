"""
Modelos de Clientes
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator


class Cliente(models.Model):
    """
    Modelo para clientes
    """
    
    class TipoIdentificacionChoices(models.TextChoices):
        RUC = '04', _('RUC')
        CEDULA = '05', _('Cédula')
        PASAPORTE = '06', _('Pasaporte')
        CONSUMIDOR_FINAL = '07', _('Consumidor Final')
        EXTERIOR = '08', _('Identificación del Exterior')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='clientes',
        verbose_name=_('empresa')
    )
    
    # Identificación
    tipo_identificacion = models.CharField(
        _('tipo de identificación'),
        max_length=2,
        choices=TipoIdentificacionChoices.choices,
        default=TipoIdentificacionChoices.CEDULA
    )
    identificacion = models.CharField(_('identificación'), max_length=20)
    razon_social = models.CharField(_('razón social'), max_length=300)
    nombre_comercial = models.CharField(_('nombre comercial'), max_length=300, blank=True)
    
    # Contacto
    email = models.EmailField(_('email'), blank=True)
    telefono = models.CharField(_('teléfono'), max_length=15, blank=True)
    celular = models.CharField(_('celular'), max_length=15, blank=True)
    direccion = models.TextField(_('dirección'), blank=True)
    
    # Estado
    activo = models.BooleanField(_('activo'), default=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)
    notas = models.TextField(_('notas'), blank=True)
    
    class Meta:
        verbose_name = _('cliente')
        verbose_name_plural = _('clientes')
        unique_together = ['empresa', 'identificacion']
        ordering = ['razon_social']
        indexes = [
            models.Index(fields=['empresa', 'activo']),
            models.Index(fields=['identificacion']),
        ]
    
    def __str__(self):
        return f"{self.identificacion} - {self.razon_social}"
    
    def get_nombre_completo(self):
        """Retorna el nombre comercial o razón social"""
        return self.nombre_comercial or self.razon_social
    
    def es_consumidor_final(self):
        """Verifica si es consumidor final"""
        return self.tipo_identificacion == self.TipoIdentificacionChoices.CONSUMIDOR_FINAL
