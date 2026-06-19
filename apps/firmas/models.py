from decimal import Decimal
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .storage import SignatureDocumentStorage


def firma_document_upload_to(instance, filename):
    request_number = instance.request.request_number or instance.request_id
    return f'firmas/solicitudes/{request_number}/{instance.document_type}/{filename}'


class SolicitudFirmaElectronica(models.Model):
    class TipoIdentificacion(models.TextChoices):
        CEDULA = 'CEDULA', _('Cédula')
        PASAPORTE = 'PASAPORTE', _('Pasaporte')
        RUC = 'RUC', _('RUC')

    class TipoSolicitud(models.TextChoices):
        PERSONA_NATURAL = 'PERSONA_NATURAL', _('Persona Natural')
        REPRESENTANTE_LEGAL = 'REPRESENTANTE_LEGAL', _('Representante Legal')
        MIEMBRO_EMPRESA = 'MIEMBRO_EMPRESA', _('Miembro de Empresa')

    class Vigencia(models.TextChoices):
        SIETE_DIAS = '7_DIAS', _('7 días')
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
    request_number = models.CharField(_('número de solicitud'), max_length=30, unique=True, null=True, blank=True)
    request_type = models.CharField(_('tipo de solicitud'), max_length=30, choices=TipoSolicitud.choices)
    identification_type = models.CharField(_('tipo de identificación'), max_length=20, choices=TipoIdentificacion.choices, default=TipoIdentificacion.CEDULA)
    first_name = models.CharField(_('nombres'), max_length=120)
    last_name = models.CharField(_('apellidos'), max_length=120)
    second_last_name = models.CharField(_('segundo apellido'), max_length=120, blank=True)
    identification = models.CharField(_('cédula'), max_length=20)
    fingerprint_code = models.CharField(_('código dactilar'), max_length=30)
    birth_date = models.DateField(_('fecha de nacimiento'), null=True, blank=True)
    nationality = models.CharField(_('nacionalidad'), max_length=80, default='ECUATORIANA', blank=True)
    gender = models.CharField(_('sexo'), max_length=20, blank=True)
    ruc = models.CharField(_('RUC'), max_length=20, blank=True)
    has_ruc = models.BooleanField(_('tiene RUC'), default=False)
    business_name = models.CharField(_('razón social'), max_length=180, blank=True)
    company_unit = models.CharField(_('unidad de empresa'), max_length=120, blank=True)
    applicant_position = models.CharField(_('cargo'), max_length=120, blank=True)
    request_reason = models.CharField(_('motivo de solicitud'), max_length=180, blank=True)
    email = models.EmailField(_('correo electrónico'))
    secondary_email = models.EmailField(_('correo electrónico secundario'), blank=True)
    phone = models.CharField(_('teléfono/celular'), max_length=20)
    secondary_phone = models.CharField(_('teléfono secundario'), max_length=20, blank=True)
    province = models.CharField(_('provincia'), max_length=80)
    city = models.CharField(_('ciudad'), max_length=80)
    address = models.CharField(_('dirección'), max_length=255)
    representative_identification_type = models.CharField(_('tipo identificación representante'), max_length=20, choices=TipoIdentificacion.choices, blank=True)
    representative_identification = models.CharField(_('identificación representante'), max_length=20, blank=True)
    representative_names = models.CharField(_('nombres representante'), max_length=120, blank=True)
    representative_last_names = models.CharField(_('apellidos representante'), max_length=160, blank=True)
    validity = models.CharField(_('vigencia solicitada'), max_length=20, choices=Vigencia.choices)
    container_type = models.CharField(_('tipo de contenedor'), max_length=20, choices=Contenedor.choices, blank=True)
    wants_erp = models.BooleanField(_('también desea ERP'), default=False)
    interested_plan = models.CharField(_('plan de interés'), max_length=20, choices=PlanInteres.choices)
    status = models.CharField(_('estado'), max_length=30, choices=Estado.choices, default=Estado.NUEVA)
    source = models.CharField(_('origen'), max_length=30, choices=Origen.choices, default=Origen.MANUAL_ADMINISTRATIVO)
    provider = models.CharField(_('proveedor'), max_length=20, choices=Proveedor.choices, blank=True)
    price_catalog = models.ForeignKey(
        'firmas.FirmaPrecioElectronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes',
        verbose_name=_('precio de catálogo'),
    )
    promotion_applied = models.ForeignKey(
        'firmas.FirmaPromocionElectronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes',
        verbose_name=_('promoción aplicada'),
    )
    coupon_applied = models.ForeignKey(
        'firmas.FirmaCuponElectronico',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes',
    )
    coupon_code = models.CharField(max_length=40, blank=True)
    regular_price = models.DecimalField(_('precio normal'), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(_('descuento aplicado'), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    coupon_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('15.00'))
    subtotal_without_tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
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
            models.Index(fields=['request_number']),
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
        if not self.request_number:
            self.request_number = f'FE-{self.created_at:%Y}-{self.id:06d}'
            super().save(update_fields=['request_number'])

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name} {self.second_last_name}'.strip()

    def __str__(self):
        return f'{self.request_number or self.id} - {self.full_name} - {self.get_status_display()}'


class FirmaPrecioElectronica(models.Model):
    validity = models.CharField(_('vigencia'), max_length=20, choices=SolicitudFirmaElectronica.Vigencia.choices, unique=True)
    regular_price = models.DecimalField(_('precio final incluido IVA'), max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('15.00'))
    active = models.BooleanField(_('activo'), default=True)
    order = models.PositiveSmallIntegerField(_('orden'), default=0)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'electronic_signature_prices'
        verbose_name = _('precio de firma electrónica')
        verbose_name_plural = _('precios de firma electrónica')
        ordering = ['order', 'regular_price']

    def active_promotion(self):
        today = timezone.localdate()
        return (
            self.promotions
            .filter(active=True, start_date__lte=today, end_date__gte=today)
            .order_by('promotional_price', 'end_date', 'id')
            .first()
        )

    @property
    def current_price(self):
        promotion = self.active_promotion()
        return promotion.promotional_price if promotion else self.regular_price

    def __str__(self):
        return f'{self.get_validity_display()} - ${self.regular_price}'


class FirmaPromocionElectronica(models.Model):
    class DiscountType(models.TextChoices):
        FINAL_PRICE = 'FINAL_PRICE', 'Precio final con IVA'
        PERCENTAGE = 'PERCENTAGE', 'Porcentaje sobre precio sin IVA'

    price = models.ForeignKey(
        FirmaPrecioElectronica,
        on_delete=models.CASCADE,
        related_name='promotions',
        verbose_name=_('precio'),
    )
    name = models.CharField(_('nombre'), max_length=120)
    group_key = models.UUIDField(default=uuid.uuid4, db_index=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.FINAL_PRICE)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    promotional_price = models.DecimalField(_('precio promocional incluido IVA'), max_digits=10, decimal_places=2)
    start_date = models.DateField(_('fecha de inicio'))
    end_date = models.DateField(_('fecha de fin'))
    active = models.BooleanField(_('activo'), default=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'electronic_signature_promotions'
        verbose_name = _('promoción de firma electrónica')
        verbose_name_plural = _('promociones de firma electrónica')
        ordering = ['-active', '-start_date', 'end_date']
        indexes = [models.Index(fields=['price', 'active', 'start_date', 'end_date'])]

    @property
    def is_current(self):
        today = timezone.localdate()
        return self.active and self.start_date <= today <= self.end_date

    def __str__(self):
        return f'{self.name} - {self.price.get_validity_display()}'


class FirmaCuponElectronico(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE', 'Porcentaje'
        FIXED_AMOUNT = 'FIXED_AMOUNT', 'Monto fijo'

    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    prices = models.ManyToManyField(FirmaPrecioElectronica, blank=True, related_name='coupons')
    start_date = models.DateField()
    end_date = models.DateField()
    minimum_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    max_total_uses = models.PositiveIntegerField(null=True, blank=True)
    max_uses_per_customer = models.PositiveIntegerField(default=1)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'electronic_signature_coupons'
        ordering = ['-active', '-start_date', 'code']
        indexes = [models.Index(fields=['code', 'active', 'start_date', 'end_date'])]

    @property
    def is_current(self):
        today = timezone.localdate()
        return self.active and self.start_date <= today <= self.end_date

    def save(self, *args, **kwargs):
        self.code = (self.code or '').strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.code} - {self.name}'


class FirmaCuponUso(models.Model):
    coupon = models.ForeignKey(FirmaCuponElectronico, on_delete=models.PROTECT, related_name='uses')
    request = models.OneToOneField(SolicitudFirmaElectronica, on_delete=models.CASCADE, related_name='coupon_use')
    customer_key = models.CharField(max_length=160, db_index=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'electronic_signature_coupon_uses'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['coupon', 'customer_key'])]


class DocumentoSolicitudFirma(models.Model):
    class TipoDocumento(models.TextChoices):
        CEDULA_ANVERSO = 'CEDULA_ANVERSO', _('Anverso de cédula')
        CEDULA_REVERSO = 'CEDULA_REVERSO', _('Reverso de cédula')
        SELFIE_CEDULA = 'SELFIE_CEDULA', _('Selfie con cédula')
        RUC_PDF = 'RUC_PDF', _('RUC PDF')
        CONSTITUCION_COMPANIA = 'CONSTITUCION_COMPANIA', _('Constitución de compañía')
        NOMBRAMIENTO_REPRESENTANTE = 'NOMBRAMIENTO_REPRESENTANTE', _('Nombramiento representante legal')
        ACEPTACION_NOMBRAMIENTO = 'ACEPTACION_NOMBRAMIENTO', _('Aceptación de nombramiento')
        CARTA_AUTORIZACION = 'CARTA_AUTORIZACION', _('Carta de autorización')
        CEDULA_REPRESENTANTE = 'CEDULA_REPRESENTANTE', _('Cédula representante legal')
        VIDEO_AUTORIZACION = 'VIDEO_AUTORIZACION', _('Video de autorización')
        DOCUMENTO_ADICIONAL = 'DOCUMENTO_ADICIONAL', _('Documento adicional')

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
    file = models.FileField(_('archivo'), upload_to=firma_document_upload_to, storage=SignatureDocumentStorage())
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
