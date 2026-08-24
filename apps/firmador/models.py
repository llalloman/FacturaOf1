import os
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .storage import FirmadorDocumentStorage


def firmador_upload_to(instance, filename):
    workspace = instance.workspace_id or 'sin-workspace'
    document = instance.pk or uuid.uuid4()
    safe_name = os.path.basename(filename or 'documento.pdf')
    name, ext = os.path.splitext(safe_name)
    safe_name = f'{name[:120]}{ext[:12]}' if len(safe_name) > 140 else safe_name
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
    is_primary = models.BooleanField(_('workspace principal'), default=False)
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
            models.Index(fields=['owner_user', 'is_primary']),
            models.Index(fields=['empresa', 'activo']),
            models.Index(fields=['solicitud_firma']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['owner_user'],
                condition=Q(is_primary=True, activo=True),
                name='uniq_firmador_workspace_principal_activo',
            ),
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
        GUARDADO = 'GUARDADO', _('Guardado')
        EMPRESA = 'EMPRESA', _('Certificado de empresa')

    class TipoFirma(models.TextChoices):
        SIMPLE = 'SIMPLE', _('Simple')
        QR = 'QR', _('QR')
        AVANZADA = 'AVANZADA', _('Avanzada')

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
    certificado = models.ForeignKey(
        'FirmadorCertificado',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos',
        verbose_name=_('certificado'),
    )
    original_file = models.FileField(_('PDF original'), upload_to=firmador_upload_to, storage=FirmadorDocumentStorage(), max_length=500, null=True, blank=True)
    signed_file = models.FileField(_('PDF firmado'), upload_to=firmador_upload_to, storage=FirmadorDocumentStorage(), max_length=500, null=True, blank=True)
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
    signature_type = models.CharField(_('tipo de firma'), max_length=20, choices=TipoFirma.choices, default=TipoFirma.AVANZADA)
    signature_page = models.PositiveIntegerField(_('pagina de firma'), default=1)
    signature_x = models.PositiveIntegerField(_('firma x'), default=36)
    signature_y = models.PositiveIntegerField(_('firma y'), default=36)
    signature_width = models.PositiveIntegerField(_('ancho firma'), default=224)
    signature_height = models.PositiveIntegerField(_('alto firma'), default=64)
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


class FirmadorCertificado(models.Model):
    workspace = models.ForeignKey(
        FirmadorWorkspace,
        on_delete=models.CASCADE,
        related_name='certificados',
        verbose_name=_('workspace'),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='certificados_firmador',
        verbose_name=_('usuario'),
    )
    alias = models.CharField(_('alias'), max_length=120)
    original_file_name = models.CharField(_('archivo'), max_length=255)
    encrypted_content = models.BinaryField(_('contenido cifrado'))
    file_size = models.BigIntegerField(_('tamaño'), default=0)
    fingerprint = models.CharField(_('huella'), max_length=64)
    subject = models.TextField(_('sujeto'), blank=True)
    issuer = models.TextField(_('emisor'), blank=True)
    expires_at = models.DateTimeField(_('expira'))
    active = models.BooleanField(_('activo'), default=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        verbose_name = _('certificado del firmador')
        verbose_name_plural = _('certificados del firmador')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'active']),
            models.Index(fields=['expires_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'fingerprint'],
                condition=Q(active=True),
                name='uniq_firmador_certificado_activo',
            ),
        ]

    def __str__(self):
        return self.alias or self.original_file_name


class FirmadorConsentimientoLegal(models.Model):
    class Origen(models.TextChoices):
        REGISTRO = 'firmador_registro', _('Registro del firmador')
        ADMIN = 'admin', _('Administracion')
        OTRO = 'otro', _('Otro')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='consentimientos_firmador',
        verbose_name=_('usuario'),
    )
    workspace = models.ForeignKey(
        FirmadorWorkspace,
        on_delete=models.CASCADE,
        related_name='consentimientos_legales',
        verbose_name=_('workspace'),
    )
    accepted_terms = models.BooleanField(_('acepto terminos'), default=True)
    accepted_privacy = models.BooleanField(_('acepto privacidad'), default=True)
    accepted_at = models.DateTimeField(_('fecha de aceptacion'), default=timezone.now)
    ip_address = models.GenericIPAddressField(_('direccion IP'), null=True, blank=True)
    user_agent = models.TextField(_('user agent'), blank=True)
    terms_version = models.CharField(_('version de terminos'), max_length=40)
    privacy_version = models.CharField(_('version de privacidad'), max_length=40)
    source = models.CharField(_('origen'), max_length=40, choices=Origen.choices, default=Origen.REGISTRO)
    created_at = models.DateTimeField(_('fecha de creacion'), auto_now_add=True)

    class Meta:
        db_table = 'firmador_legal_consents'
        verbose_name = _('consentimiento legal del firmador')
        verbose_name_plural = _('consentimientos legales del firmador')
        ordering = ['-accepted_at']
        indexes = [
            models.Index(fields=['user', 'accepted_at']),
            models.Index(fields=['workspace', 'accepted_at']),
            models.Index(fields=['terms_version', 'privacy_version']),
            models.Index(fields=['source']),
        ]

    def __str__(self):
        return f'{self.user_id} - {self.terms_version} - {self.accepted_at:%Y-%m-%d %H:%M:%S}'
