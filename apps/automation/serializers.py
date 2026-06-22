import hashlib
import json
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.firmas.models import HistorialEstadoSolicitudFirma, SolicitudFirmaElectronica

from .models import AutomationAuditLog, AutomationPrivacyConsent, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction


AUTOMATION_PRIVACY_NOTICE_VERSION = 'privacidad-2026-06-22'

LEAD_INTEREST_ALIASES = {
    'firma_electronica': CommercialLead.InterestType.SIGNATURE,
    'firma': CommercialLead.InterestType.SIGNATURE,
    'signature': CommercialLead.InterestType.SIGNATURE,
    'erp': CommercialLead.InterestType.ERP,
    'facturaof1': CommercialLead.InterestType.ERP,
    'facturacion_electronica': CommercialLead.InterestType.INVOICING,
    'facturación_electrónica': CommercialLead.InterestType.INVOICING,
    'invoicing': CommercialLead.InterestType.INVOICING,
    'desarrollo_software': CommercialLead.InterestType.CUSTOM_SOFTWARE,
    'software': CommercialLead.InterestType.CUSTOM_SOFTWARE,
    'custom_software': CommercialLead.InterestType.CUSTOM_SOFTWARE,
    'ia': CommercialLead.InterestType.AUTOMATION_AI,
    'inteligencia_artificial': CommercialLead.InterestType.AUTOMATION_AI,
    'automatizacion': CommercialLead.InterestType.AUTOMATION_AI,
    'automatización': CommercialLead.InterestType.AUTOMATION_AI,
    'automation_ai': CommercialLead.InterestType.AUTOMATION_AI,
    'chatbot': CommercialLead.InterestType.CHATBOT,
    'chatbots': CommercialLead.InterestType.CHATBOT,
    'integracion': CommercialLead.InterestType.INTEGRATION,
    'integración': CommercialLead.InterestType.INTEGRATION,
    'integration': CommercialLead.InterestType.INTEGRATION,
    'soporte': CommercialLead.InterestType.SUPPORT,
    'support': CommercialLead.InterestType.SUPPORT,
    'pago': CommercialLead.InterestType.PAYMENT,
    'payment': CommercialLead.InterestType.PAYMENT,
    'pagos': CommercialLead.InterestType.PAYMENT,
    'documento': CommercialLead.InterestType.DOCUMENTS,
    'documentos': CommercialLead.InterestType.DOCUMENTS,
    'documents': CommercialLead.InterestType.DOCUMENTS,
    'humano': CommercialLead.InterestType.HUMAN,
    'human': CommercialLead.InterestType.HUMAN,
    'otro': CommercialLead.InterestType.UNKNOWN,
    'unknown': CommercialLead.InterestType.UNKNOWN,
}

LEAD_STATUS_ALIASES = {
    'nuevo': CommercialLead.Status.NEW,
    'new': CommercialLead.Status.NEW,
    'responded_bot': CommercialLead.Status.BOT_RESPONDED,
    'bot_responded': CommercialLead.Status.BOT_RESPONDED,
    'bot': CommercialLead.Status.BOT_RESPONDED,
    'in_follow_up': CommercialLead.Status.IN_FOLLOW_UP,
    'seguimiento': CommercialLead.Status.IN_FOLLOW_UP,
    'contactado': CommercialLead.Status.CONTACTED,
    'contacted': CommercialLead.Status.CONTACTED,
    'qualified': CommercialLead.Status.QUALIFIED,
    'calificado': CommercialLead.Status.QUALIFIED,
    'requires_human': CommercialLead.Status.REQUIRES_HUMAN,
    'requiere_humano': CommercialLead.Status.REQUIRES_HUMAN,
    'human': CommercialLead.Status.REQUIRES_HUMAN,
    'proposal_sent': CommercialLead.Status.PROPOSAL_SENT,
    'propuesta_enviada': CommercialLead.Status.PROPOSAL_SENT,
    'converted': CommercialLead.Status.CONVERTED,
    'convertido': CommercialLead.Status.CONVERTED,
    'lost': CommercialLead.Status.LOST,
    'perdido': CommercialLead.Status.LOST,
    'closed': CommercialLead.Status.CLOSED,
    'cerrado': CommercialLead.Status.CLOSED,
}

LEAD_PRIORITY_ALIASES = {
    'low': CommercialLead.Priority.LOW,
    'baja': CommercialLead.Priority.LOW,
    'medium': CommercialLead.Priority.MEDIUM,
    'media': CommercialLead.Priority.MEDIUM,
    'high': CommercialLead.Priority.HIGH,
    'alta': CommercialLead.Priority.HIGH,
}


def normalize_choice(value, aliases, default):
    key = str(value or '').strip().lower()
    return aliases.get(key, default)

def normalize_phone(value):
    raw = str(value or '').strip()
    if '@' in raw and not raw.endswith('@s.whatsapp.net'):
        return ''
    if raw.endswith('@s.whatsapp.net'):
        raw = raw.replace('@s.whatsapp.net', '')
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ''
    if digits.startswith('0'):
        digits = f'593{digits[1:]}'
    if not digits.startswith('593') and len(digits) == 9:
        digits = f'593{digits}'
    return digits


def build_hash(*parts):
    raw = '|'.join(str(part or '') for part in parts)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


class CommercialLeadSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    normalized_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    contact_key = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    reply_to_jid = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    from_jid = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    remote_jid = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    push_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    interest_type = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.CharField(required=False, allow_blank=True)
    created = serializers.BooleanField(read_only=True)

    class Meta:
        model = CommercialLead
        fields = [
            'id', 'phone', 'normalized_phone', 'contact_key', 'reply_to_jid', 'from_jid',
            'remote_jid', 'push_name', 'is_lid', 'source_channel', 'name', 'company', 'email',
            'interest_type', 'status', 'priority', 'summary', 'internal_notes', 'last_category', 'last_intent',
            'last_ai_confidence', 'last_interaction_at', 'metadata', 'created_at', 'updated_at', 'created',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'normalized_phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'contact_key': {'required': False, 'allow_blank': True, 'allow_null': True},
            'reply_to_jid': {'required': False, 'allow_blank': True, 'allow_null': True},
            'from_jid': {'required': False, 'allow_blank': True, 'allow_null': True},
            'remote_jid': {'required': False, 'allow_blank': True, 'allow_null': True},
            'push_name': {'required': False, 'allow_blank': True, 'allow_null': True},
        }

    def validate(self, attrs):
        phone = attrs.get('normalized_phone') or attrs.get('phone') or self.initial_data.get('phone')
        normalized = normalize_phone(phone)
        contact_key = (
            attrs.get('contact_key')
            or self.initial_data.get('contact_key')
            or self.initial_data.get('reply_to_jid')
            or self.initial_data.get('from_jid')
            or self.initial_data.get('remote_jid')
            or self.initial_data.get('from')
            or self.initial_data.get('to')
            or normalized
        )
        if not normalized and not contact_key:
            raise serializers.ValidationError({'contact_key': 'Debe enviar phone/normalized_phone o contact_key/JID.'})
        attrs['normalized_phone'] = normalized
        attrs['phone'] = attrs.get('phone') or (phone if normalized else '')
        attrs['contact_key'] = str(contact_key or '').strip()
        attrs['reply_to_jid'] = attrs.get('reply_to_jid') or self.initial_data.get('reply_to_jid') or ''
        attrs['from_jid'] = attrs.get('from_jid') or self.initial_data.get('from_jid') or ''
        attrs['remote_jid'] = attrs.get('remote_jid') or self.initial_data.get('remote_jid') or ''
        attrs['push_name'] = attrs.get('push_name') or self.initial_data.get('push_name') or ''
        attrs['is_lid'] = bool(attrs.get('is_lid') or self.initial_data.get('is_lid') or str(attrs['contact_key']).endswith('@lid'))
        attrs['source_channel'] = attrs.get('source_channel') or self.initial_data.get('channel') or 'whatsapp'
        attrs['interest_type'] = normalize_choice(
            attrs.get('interest_type') or self.initial_data.get('category'),
            LEAD_INTEREST_ALIASES,
            CommercialLead.InterestType.UNKNOWN,
        )
        attrs['status'] = normalize_choice(
            attrs.get('status'),
            LEAD_STATUS_ALIASES,
            CommercialLead.Status.NEW,
        )
        attrs['priority'] = normalize_choice(
            attrs.get('priority') or self.initial_data.get('lead_priority'),
            LEAD_PRIORITY_ALIASES,
            CommercialLead.Priority.MEDIUM,
        )
        return attrs

    def create(self, validated_data):
        source_channel = validated_data.get('source_channel', 'whatsapp')
        if validated_data.get('normalized_phone'):
            lookup = {
                'normalized_phone': validated_data['normalized_phone'],
                'source_channel': source_channel,
            }
        else:
            lookup = {
                'contact_key': validated_data['contact_key'],
                'source_channel': source_channel,
            }
        defaults = dict(validated_data)
        if not defaults.get('last_interaction_at'):
            defaults['last_interaction_at'] = timezone.now()
        lead, created = CommercialLead.objects.update_or_create(defaults=defaults, **lookup)
        lead.created = created
        return lead


class WhatsAppInteractionSerializer(serializers.ModelSerializer):
    created = serializers.BooleanField(read_only=True)
    lead_id = serializers.IntegerField(read_only=True)
    signature_order_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    upsert_lead = serializers.BooleanField(required=False, default=True, write_only=True)

    class Meta:
        model = WhatsAppInteraction
        fields = [
            'id', 'lead_id', 'signature_order_id', 'direction', 'phone', 'normalized_phone', 'channel',
            'contact_key', 'reply_to_jid', 'from_jid', 'remote_jid', 'push_name', 'is_lid',
            'message_body', 'message_type', 'message_id', 'idempotency_key', 'category', 'intent',
            'ai_confidence', 'ai_summary', 'requires_human', 'template_key', 'gateway_status',
            'raw_payload', 'created_at', 'created', 'upsert_lead',
        ]
        read_only_fields = ['id', 'lead_id', 'created_at']
        extra_kwargs = {
            'idempotency_key': {'required': False, 'allow_blank': True, 'validators': []},
            'phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'normalized_phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'contact_key': {'required': False, 'allow_blank': True, 'allow_null': True},
            'reply_to_jid': {'required': False, 'allow_blank': True, 'allow_null': True},
            'from_jid': {'required': False, 'allow_blank': True, 'allow_null': True},
            'remote_jid': {'required': False, 'allow_blank': True, 'allow_null': True},
            'push_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'message_body': {'required': False, 'allow_blank': True},
            'message_id': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        initial = self.initial_data
        phone = attrs.get('normalized_phone') or attrs.get('phone') or initial.get('phone')
        normalized = normalize_phone(phone)
        contact_key = (
            attrs.get('contact_key')
            or initial.get('contact_key')
            or initial.get('reply_to_jid')
            or initial.get('from_jid')
            or initial.get('remote_jid')
            or initial.get('from')
            or initial.get('to')
            or normalized
        )
        if not normalized and not contact_key:
            raise serializers.ValidationError({'contact_key': 'Debe enviar phone/contact_key/from/to.'})
        attrs['normalized_phone'] = normalized
        attrs['phone'] = attrs.get('phone') or (phone if normalized else '')
        attrs['contact_key'] = str(contact_key or '').strip()
        attrs['reply_to_jid'] = attrs.get('reply_to_jid') or initial.get('reply_to_jid') or ''
        attrs['from_jid'] = attrs.get('from_jid') or initial.get('from_jid') or ''
        attrs['remote_jid'] = attrs.get('remote_jid') or initial.get('remote_jid') or ''
        attrs['push_name'] = attrs.get('push_name') or initial.get('push_name') or ''
        attrs['is_lid'] = bool(attrs.get('is_lid') or initial.get('is_lid') or str(attrs['contact_key']).endswith('@lid'))
        attrs['channel'] = attrs.get('channel') or initial.get('channel') or 'whatsapp'
        attrs['message_body'] = attrs.get('message_body') or initial.get('body') or initial.get('message') or ''
        attrs['message_type'] = attrs.get('message_type') or initial.get('type') or 'text'
        attrs['message_id'] = attrs.get('message_id') or initial.get('messageId') or initial.get('message_id') or ''
        attrs['raw_payload'] = attrs.get('raw_payload') or dict(initial)
        if attrs.get('ai_confidence') in ('', None):
            attrs['ai_confidence'] = None

        if not attrs.get('idempotency_key'):
            message_key = attrs.get('message_id') or build_hash(
                attrs.get('direction'), attrs.get('normalized_phone') or attrs.get('contact_key'), attrs.get('message_body'), attrs.get('raw_payload')
            )
            identity_key = attrs.get('normalized_phone') or attrs.get('contact_key')
            attrs['idempotency_key'] = f"whatsapp:{attrs.get('channel')}:{attrs.get('direction')}:{identity_key}:{message_key}"
        return attrs

    def create(self, validated_data):
        upsert_lead = validated_data.pop('upsert_lead', True)
        signature_order_id = validated_data.pop('signature_order_id', None)
        lead = None
        if upsert_lead:
            lead_defaults = {
                'phone': validated_data.get('phone', ''),
                'normalized_phone': validated_data.get('normalized_phone', ''),
                'contact_key': validated_data.get('contact_key', ''),
                'reply_to_jid': validated_data.get('reply_to_jid', ''),
                'from_jid': validated_data.get('from_jid', ''),
                'remote_jid': validated_data.get('remote_jid', ''),
                'push_name': validated_data.get('push_name', ''),
                'is_lid': validated_data.get('is_lid', False),
                'interest_type': validated_data.get('category') or CommercialLead.InterestType.UNKNOWN,
                'last_category': validated_data.get('category', ''),
                'last_intent': validated_data.get('intent', ''),
                'last_ai_confidence': validated_data.get('ai_confidence'),
                'summary': validated_data.get('ai_summary', ''),
                'last_interaction_at': timezone.now(),
            }
            if validated_data.get('requires_human'):
                lead_defaults['status'] = CommercialLead.Status.REQUIRES_HUMAN
                lead_defaults['priority'] = CommercialLead.Priority.HIGH
            source_channel = validated_data.get('channel', 'whatsapp')
            if validated_data.get('normalized_phone'):
                lead_lookup = {'normalized_phone': validated_data['normalized_phone'], 'source_channel': source_channel}
            else:
                lead_lookup = {'contact_key': validated_data['contact_key'], 'source_channel': source_channel}
            lead, _ = CommercialLead.objects.update_or_create(defaults=lead_defaults, **lead_lookup)
        if signature_order_id:
            validated_data['signature_order_id'] = signature_order_id
        if lead:
            validated_data['lead'] = lead
        interaction, created = WhatsAppInteraction.objects.get_or_create(
            idempotency_key=validated_data['idempotency_key'],
            defaults=validated_data,
        )
        interaction.created = created
        return interaction


class WhatsAppInteractionAdminSerializer(serializers.ModelSerializer):
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)
    message_type_display = serializers.CharField(source='get_message_type_display', read_only=True)

    class Meta:
        model = WhatsAppInteraction
        fields = [
            'id', 'direction', 'direction_display', 'phone', 'normalized_phone', 'contact_key',
            'reply_to_jid', 'from_jid', 'remote_jid', 'push_name', 'is_lid', 'channel',
            'message_body', 'message_type', 'message_type_display', 'message_id', 'category',
            'intent', 'ai_confidence', 'ai_summary', 'requires_human', 'template_key',
            'gateway_status', 'created_at',
        ]
        read_only_fields = fields


class AutomationPrivacyConsentSerializer(serializers.ModelSerializer):
    lead_id = serializers.IntegerField(required=False, allow_null=True)
    created = serializers.BooleanField(read_only=True)

    class Meta:
        model = AutomationPrivacyConsent
        fields = [
            'id', 'lead_id', 'contact_key', 'phone', 'privacy_notice_sent_at',
            'privacy_notice_version', 'consent_source', 'consent_status',
            'metadata', 'created_at', 'updated_at', 'created',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created']
        extra_kwargs = {
            'contact_key': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True, 'allow_null': True},
            'privacy_notice_sent_at': {'required': False},
            'privacy_notice_version': {'required': False, 'allow_blank': True},
            'consent_source': {'required': False},
            'consent_status': {'required': False},
        }

    def validate(self, attrs):
        initial = self.initial_data
        phone = attrs.get('phone') or initial.get('phone') or initial.get('normalized_phone') or ''
        normalized = normalize_phone(phone)
        contact_key = (
            attrs.get('contact_key')
            or initial.get('contact_key')
            or initial.get('reply_to_jid')
            or initial.get('from_jid')
            or initial.get('remote_jid')
            or normalized
        )
        lead = None
        lead_id = attrs.pop('lead_id', None) or initial.get('lead_id')
        if lead_id:
            try:
                lead = CommercialLead.objects.get(pk=lead_id)
            except CommercialLead.DoesNotExist as exc:
                raise serializers.ValidationError({'lead_id': 'Lead no encontrado.'}) from exc
        elif normalized:
            lead = CommercialLead.objects.filter(normalized_phone=normalized, source_channel=initial.get('channel') or 'whatsapp').first()
        elif contact_key:
            lead = CommercialLead.objects.filter(contact_key=contact_key, source_channel=initial.get('channel') or 'whatsapp').first()

        if not contact_key and lead:
            contact_key = lead.contact_key or lead.normalized_phone
        if not contact_key:
            raise serializers.ValidationError({'contact_key': 'Debe enviar contact_key, JID, phone o lead_id.'})

        attrs['lead'] = lead
        attrs['contact_key'] = str(contact_key or '').strip()
        attrs['phone'] = normalized
        attrs['privacy_notice_sent_at'] = attrs.get('privacy_notice_sent_at') or timezone.now()
        attrs['privacy_notice_version'] = attrs.get('privacy_notice_version') or AUTOMATION_PRIVACY_NOTICE_VERSION
        attrs['consent_source'] = attrs.get('consent_source') or initial.get('source') or AutomationPrivacyConsent.ConsentSource.WHATSAPP
        attrs['consent_status'] = attrs.get('consent_status') or AutomationPrivacyConsent.ConsentStatus.INFORMED
        attrs['metadata'] = attrs.get('metadata') or {}
        return attrs

    def create(self, validated_data):
        consent, created = AutomationPrivacyConsent.objects.update_or_create(
            contact_key=validated_data['contact_key'],
            privacy_notice_version=validated_data['privacy_notice_version'],
            consent_source=validated_data['consent_source'],
            defaults=validated_data,
        )
        consent.created = created
        return consent


class CommercialLeadAdminSerializer(serializers.ModelSerializer):
    interest_type_display = serializers.CharField(source='get_interest_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    interactions_count = serializers.IntegerField(read_only=True)
    recent_interactions = serializers.SerializerMethodField()
    privacy_notice_sent_at = serializers.SerializerMethodField()
    privacy_notice_version = serializers.SerializerMethodField()
    privacy_consent_source = serializers.SerializerMethodField()
    privacy_consent_status = serializers.SerializerMethodField()

    class Meta:
        model = CommercialLead
        fields = [
            'id', 'phone', 'normalized_phone', 'contact_key', 'reply_to_jid', 'from_jid',
            'remote_jid', 'push_name', 'is_lid', 'source_channel', 'name', 'company', 'email',
            'interest_type', 'interest_type_display', 'status', 'status_display', 'priority',
            'priority_display', 'summary', 'internal_notes', 'last_category', 'last_intent',
            'last_ai_confidence', 'last_interaction_at', 'assigned_to', 'assigned_to_name',
            'metadata', 'created_at', 'updated_at',
            'interactions_count', 'recent_interactions',
            'privacy_notice_sent_at', 'privacy_notice_version',
            'privacy_consent_source', 'privacy_consent_status',
        ]
        read_only_fields = [
            'id', 'phone', 'normalized_phone', 'contact_key', 'reply_to_jid', 'from_jid',
            'remote_jid', 'push_name', 'is_lid', 'source_channel', 'name', 'company', 'email',
            'interest_type', 'interest_type_display', 'last_category', 'last_intent',
            'last_ai_confidence', 'last_interaction_at', 'assigned_to_name', 'metadata',
            'created_at', 'updated_at', 'interactions_count', 'recent_interactions',
            'privacy_notice_sent_at', 'privacy_notice_version',
            'privacy_consent_source', 'privacy_consent_status',
        ]

    def get_recent_interactions(self, obj):
        interactions = obj.interactions.all().order_by('-created_at')[:10]
        return WhatsAppInteractionAdminSerializer(interactions, many=True).data

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return ''
        full_name = obj.assigned_to.get_full_name()
        return full_name or obj.assigned_to.username or obj.assigned_to.email

    def _latest_privacy_consent(self, obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('privacy_consents')
        if prefetched is not None:
            return sorted(prefetched, key=lambda item: item.privacy_notice_sent_at, reverse=True)[0] if prefetched else None
        return obj.privacy_consents.order_by('-privacy_notice_sent_at').first()

    def get_privacy_notice_sent_at(self, obj):
        consent = self._latest_privacy_consent(obj)
        return consent.privacy_notice_sent_at if consent else None

    def get_privacy_notice_version(self, obj):
        consent = self._latest_privacy_consent(obj)
        return consent.privacy_notice_version if consent else ''

    def get_privacy_consent_source(self, obj):
        consent = self._latest_privacy_consent(obj)
        return consent.consent_source if consent else ''

    def get_privacy_consent_status(self, obj):
        consent = self._latest_privacy_consent(obj)
        return consent.consent_status if consent else ''



class SignatureOrderAutomationSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    validity_display = serializers.CharField(source='get_validity_display', read_only=True)
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    documents_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = SolicitudFirmaElectronica
        fields = [
            'id', 'request_number', 'request_type', 'request_type_display', 'full_name',
            'phone', 'email', 'validity', 'validity_display', 'status', 'status_display',
            'source', 'sale_price', 'regular_price', 'discount_amount', 'documents_count',
            'created_at', 'updated_at',
        ]


class SignatureOrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SolicitudFirmaElectronica.Estado.choices)
    comment = serializers.CharField(required=False, allow_blank=True)

    def update(self, instance, validated_data):
        previous = instance.status
        instance.status = validated_data['status']
        instance.save(update_fields=['status', 'updated_at', 'emitted_at'])
        HistorialEstadoSolicitudFirma.objects.create(
            request=instance,
            previous_status=previous,
            new_status=instance.status,
            comment=validated_data.get('comment', 'Actualizado por automation/n8n.'),
        )
        return instance


class AutomationWebhookEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationWebhookEvent
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'event_id': {'required': False, 'allow_blank': True},
            'idempotency_key': {'required': False, 'allow_blank': True, 'validators': []},
        }

    def validate(self, attrs):
        payload = attrs.get('payload') or self.initial_data or {}
        attrs['payload'] = payload
        attrs['event_type'] = attrs.get('event_type') or payload.get('event_type')
        if not attrs.get('event_type'):
            raise serializers.ValidationError({'event_type': 'Debe enviar event_type.'})
        attrs['event_id'] = attrs.get('event_id') or payload.get('event_id') or build_hash(attrs['event_type'], payload)[:32]
        attrs['idempotency_key'] = attrs.get('idempotency_key') or payload.get('idempotency_key') or attrs['event_id']
        data = payload.get('data') or {}
        attrs['entity_type'] = attrs.get('entity_type') or data.get('entity_type') or ''
        attrs['entity_id'] = attrs.get('entity_id') or str(data.get('order_id') or data.get('lead_id') or data.get('entity_id') or '')
        return attrs

    def create(self, validated_data):
        event, _ = AutomationWebhookEvent.objects.get_or_create(
            idempotency_key=validated_data['idempotency_key'],
            defaults=validated_data,
        )
        return event


class AutomationAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationAuditLog
        fields = '__all__'
        read_only_fields = ['id', 'created_at']
