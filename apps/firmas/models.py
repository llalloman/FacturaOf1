from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


def firma_document_upload_to(instance, filename):
    return f'firmas/solicitudes/{instance.request_id}/{instance.document_type}/{filename}'


class SolicitudFirmaElectronica(models.Model):
    class TipoSolicitud(models.TextChoices):
        PERSONA_NATURAL = 'PERSONA_NATURAL', _('Persona Natural')
        REPRESENTANTE_LEGAL = 'REPRESENTANTE_LEGAL', _('Representante Legal')
        MIEMBRO_EMPRESA = 'MIEMBRO_EMPRESA', _('Miembro de Empresa')

    class Vigencia(models.TextChoices):
        QUINCE_DIAS = '15_DIAS', _('15 días')
        UN_MES = '1_MES', _('1 mes')
        UN_ANIO = '1_ANIO', _('1 año')
        DOS_ANIOS = '2_ANIOS', _('2 años')
        TRES_ANIOS = '3_ANIOS', _('3 años')
        CUATRO_ANIOS = '4_ANIOS', _('4 años')
        CINCO_ANIOS = '5_ANIOS', _('5 años')

    class Contenedor(models.TextChoices):
        ARCHIVO = 'ARCHIVO', _('Archivo')
        NUBE = 'NUBE', _('Nube')
        TOKEN = 'TOKEN', _('Token')

    class PlanInteres(models.TextChoices):
        BASICO = 'BASICO', _('Básico')
        PROFESIONAL = 'PROFESIONAL', _('Profesional')
        EMPRESARIAL = 'EMPRESARIAL', _('Empresarial')
        SOLO_FIRMA = 'SOLO_FIRMA', _('Solo firma')

    class Estado(models.TextChoices):
        NUEVA = 'NUEVA', _('Nueva')
        CONTACTADO = 'CONTACTADO', _('Contactado')
        DOCUMENTOS_PENDIENTES = 'DOCUMENTOS_PENDIENTES', _('Documentos pendientes')
        EN_REVISION = 'EN_REVISION', _('En revisión')
        ENVIADA_PROVEEDOR = 'ENVIADA_PROVEEDOR', _('Enviada a proveedor')
        EMITIDA = 'EMITIDA', _('Emitida')
        RECHAZADA = 'RECHAZADA', _('Rechazada')
        ANULADA = 'ANULADA', _('Anulada')

    class Origen(models.TextChoices):
        LANDING = 'LANDING', _('Landing')
        WHATSAPP = 'WHATSAPP', _('WhatsApp')
        REFERIDO_CONTADOR = 'REFERIDO_CONTADOR', _('Referido contador')
        CLIENTE_ERP = 'CLIENTE_ERP', _('Cliente ERP')
        REDES_SOCIALES = 'REDES_SOCIALES', _('Redes sociales')
        MANUAL_ADMINISTRATIVO = 'MANUAL_ADMINISTRATIVO', _('Manual administrativo')

    class Proveedor(models.TextChoices):
        UANATACA = 'UANATACA', _('Uanataca')
        NEXUS = 'NEXUS', _('Nexus')
        OTRO = 'OTRO', _('Otro')

    company = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes_firma',
        verbose_name=_('empresa'),
    )
    customer = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes_firma',
        verbose_name=_('cliente'),
    )
    request_type = models.CharField(_('tipo de solicitud'), max_length=30, choices=TipoSolicitud.choices)
    first_name = models.CharField(_('nombres'), max_length=120)
    last_name = models.CharField(_('apellidos'), max_length=120)
    identification = models.CharField(_('cédula'), max_length=20)
    fingerprint_code = models.CharField(_('código dactilar'), max_length=30)
    ruc = models.CharField(_('RUC'), max_length=20, blank=True)
    business_name = models.CharField(_('razón social'), max_length=180, blank=True)
    email = models.EmailField(_('correo electrónico'))
    phone = models.CharField(_('teléfono/celular'), max_length=20)
    province = models.CharField(_('provincia'), max_length=80)
    city = models.CharField(_('ciudad'), max_length=80)
    address = models.CharField(_('dirección'), max_length=255)
    validity = models.CharField(_('vigencia solicitada'), max_length=20, choices=Vigencia.choices)
    container_type = models.CharField(_('tipo de contenedor'), max_length=20, choices=Contenedor.choices, blank=True)
    wants_erp = models.BooleanField(_('también desea ERP'), default=False)
    interested_plan = models.CharField(_('plan de interés'), max_length=20, choices=PlanInteres.choices)
    status = models.CharField(_('estado'), max_length=30, choices=Estado.choices, default=Estado.NUEVA)
    source = models.CharField(_('origen'), max_length=30, choices=Origen.choices, default=Origen.MANUAL_ADMINISTRATIVO)
    provider = models.CharField(_('proveedor'), max_length=20, choices=Proveedor.choices, blank=True)
    internal_cost = models.DecimalField(_('costo interno'), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    sale_price = models.DecimalField(_('precio de venta'), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    margin = models.DecimalField(_('margen'), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    internal_notes = models.TextField(_('observaciones internas'), blank=True)
    provider_request_id = models.CharField(_('id solicitud proveedor'), max_length=120, blank=True, null=True)
    emitted_at = models.DateTimeField(_('fecha de emisión'), null=True, blank=True)
    rejected_reason = models.TextField(_('motivo de rechazo'), blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'electronic_signature_requests'
        verbose_name = _('solicitud de firma electrónica')
        verbose_name_plural = _('solicitudes de firma electrónica')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['request_type', 'status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['source']),
        ]

    def save(self, *args, **kwargs):
        self.margin = (self.sale_price or Decimal('0.00')) - (self.internal_cost or Decimal('0.00'))
        if self.status == self.Estado.EMITIDA and not self.emitted_at:
            self.emitted_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def __str__(self):
        return f'{self.full_name} - {self.get_status_display()}'


class DocumentoSolicitudFirma(models.Model):
    class TipoDocumento(models.TextChoices):
        CEDULA_ANVERSO = 'CEDULA_ANVERSO', _('Anverso de cédula')
        CEDULA_REVERSO = 'CEDULA_REVERSO', _('Reverso de cédula')
        SELFIE_CEDULA = 'SELFIE_CEDULA', _('Selfie con cédula')
        RUC_PDF = 'RUC_PDF', _('RUC PDF')
        NOMBRAMIENTO_REPRESENTANTE = 'NOMBRAMIENTO_REPRESENTANTE', _('Nombramiento representante legal')
        CARTA_AUTORIZACION = 'CARTA_AUTORIZACION', _('Carta de autorización')
        CEDULA_REPRESENTANTE = 'CEDULA_REPRESENTANTE', _('Cédula representante legal')
        VIDEO_AUTORIZACION = 'VIDEO_AUTORIZACION', _('Video de autorización')

    class EstadoDocumento(models.TextChoices):
        CARGADO = 'CARGADO', _('Cargado')
        APROBADO = 'APROBADO', _('Aprobado')
        RECHAZADO = 'RECHAZADO', _('Rechazado')

    request = models.ForeignKey(
        SolicitudFirmaElectronica,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name=_('solicitud'),
    )
    document_type = models.CharField(_('tipo de documento'), max_length=40, choices=TipoDocumento.choices)
    file = models.FileField(_('archivo'), upload_to=firma_document_upload_to)
    file_name = models.CharField(_('nombre de archivo'), max_length=255)
    mime_type = models.CharField(_('tipo MIME'), max_length=120, blank=True)
    status = models.CharField(_('estado'), max_length=20, choices=EstadoDocumento.choices, default=EstadoDocumento.CARGADO)
    uploaded_at = models.DateTimeField(_('fecha de carga'), auto_now_add=True)

    class Meta:
        db_table = 'electronic_signature_request_documents'
        verbose_name = _('documento de solicitud de firma')
        verbose_name_plural = _('documentos de solicitud de firma')
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['request', 'document_type']),
        ]

    @property
    def file_url(self):
        return ''

    def __str__(self):
        return f'{self.request_id} - {self.get_document_type_display()}'


class HistorialEstadoSolicitudFirma(models.Model):
    request = models.ForeignKey(
        SolicitudFirmaElectronica,
        on_delete=models.CASCADE,
        related_name='status_history',
        verbose_name=_('solicitud'),
    )
    previous_status = models.CharField(_('estado anterior'), max_length=30, blank=True)
    new_status = models.CharField(_('nuevo estado'), max_length=30)
    comment = models.TextField(_('comentario'), blank=True)
    changed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cambios_estado_firma',
        verbose_name=_('usuario que cambió'),
    )
    created_at = models.DateTimeField(_('fecha de cambio'), auto_now_add=True)

    class Meta:
        db_table = 'electronic_signature_request_status_history'
        verbose_name = _('historial de estado de firma')
        verbose_name_plural = _('historial de estados de firma')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.request_id}: {self.previous_status} -> {self.new_status}'


class SolicitudDemoERP(models.Model):
    class PlanInteres(models.TextChoices):
        BASICO = 'BASICO', _('Básico')
        PROFESIONAL = 'PROFESIONAL', _('Profesional')
        EMPRESARIAL = 'EMPRESARIAL', _('Empresarial')
        NO_SEGURO = 'NO_SEGURO', _('No estoy seguro')

    class Estado(models.TextChoices):
        NUEVA = 'NUEVA', _('Nueva')
        CONTACTADO = 'CONTACTADO', _('Contactado')
        DEMO_AGENDADA = 'DEMO_AGENDADA', _('Demo agendada')
        CONVERTIDA = 'CONVERTIDA', _('Convertida')
        DESCARTADA = 'DESCARTADA', _('Descartada')

    class Origen(models.TextChoices):
        LANDING = 'LANDING', _('Landing')
        PRECIOS = 'PRECIOS', _('Planes y precios')
        WHATSAPP = 'WHATSAPP', _('WhatsApp')
        REFERIDO = 'REFERIDO', _('Referido')
        OTRO = 'OTRO', _('Otro')

    business_name = models.CharField(_('negocio'), max_length=180)
    contact_name = models.CharField(_('contacto'), max_length=160)
    email = models.EmailField(_('correo electrónico'))
    phone = models.CharField(_('teléfono/celular'), max_length=20)
    city = models.CharField(_('ciudad'), max_length=80, blank=True)
    business_type = models.CharField(_('tipo de negocio'), max_length=120, blank=True)
    interested_plan = models.CharField(_('plan de interés'), max_length=20, choices=PlanInteres.choices, default=PlanInteres.NO_SEGURO)
    needs_signature = models.BooleanField(_('necesita firma electrónica'), default=False)
    already_has_signature = models.BooleanField(_('ya tiene firma electrónica'), default=False)
    message = models.TextField(_('mensaje'), blank=True)
    source = models.CharField(_('origen'), max_length=20, choices=Origen.choices, default=Origen.LANDING)
    status = models.CharField(_('estado'), max_length=20, choices=Estado.choices, default=Estado.NUEVA)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'erp_demo_requests'
        verbose_name = _('solicitud de demo ERP')
        verbose_name_plural = _('solicitudes de demo ERP')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['source']),
            models.Index(fields=['interested_plan']),
        ]

    def __str__(self):
        return f'{self.business_name} - {self.contact_name}'
