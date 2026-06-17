import hashlib
import json
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.firmas.models import HistorialEstadoSolicitudFirma, SolicitudFirmaElectronica

from .models import AutomationAuditLog, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction


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
    'otro': CommercialLead.InterestType.UNKNOWN,
    'unknown': CommercialLead.InterestType.UNKNOWN,
}

LEAD_STATUS_ALIASES = {
    'nuevo': CommercialLead.Status.NEW,
    'new': CommercialLead.Status.NEW,
    'responded_bot': CommercialLead.Status.CONTACTED,
    'bot_responded': CommercialLead.Status.CONTACTED,
    'contactado': CommercialLead.Status.CONTACTED,
    'contacted': CommercialLead.Status.CONTACTED,
    'qualified': CommercialLead.Status.QUALIFIED,
    'calificado': CommercialLead.Status.QUALIFIED,
    'requires_human': CommercialLead.Status.REQUIRES_HUMAN,
    'requiere_humano': CommercialLead.Status.REQUIRES_HUMAN,
    'human': CommercialLead.Status.REQUIRES_HUMAN,
    'converted': CommercialLead.Status.CONVERTED,
    'convertido': CommercialLead.Status.CONVERTED,
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
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
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
    phone = serializers.CharField(required=False, allow_blank=True)
    normalized_phone = serializers.CharField(required=False, allow_blank=True)
    interest_type = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.CharField(required=False, allow_blank=True)
    created = serializers.BooleanField(read_only=True)

    class Meta:
        model = CommercialLead
        fields = [
            'id', 'phone', 'normalized_phone', 'source_channel', 'name', 'company', 'email',
            'interest_type', 'status', 'priority', 'summary', 'last_category', 'last_intent',
            'last_ai_confidence', 'last_interaction_at', 'metadata', 'created_at', 'updated_at', 'created',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        phone = attrs.get('normalized_phone') or attrs.get('phone') or self.initial_data.get('from')
        normalized = normalize_phone(phone)
        if not normalized:
            raise serializers.ValidationError({'phone': 'Debe enviar phone o normalized_phone.'})
        attrs['normalized_phone'] = normalized
        attrs['phone'] = attrs.get('phone') or phone
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
        lookup = {
            'normalized_phone': validated_data['normalized_phone'],
            'source_channel': validated_data.get('source_channel', 'whatsapp'),
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
            'message_body', 'message_type', 'message_id', 'idempotency_key', 'category', 'intent',
            'ai_confidence', 'ai_summary', 'requires_human', 'template_key', 'gateway_status',
            'raw_payload', 'created_at', 'created', 'upsert_lead',
        ]
        read_only_fields = ['id', 'lead_id', 'created_at']
        extra_kwargs = {
            'idempotency_key': {'required': False, 'allow_blank': True, 'validators': []},
            'phone': {'required': False, 'allow_blank': True},
            'normalized_phone': {'required': False, 'allow_blank': True},
            'message_body': {'required': False, 'allow_blank': True},
            'message_id': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        initial = self.initial_data
        phone = attrs.get('normalized_phone') or attrs.get('phone') or initial.get('from') or initial.get('to')
        normalized = normalize_phone(phone)
        if not normalized:
            raise serializers.ValidationError({'phone': 'Debe enviar phone/from/to.'})
        attrs['normalized_phone'] = normalized
        attrs['phone'] = attrs.get('phone') or phone
        attrs['channel'] = attrs.get('channel') or initial.get('channel') or 'whatsapp'
        attrs['message_body'] = attrs.get('message_body') or initial.get('body') or initial.get('message') or ''
        attrs['message_type'] = attrs.get('message_type') or initial.get('type') or 'text'
        attrs['message_id'] = attrs.get('message_id') or initial.get('messageId') or initial.get('message_id') or ''
        attrs['raw_payload'] = attrs.get('raw_payload') or dict(initial)
        if attrs.get('ai_confidence') in ('', None):
            attrs['ai_confidence'] = None

        if not attrs.get('idempotency_key'):
            message_key = attrs.get('message_id') or build_hash(
                attrs.get('direction'), attrs.get('normalized_phone'), attrs.get('message_body'), attrs.get('raw_payload')
            )
            attrs['idempotency_key'] = f"whatsapp:{attrs.get('channel')}:{attrs.get('direction')}:{attrs.get('normalized_phone')}:{message_key}"
        return attrs

    def create(self, validated_data):
        upsert_lead = validated_data.pop('upsert_lead', True)
        signature_order_id = validated_data.pop('signature_order_id', None)
        lead = None
        if upsert_lead:
            lead_defaults = {
                'phone': validated_data['phone'],
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
            lead, _ = CommercialLead.objects.update_or_create(
                normalized_phone=validated_data['normalized_phone'],
                source_channel=validated_data.get('channel', 'whatsapp'),
                defaults=lead_defaults,
            )
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
