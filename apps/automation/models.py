from django.db import models
from django.utils.translation import gettext_lazy as _


class CommercialLead(models.Model):
    class InterestType(models.TextChoices):
        SIGNATURE = 'signature', _('Firma electrónica')
        ERP = 'erp', _('ERP FacturaOF1')
        INVOICING = 'invoicing', _('Facturación electrónica')
        CUSTOM_SOFTWARE = 'custom_software', _('Desarrollo a medida')
        AUTOMATION_AI = 'automation_ai', _('Automatización e IA')
        CHATBOT = 'chatbot', _('Chatbots')
        INTEGRATION = 'integration', _('Integraciones')
        SUPPORT = 'support', _('Soporte')
        UNKNOWN = 'unknown', _('No definido')

    class Status(models.TextChoices):
        NEW = 'new', _('Nuevo')
        CONTACTED = 'contacted', _('Contactado')
        QUALIFIED = 'qualified', _('Calificado')
        REQUIRES_HUMAN = 'requires_human', _('Requiere humano')
        CONVERTED = 'converted', _('Convertido')
        CLOSED = 'closed', _('Cerrado')

    class Priority(models.TextChoices):
        LOW = 'low', _('Baja')
        MEDIUM = 'medium', _('Media')
        HIGH = 'high', _('Alta')

    phone = models.CharField(_('teléfono'), max_length=32, blank=True)
    normalized_phone = models.CharField(_('teléfono normalizado'), max_length=32, blank=True)
    contact_key = models.CharField(_('clave de contacto'), max_length=160, blank=True)
    reply_to_jid = models.CharField(_('JID de respuesta'), max_length=160, blank=True)
    from_jid = models.CharField(_('JID remitente'), max_length=160, blank=True)
    remote_jid = models.CharField(_('JID chat'), max_length=160, blank=True)
    push_name = models.CharField(_('nombre WhatsApp'), max_length=160, blank=True)
    is_lid = models.BooleanField(_('es LID'), default=False)
    source_channel = models.CharField(_('canal'), max_length=30, default='whatsapp')
    name = models.CharField(_('nombre'), max_length=160, blank=True)
    company = models.CharField(_('empresa'), max_length=180, blank=True)
    email = models.EmailField(_('correo'), blank=True)
    interest_type = models.CharField(_('tipo de interés'), max_length=40, choices=InterestType.choices, default=InterestType.UNKNOWN)
    status = models.CharField(_('estado'), max_length=30, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(_('prioridad'), max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    summary = models.TextField(_('resumen'), blank=True)
    last_category = models.CharField(_('última categoría'), max_length=40, blank=True)
    last_intent = models.CharField(_('última intención'), max_length=40, blank=True)
    last_ai_confidence = models.DecimalField(_('última confianza IA'), max_digits=4, decimal_places=3, null=True, blank=True)
    last_interaction_at = models.DateTimeField(_('última interacción'), null=True, blank=True)
    assigned_to = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='automation_leads',
        verbose_name=_('asesor asignado'),
    )
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'automation_commercial_leads'
        verbose_name = _('lead comercial')
        verbose_name_plural = _('leads comerciales')
        ordering = ['-last_interaction_at', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['normalized_phone', 'source_channel'],
                condition=~models.Q(normalized_phone=''),
                name='uniq_automation_lead_phone_channel',
            ),
            models.UniqueConstraint(
                fields=['contact_key', 'source_channel'],
                condition=~models.Q(contact_key=''),
                name='uniq_automation_lead_contact_key_channel',
            ),
        ]
        indexes = [
            models.Index(fields=['interest_type', 'status']),
            models.Index(fields=['priority', 'status']),
            models.Index(fields=['last_interaction_at']),
        ]

    def __str__(self):
        return f'{self.normalized_phone or self.contact_key} - {self.interest_type}'


class WhatsAppInteraction(models.Model):
    class Direction(models.TextChoices):
        INBOUND = 'INBOUND', _('Entrante')
        OUTBOUND = 'OUTBOUND', _('Saliente')

    class MessageType(models.TextChoices):
        TEXT = 'text', _('Texto')
        IMAGE = 'image', _('Imagen')
        AUDIO = 'audio', _('Audio')
        VIDEO = 'video', _('Video')
        DOCUMENT = 'document', _('Documento')
        UNKNOWN = 'unknown', _('Desconocido')

    lead = models.ForeignKey(
        CommercialLead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='interactions',
        verbose_name=_('lead'),
    )
    signature_order = models.ForeignKey(
        'firmas.SolicitudFirmaElectronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_interactions',
        verbose_name=_('pedido de firma'),
    )
    direction = models.CharField(_('dirección'), max_length=10, choices=Direction.choices)
    phone = models.CharField(_('teléfono'), max_length=32, blank=True)
    normalized_phone = models.CharField(_('teléfono normalizado'), max_length=32, blank=True)
    contact_key = models.CharField(_('clave de contacto'), max_length=160, blank=True)
    reply_to_jid = models.CharField(_('JID de respuesta'), max_length=160, blank=True)
    from_jid = models.CharField(_('JID remitente'), max_length=160, blank=True)
    remote_jid = models.CharField(_('JID chat'), max_length=160, blank=True)
    push_name = models.CharField(_('nombre WhatsApp'), max_length=160, blank=True)
    is_lid = models.BooleanField(_('es LID'), default=False)
    channel = models.CharField(_('canal'), max_length=30, default='whatsapp')
    message_body = models.TextField(_('mensaje'), blank=True)
    message_type = models.CharField(_('tipo de mensaje'), max_length=20, choices=MessageType.choices, default=MessageType.TEXT)
    message_id = models.CharField(_('id mensaje'), max_length=160, blank=True)
    idempotency_key = models.CharField(_('clave de idempotencia'), max_length=220, unique=True)
    category = models.CharField(_('categoría'), max_length=40, blank=True)
    intent = models.CharField(_('intención'), max_length=40, blank=True)
    ai_confidence = models.DecimalField(_('confianza IA'), max_digits=4, decimal_places=3, null=True, blank=True)
    ai_summary = models.TextField(_('resumen IA'), blank=True)
    requires_human = models.BooleanField(_('requiere humano'), default=False)
    template_key = models.CharField(_('plantilla'), max_length=80, blank=True)
    gateway_status = models.CharField(_('estado gateway'), max_length=40, blank=True)
    raw_payload = models.JSONField(_('payload'), default=dict, blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)

    class Meta:
        db_table = 'automation_whatsapp_interactions'
        verbose_name = _('interacción WhatsApp')
        verbose_name_plural = _('interacciones WhatsApp')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['normalized_phone', 'channel', 'created_at']),
            models.Index(fields=['contact_key', 'channel', 'created_at']),
            models.Index(fields=['direction', 'created_at']),
            models.Index(fields=['category', 'intent']),
            models.Index(fields=['requires_human']),
        ]

    def __str__(self):
        return f'{self.direction} {self.normalized_phone or self.contact_key} {self.created_at:%Y-%m-%d %H:%M}'


class AutomationWebhookEvent(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        SENT = 'SENT', _('Enviado')
        FAILED = 'FAILED', _('Fallido')
        SKIPPED = 'SKIPPED', _('Omitido')

    event_id = models.CharField(_('id evento'), max_length=80, unique=True)
    event_type = models.CharField(_('tipo de evento'), max_length=80)
    entity_type = models.CharField(_('tipo de entidad'), max_length=80, blank=True)
    entity_id = models.CharField(_('id entidad'), max_length=80, blank=True)
    idempotency_key = models.CharField(_('clave de idempotencia'), max_length=220, unique=True)
    payload = models.JSONField(_('payload'), default=dict, blank=True)
    target_url = models.URLField(_('url destino'), blank=True)
    status = models.CharField(_('estado'), max_length=20, choices=Status.choices, default=Status.PENDING)
    attempt_count = models.PositiveSmallIntegerField(_('intentos'), default=0)
    last_error = models.TextField(_('último error'), blank=True)
    sent_at = models.DateTimeField(_('fecha de envío'), null=True, blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    updated_at = models.DateTimeField(_('fecha de actualización'), auto_now=True)

    class Meta:
        db_table = 'automation_webhook_events'
        verbose_name = _('evento webhook automation')
        verbose_name_plural = _('eventos webhook automation')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', 'status']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.event_type} - {self.status}'


class AutomationAuditLog(models.Model):
    class ActorType(models.TextChoices):
        SYSTEM = 'SYSTEM', _('Sistema')
        N8N = 'N8N', _('n8n')
        USER = 'USER', _('Usuario')
        GATEWAY = 'GATEWAY', _('Gateway')

    actor_type = models.CharField(_('tipo actor'), max_length=20, choices=ActorType.choices, default=ActorType.N8N)
    actor_id = models.CharField(_('id actor'), max_length=120, blank=True)
    action = models.CharField(_('acción'), max_length=120)
    entity_type = models.CharField(_('tipo entidad'), max_length=80, blank=True)
    entity_id = models.CharField(_('id entidad'), max_length=80, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    created_at = models.DateTimeField(_('fecha de creación'), auto_now_add=True)

    class Meta:
        db_table = 'automation_audit_logs'
        verbose_name = _('auditoría automation')
        verbose_name_plural = _('auditoría automation')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self):
        return f'{self.action} - {self.entity_type}:{self.entity_id}'
