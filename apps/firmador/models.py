import os
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .storage import FirmadorDocumentStorage


def firmador_upload_to(instance, filename):
    workspace = instance.workspace_id or 'sin-workspace'
    document = instance.pk or uuid.uuid4()
    safe_name = os.path.basename(filename or 'documento.pdf')
    return f'firmador/{workspace}/{document}/{uuid.uuid4()}-{safe_name}'


class FirmadorWorkspace(models.Model):
    class Tipo(models.TextChoices):
        PERSONA_NATURAL = 'PERSONA_NATURAL', _('Persona natural')
        ORGANIZACION = 'ORGANIZACION', _('Organización')
        EMPRESA_ERP = 'EMPRESA_ERP', _('Empresa ERP')
        CLIENTE_FIRMA = 'CLIENTE_FIRMA', _('Cliente de firma electrónica')

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='firmador_workspaces',
        verbose_name=_('usuario propietario'),
    )
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='firmador_workspaces',
        verbose_name=_('empresa ERP'),
    )
    solicitud_firma = models.ForeignKey(
        'firmas.SolicitudFirmaElectronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='firmador_workspaces',
        verbose_name=_('solicitud de firma electrónica'),
    )
    tipo = models.CharField(_('tipo'), max_length=30, choices=Tipo.choices, default=Tipo.PERSONA_NATURAL)
    nombre = models.CharField(_('nombre'), max_length=180)
    identificacion = models.CharField(_('identificación'), max_length=20, blank=True)
    email = models.EmailField(_('email'))
    activo = models.BooleanField(_('activo'), default=True)
    max_file_size_bytes = models.BigIntegerField(_('máximo por archivo'), default=25 * 1024 * 1024)
    max_storage_bytes = models.BigIntegerField(_('cuota de almacenamiento'), default=1024 * 1024 * 1024)
    monthly_signature_limit = models.PositiveIntegerField(_('firmas mensuales'), default=100)
    default_retention_days = models.PositiveIntegerField(_('retención predeterminada'), default=30)
    max_retention_days = models.PositiveIntegerField(_('retención máxima'), default=180)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        verbose_name = _('workspace del firmador')
        verbose_name_plural = _('workspaces del firmador')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner_user', 'activo']),
            models.Index(fields=['empresa', 'activo']),
            models.Index(fields=['solicitud_firma']),
        ]

    def __str__(self):
        return f'{self.nombre} ({self.get_tipo_display()})'

    def active_storage_bytes(self):
        return (
            self.documentos
            .filter(keep_file=True, deleted_at__isnull=True)
            .exclude(status=FirmadorDocumento.Estado.ELIMINADO)
            .aggregate(total=models.Sum('stored_bytes'))
            .get('total') or 0
        )

    def monthly_signatures_used(self):
        now = timezone.now()
        return self.documentos.filter(created_at__year=now.year, created_at__month=now.month).count()


class FirmadorDocumento(models.Model):
    class Estado(models.TextChoices):
        FIRMADO = 'FIRMADO', _('Firmado')
        ERROR = 'ERROR', _('Error')
        EXPIRADO = 'EXPIRADO', _('Expirado')
        ELIMINADO = 'ELIMINADO', _('Eliminado')

    class CertificadoOrigen(models.TextChoices):
        TEMPORAL = 'TEMPORAL', _('Temporal')
        EMPRESA = 'EMPRESA', _('Certificado de empresa')

    workspace = models.ForeignKey(
        FirmadorWorkspace,
        on_delete=models.CASCADE,
        related_name='documentos',
        verbose_name=_('workspace'),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_firmador',
        verbose_name=_('usuario'),
    )
    original_file = models.FileField(_('PDF original'), upload_to=firmador_upload_to, storage=FirmadorDocumentStorage(), null=True, blank=True)
    signed_file = models.FileField(_('PDF firmado'), upload_to=firmador_upload_to, storage=FirmadorDocumentStorage(), null=True, blank=True)
    original_file_name = models.CharField(_('archivo original'), max_length=255)
    signed_file_name = models.CharField(_('archivo firmado'), max_length=255, blank=True)
    original_size = models.BigIntegerField(_('tamaño original'), default=0)
    signed_size = models.BigIntegerField(_('tamaño firmado'), default=0)
    stored_bytes = models.BigIntegerField(_('bytes almacenados'), default=0)
    original_hash = models.CharField(_('hash original'), max_length=64, blank=True)
    signed_hash = models.CharField(_('hash firmado'), max_length=64, blank=True)
    keep_file = models.BooleanField(_('guardar archivo'), default=False)
    retention_days = models.PositiveIntegerField(_('días de retención'), default=0)
    expires_at = models.DateTimeField(_('expira'), null=True, blank=True)
    deleted_at = models.DateTimeField(_('eliminado'), null=True, blank=True)
    status = models.CharField(_('estado'), max_length=20, choices=Estado.choices, default=Estado.FIRMADO)
    certificado_origen = models.CharField(_('origen certificado'), max_length=20, choices=CertificadoOrigen.choices, default=CertificadoOrigen.TEMPORAL)
    reason = models.CharField(_('razón'), max_length=180, blank=True)
    location = models.CharField(_('ubicación'), max_length=120, blank=True)
    visible_signature = models.BooleanField(_('firma visible'), default=False)
    error_message = models.TextField(_('error'), blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        verbose_name = _('documento firmado')
        verbose_name_plural = _('documentos firmados')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'status']),
            models.Index(fields=['workspace', 'expires_at']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f'{self.original_file_name} - {self.get_status_display()}'

