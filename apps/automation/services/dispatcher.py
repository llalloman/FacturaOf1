"""Despachador opt-in de eventos Automation."""

import os
from datetime import timedelta

import requests
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.automation.models import AutomationWebhookEvent


def _mark_failure(event, message):
    # `dispatch_pending_events` increments the counter atomically when it
    # claims the HTTP attempt. Do not increment again here: doing so would
    # dead-letter an event after fewer than five actual requests.
    event.last_error = str(message)[:4000]
    if event.attempt_count >= 5:
        event.status = AutomationWebhookEvent.Status.FAILED
        event.dead_lettered_at = timezone.now()
        event.next_attempt_at = None
    else:
        event.status = AutomationWebhookEvent.Status.PENDING
        event.next_attempt_at = timezone.now() + timedelta(seconds=2 ** event.attempt_count)
    event.dispatch_en_curso = False
    event.dispatch_iniciado_at = None
    event.save(update_fields=['attempt_count', 'last_error', 'status', 'dispatch_en_curso', 'dispatch_iniciado_at', 'dead_lettered_at', 'next_attempt_at', 'updated_at'])


def build_dispatch_request(event, token=''):
    """Construye el request externo sin efectos de red ni acceso a la BD."""
    headers = {
        'X-Idempotency-Key': event.idempotency_key,
        'X-Automation-Contract-Version': event.contract_version,
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    payload = {
        'event_id': event.event_id,
        'contract_version': event.contract_version,
        'event_type': event.event_type,
        'entity_type': event.entity_type,
        'entity_id': event.entity_id,
        'idempotency_key': event.idempotency_key,
        'empresa_id': event.empresa_id,
        'payload': event.payload,
    }
    return (event.target_url or '').strip(), headers, payload


def dispatch_pending_events(*, limit=50, send=False, timeout=10):
    """Inspecciona o despacha eventos pendientes; el envío nunca es implícito."""
    now = timezone.now()
    events = list(AutomationWebhookEvent.objects.filter(
        status=AutomationWebhookEvent.Status.PENDING,
        dead_lettered_at__isnull=True,
    ).filter(Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now))
      .order_by('created_at')[:limit])
    summary = {'selected': len(events), 'sent': 0, 'failed': 0, 'skipped': 0, 'dry_run': not send}
    default_url = os.environ.get('AUTOMATION_DISPATCH_URL', '').strip()
    token = os.environ.get('AUTOMATION_DISPATCH_TOKEN', '').strip()

    for candidate in events:
        if not send:
            continue
        with transaction.atomic():
            event = AutomationWebhookEvent.objects.select_for_update().get(pk=candidate.pk)
            claim_before = timezone.now() - timedelta(minutes=5)
            if event.status != AutomationWebhookEvent.Status.PENDING or event.dead_lettered_at:
                continue
            if event.dispatch_en_curso and event.dispatch_iniciado_at and event.dispatch_iniciado_at >= claim_before:
                continue
            event.dispatch_en_curso = True
            event.dispatch_iniciado_at = timezone.now()
            target = (event.target_url or default_url).strip()
            if not target:
                event.status = AutomationWebhookEvent.Status.SKIPPED
                event.dispatch_en_curso = False
                event.dispatch_iniciado_at = None
                event.last_error = 'No se configuró URL de despacho para el evento.'
                event.save(update_fields=['status', 'dispatch_en_curso', 'dispatch_iniciado_at', 'last_error', 'updated_at'])
                summary['skipped'] += 1
                continue
            event.attempt_count += 1
            event.save(update_fields=['attempt_count', 'dispatch_en_curso', 'dispatch_iniciado_at', 'updated_at'])

        try:
            _, headers, payload = build_dispatch_request(event, token)
            response = requests.post(target, json=payload, headers=headers, timeout=timeout)
            response.raise_for_status()
        except Exception as exc:
            with transaction.atomic():
                current = AutomationWebhookEvent.objects.select_for_update().get(pk=event.pk)
                _mark_failure(current, exc)
            summary['failed'] += 1
            continue

        with transaction.atomic():
            current = AutomationWebhookEvent.objects.select_for_update().get(pk=event.pk)
            current.status = AutomationWebhookEvent.Status.SENT
            current.dispatch_en_curso = False
            current.dispatch_iniciado_at = None
            current.sent_at = timezone.now()
            current.next_attempt_at = None
            current.last_error = ''
            current.save(update_fields=['status', 'dispatch_en_curso', 'dispatch_iniciado_at', 'sent_at', 'next_attempt_at', 'last_error', 'updated_at'])
        summary['sent'] += 1
    return summary
