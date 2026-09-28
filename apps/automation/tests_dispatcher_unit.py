import os
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django

django.setup()

from apps.automation.services import dispatcher


class DispatcherAttemptAccountingTests(TestCase):
    def test_failure_does_not_count_the_same_claim_twice(self):
        event = SimpleNamespace(
            attempt_count=1,
            last_error='',
            status='PENDING',
            dead_lettered_at=None,
            next_attempt_at=None,
            dispatch_en_curso=True,
            dispatch_iniciado_at=object(),
            save=lambda **kwargs: None,
        )
        fake_status = SimpleNamespace(
            FAILED='FAILED',
            PENDING='PENDING',
        )
        fake_model = SimpleNamespace(Status=fake_status)
        with patch.object(dispatcher, 'AutomationWebhookEvent', fake_model):
            dispatcher._mark_failure(event, 'gateway unavailable')

        self.assertEqual(event.attempt_count, 1)
        self.assertEqual(event.status, 'PENDING')
        self.assertEqual(event.last_error, 'gateway unavailable')
        self.assertFalse(event.dispatch_en_curso)

    def test_dispatch_request_preserves_contract_tenant_and_idempotency(self):
        event = SimpleNamespace(
            target_url=' https://staging.example.test/hooks/automation ',
            idempotency_key='idem-123',
            contract_version='2026-09-01',
            event_id='evt-123',
            event_type='signature.order.updated',
            entity_type='SolicitudFirmaElectronica',
            entity_id='44',
            empresa_id=7,
            payload={'status': 'PAID'},
        )

        target, headers, payload = dispatcher.build_dispatch_request(event, 'secret-token')

        self.assertEqual(target, 'https://staging.example.test/hooks/automation')
        self.assertEqual(headers['X-Idempotency-Key'], 'idem-123')
        self.assertEqual(headers['X-Automation-Contract-Version'], '2026-09-01')
        self.assertEqual(headers['Authorization'], 'Bearer secret-token')
        self.assertEqual(payload['empresa_id'], 7)
        self.assertEqual(payload['payload'], {'status': 'PAID'})


class _AutomationMockConsumer(BaseHTTPRequestHandler):
    events = {}
    received = []

    def log_message(self, *args):
        return

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw_body = self.rfile.read(length)
        try:
            body = json.loads(raw_body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_response(400)
            self.end_headers()
            return

        required_headers = (
            'X-Idempotency-Key',
            'X-Automation-Contract-Version',
            'Authorization',
        )
        if any(not self.headers.get(header) for header in required_headers):
            self.send_response(401)
            self.end_headers()
            return

        key = self.headers['X-Idempotency-Key']
        fingerprint = json.dumps(body, sort_keys=True)
        previous = self.events.get(key)
        if previous is not None:
            self.send_response(200 if previous == fingerprint else 409)
            self.end_headers()
            return

        self.events[key] = fingerprint
        self.received.append({
            'headers': dict(self.headers),
            'body': body,
        })
        self.send_response(201)
        self.end_headers()


class AutomationMockConsumerContractTests(TestCase):
    def test_contract_authentication_and_idempotency_against_local_mock(self):
        _AutomationMockConsumer.events = {}
        _AutomationMockConsumer.received = []
        server = ThreadingHTTPServer(('127.0.0.1', 0), _AutomationMockConsumer)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            event = SimpleNamespace(
                target_url=f'http://127.0.0.1:{server.server_port}/events',
                idempotency_key='idem-mock-1',
                contract_version='2026-09-01',
                event_id='evt-mock-1',
                event_type='signature.order.updated',
                entity_type='SolicitudFirmaElectronica',
                entity_id='44',
                empresa_id=7,
                payload={'status': 'PAID'},
            )
            target, headers, payload = dispatcher.build_dispatch_request(event, 'mock-token')

            first = requests.post(target, json=payload, headers=headers, timeout=2)
            second = requests.post(target, json=payload, headers=headers, timeout=2)
            conflict_payload = dict(payload, empresa_id=8)
            conflict = requests.post(target, json=conflict_payload, headers=headers, timeout=2)

            self.assertEqual(first.status_code, 201)
            self.assertEqual(second.status_code, 200)
            self.assertEqual(conflict.status_code, 409)
            self.assertEqual(len(_AutomationMockConsumer.received), 1)
            self.assertEqual(
                _AutomationMockConsumer.received[0]['body']['empresa_id'],
                7,
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
