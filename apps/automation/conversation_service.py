import logging
import uuid

import requests
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied

from .models import AutomationAuditLog, CommercialLead, WhatsAppInteraction


logger = logging.getLogger(__name__)


class GatewayUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'El servicio de WhatsApp no está disponible o no está configurado.'
    default_code = 'gateway_unavailable'


class MessageDispatchConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Este envío ya está en proceso o terminó con resultado incierto. Revisa el historial antes de reintentar.'
    default_code = 'message_dispatch_conflict'


def _audit_transition(lead, *, actor_type, actor_id, previous, target, reason):
    AutomationAuditLog.objects.create(
        actor_type=actor_type,
        actor_id=str(actor_id or ''),
        action=f'automation.conversation.{target.lower()}',
        entity_type='CommercialLead',
        entity_id=str(lead.pk),
        metadata={
            'previous_mode': previous,
            'conversation_mode': target,
            'handoff_reason': reason or '',
        },
    )


def _send_handoff_email(lead_id):
    recipient = getattr(settings, 'AUTOMATION_HANDOFF_NOTIFICATION_EMAIL', '')
    if not recipient:
        logger.warning('Handoff notification recipient is not configured (lead_id=%s).', lead_id)
        return
    lead = CommercialLead.objects.filter(pk=lead_id).first()
    if not lead:
        return
    interactions = list(lead.interactions.order_by('-created_at')[:5])
    latest_inbound = next((item for item in interactions if item.direction == WhatsAppInteraction.Direction.INBOUND), None)
    contact = lead.push_name or lead.name or lead.normalized_phone or lead.contact_key
    lines = [
        f'Contacto: {contact}',
        f'Teléfono/contact_key: {lead.normalized_phone or lead.contact_key}',
        f'Interés: {lead.interest_type}',
        f'Responsable: {lead.assigned_to.get_full_name() if lead.assigned_to else "Sin asignar"}',
        f'Motivo: {lead.handoff_reason or "Atención solicitada"}',
        f'Resumen: {lead.summary or "Sin resumen"}',
        f'Último mensaje recibido: {latest_inbound.message_body if latest_inbound else "Sin mensaje entrante registrado"}',
        f'Fecha/hora: {lead.human_requested_at.isoformat() if lead.human_requested_at else timezone.now().isoformat()}',
        '',
        'Últimas interacciones:',
    ]
    for interaction in reversed(interactions):
        lines.append(
            f'- {interaction.created_at.isoformat()} [{interaction.direction}/{interaction.sender_type}] '
            f'{interaction.message_body[:1000]}'
        )
    try:
        send_mail(
            subject=f'🚨 Cliente requiere atención humana - {lead.interest_type}',
            message='\n'.join(lines),
            from_email=settings.DEFAULT_FROM_EMAIL or None,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Could not send handoff notification (lead_id=%s).', lead_id)


def set_conversation_mode(
    lead,
    target,
    *,
    actor=None,
    actor_type=AutomationAuditLog.ActorType.USER,
    reason=None,
    stage=None,
):
    """Update conversational state. Caller should hold a row lock in a transaction."""
    now = timezone.now()
    previous = lead.conversation_mode
    if target == CommercialLead.ConversationMode.HUMAN_PENDING:
        lead.conversation_stage = stage or 'handoff'
        if reason is not None:
            lead.handoff_reason = reason
        if previous != target:
            lead.human_requested_at = now
    elif target == CommercialLead.ConversationMode.HUMAN_ACTIVE:
        lead.conversation_stage = stage or 'human_active'
        if reason is not None:
            lead.handoff_reason = reason
        if previous != target:
            lead.human_active_at = now
            if actor is not None:
                lead.human_active_by = actor
    else:
        lead.conversation_stage = stage or 'active'
        lead.handoff_reason = ''
        if previous != target:
            lead.human_released_at = now
            if actor is not None:
                lead.human_released_by = actor
    lead.conversation_mode = target
    lead.save(update_fields=[
        'conversation_mode', 'conversation_stage', 'handoff_reason',
        'human_requested_at', 'human_active_at', 'human_released_at',
        'human_active_by', 'human_released_by', 'updated_at',
    ])

    if previous != target:
        _audit_transition(
            lead,
            actor_type=actor_type,
            actor_id=getattr(actor, 'pk', None) or (actor if actor_type != AutomationAuditLog.ActorType.USER else ''),
            previous=previous,
            target=target,
            reason=lead.handoff_reason,
        )
    if target == CommercialLead.ConversationMode.HUMAN_PENDING and previous != target:
        transaction.on_commit(lambda lead_id=lead.pk: _send_handoff_email(lead_id))
    return previous != target


def send_lead_message(lead_id, *, message, sender_type, origin, idempotency_key, actor=None, handoff_ack=False):
    if sender_type not in (WhatsAppInteraction.SenderType.AI, WhatsAppInteraction.SenderType.HUMAN):
        raise ValueError('Only AI or HUMAN messages can be dispatched by this operation.')
    key = str(idempotency_key or uuid.uuid4()).strip()
    key = f'conversation:{lead_id}:{sender_type.lower()}:{key}'
    if len(key) > 220:
        import hashlib
        key = f'conversation:{lead_id}:{sender_type.lower()}:{hashlib.sha256(key.encode()).hexdigest()}'

    dispatch_error = None
    result = None
    with transaction.atomic():
        lead = CommercialLead.objects.select_for_update().get(pk=lead_id)
        is_handoff_ack = (
            sender_type == WhatsAppInteraction.SenderType.AI
            and handoff_ack
            and lead.conversation_mode == CommercialLead.ConversationMode.HUMAN_PENDING
        )
        if handoff_ack and not is_handoff_ack:
            raise PermissionDenied('La confirmación solo se permite mientras el lead está HUMAN_PENDING.')
        if sender_type == WhatsAppInteraction.SenderType.AI and (
            lead.conversation_mode != CommercialLead.ConversationMode.BOT and not is_handoff_ack
        ):
            raise PermissionDenied('El bot está pausado para esta conversación.')

        handoff_requested_at = lead.human_requested_at.isoformat() if is_handoff_ack and lead.human_requested_at else ''
        if is_handoff_ack:
            supplied_key = str(idempotency_key or '').strip()
            expected_prefix = f'handoff-ack:{lead.pk}:'
            supplied_timestamp = parse_datetime(supplied_key[len(expected_prefix):]) if supplied_key.startswith(expected_prefix) else None
            if (
                not handoff_requested_at
                or supplied_timestamp is None
                or supplied_timestamp != lead.human_requested_at
            ):
                raise MessageDispatchConflict(
                    'La confirmación requiere idempotency_key con el formato handoff-ack:{lead_id}:{human_requested_at}.'
                )
            if WhatsAppInteraction.objects.filter(
                lead=lead,
                sender_type=WhatsAppInteraction.SenderType.AI,
                origin='n8n_handoff_ack',
                raw_payload__handoff_requested_at=handoff_requested_at,
            ).exists():
                raise MessageDispatchConflict('La confirmación de este handoff ya fue procesada.')

        existing = WhatsAppInteraction.objects.filter(idempotency_key=key).first()
        if existing:
            if is_handoff_ack:
                raise MessageDispatchConflict('La idempotency_key de esta confirmación ya fue procesada.')
            if existing.gateway_status == 'sent':
                return lead, existing
            raise MessageDispatchConflict()

        if not settings.WHATSAPP_GATEWAY_URL or not settings.WHATSAPP_GATEWAY_TOKEN:
            raise GatewayUnavailable('El envío de WhatsApp desde FacturaOF1 no está configurado.')

        if sender_type == WhatsAppInteraction.SenderType.HUMAN:
            if lead.conversation_mode != CommercialLead.ConversationMode.HUMAN_ACTIVE:
                raise PermissionDenied('Primero debes tomar la conversación para pasarla a HUMAN_ACTIVE.')
            if (
                actor is not None
                and getattr(actor, 'rol', '') not in ('SUPER_ADMIN', 'ADMIN_EMPRESA')
                and lead.assigned_to_id not in (None, actor.pk)
            ):
                raise PermissionDenied('La conversación está asignada a otro asesor.')
            if lead.assigned_to_id is None and actor is not None:
                lead.assigned_to = actor
                lead.save(update_fields=['assigned_to', 'updated_at'])

        target = lead.reply_to_jid or lead.normalized_phone or lead.phone or lead.contact_key
        interaction = WhatsAppInteraction.objects.create(
            lead=lead,
            direction=WhatsAppInteraction.Direction.OUTBOUND,
            sender_type=sender_type,
            origin='n8n_handoff_ack' if is_handoff_ack else origin,
            phone=lead.phone or lead.normalized_phone,
            normalized_phone=lead.normalized_phone,
            channel=lead.source_channel,
            contact_key=lead.contact_key,
            reply_to_jid=lead.reply_to_jid,
            from_jid=lead.from_jid,
            remote_jid=lead.remote_jid,
            push_name=lead.push_name,
            is_lid=lead.is_lid,
            message_body=message,
            message_type=WhatsAppInteraction.MessageType.TEXT,
            idempotency_key=key,
            gateway_status='pending',
            raw_payload={
                'sender_type': sender_type,
                'origin': 'n8n_handoff_ack' if is_handoff_ack else origin,
                'actor_id': getattr(actor, 'pk', None),
                **({'handoff_requested_at': handoff_requested_at} if is_handoff_ack else {}),
            },
        )

        # Keep this contact locked until the gateway has accepted or rejected the
        # send, so a simultaneous HUMAN_ACTIVE transition cannot race an AI send.
        try:
            response = requests.post(
                f'{settings.WHATSAPP_GATEWAY_URL}/internal/sendText',
                json={'to': target, 'message': message, 'origin': 'n8n_handoff_ack' if is_handoff_ack else origin, 'sender_type': sender_type},
                headers={'X-WhatsApp-Gateway-Token': settings.WHATSAPP_GATEWAY_TOKEN},
                timeout=(3, settings.WHATSAPP_GATEWAY_TIMEOUT_SECONDS),
            )
            response.raise_for_status()
            gateway_result = response.json()
            interaction.message_id = str(gateway_result.get('message_id') or '')
            interaction.gateway_status = 'sent'
            interaction.raw_payload = {**interaction.raw_payload, 'gateway_to': gateway_result.get('to', '')}
            interaction.save(update_fields=['message_id', 'gateway_status', 'raw_payload'])
            result = (lead, interaction)
        except (requests.RequestException, ValueError) as exc:
            interaction.gateway_status = 'failed'
            interaction.save(update_fields=['gateway_status'])
            logger.warning('WhatsApp gateway send failed (lead_id=%s, interaction_id=%s): %s', lead.pk, interaction.pk, exc)
            dispatch_error = exc

    if dispatch_error:
        raise GatewayUnavailable('WhatsApp no aceptó el envío. La conversación permanece registrada y pausada para evitar respuestas automáticas.') from dispatch_error
    return result
