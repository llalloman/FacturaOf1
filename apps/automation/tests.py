from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from .models import AutomationPrivacyConsent, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction
from .views import InteractionCreateView, PrivacyConsentCreateView, WebhookEventCreateView


@override_settings(AUTOMATION_API_TOKEN='test-token')
class AutomationPrivacyConsentTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = PrivacyConsentCreateView.as_view()

    def test_privacy_consent_requires_automation_token(self):
        request = self.factory.post('/api/automation/privacy-consents/', {
            'contact_key': '593999999999@s.whatsapp.net',
            'phone': '593999999999',
        }, format='json')

        response = self.view(request)

        self.assertEqual(response.status_code, 403)

    def test_privacy_consent_records_notice_once_per_contact_and_version(self):
        lead = CommercialLead.objects.create(
            phone='593999999999',
            normalized_phone='593999999999',
            contact_key='593999999999@s.whatsapp.net',
            source_channel='whatsapp',
        )
        payload = {
            'lead_id': lead.id,
            'contact_key': lead.contact_key,
            'phone': lead.phone,
            'privacy_notice_version': 'privacidad-test',
            'consent_source': 'whatsapp',
            'consent_status': 'informed',
        }

        first = self.view(self.factory.post(
            '/api/automation/privacy-consents/',
            payload,
            format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))
        second = self.view(self.factory.post(
            '/api/automation/privacy-consents/',
            payload,
            format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(AutomationPrivacyConsent.objects.count(), 1)
        consent = AutomationPrivacyConsent.objects.get()
        self.assertEqual(consent.lead, lead)
        self.assertEqual(consent.phone, '593999999999')
        self.assertEqual(consent.consent_status, 'informed')

    def test_lid_is_not_saved_as_real_phone(self):
        response = self.view(self.factory.post(
            '/api/automation/privacy-consents/',
            {
                'contact_key': '279868742840481@lid',
                'phone': '279868742840481@lid',
                'privacy_notice_version': 'privacidad-test',
                'consent_source': 'whatsapp',
                'consent_status': 'informed',
            },
            format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))

        self.assertEqual(response.status_code, 201)
        consent = AutomationPrivacyConsent.objects.get()
        self.assertEqual(consent.contact_key, '279868742840481@lid')
        self.assertEqual(consent.phone, '')


@override_settings(AUTOMATION_API_TOKEN='test-token')
class AutomationIdempotencyTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.interaction_view = InteractionCreateView.as_view()
        self.webhook_view = WebhookEventCreateView.as_view()

    def test_interaction_accepts_long_idempotency_key_from_n8n(self):
        long_key = 'whatsapp:inbound:593999999999:' + ('a' * 260)
        response = self.interaction_view(self.factory.post(
            '/api/automation/interactions/',
            {
                'direction': 'INBOUND',
                'phone': '593999999999',
                'channel': 'whatsapp',
                'message': 'Hola',
                'message_id': 'msg-test-1',
                'idempotency_key': long_key,
            },
            format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))

        self.assertEqual(response.status_code, 201)
        interaction = WhatsAppInteraction.objects.get()
        self.assertLessEqual(len(interaction.idempotency_key), 220)
        self.assertTrue(interaction.idempotency_key.startswith('whatsapp:whatsapp:INBOUND:'))

    def test_webhook_event_accepts_long_idempotency_key(self):
        long_key = 'webhook:' + ('b' * 260)
        response = self.webhook_view(self.factory.post(
            '/api/automation/webhook-events/',
            {
                'event_type': 'signature.status_changed',
                'event_id': 'event-test-1',
                'idempotency_key': long_key,
                'payload': {'data': {'entity_type': 'signature_order', 'order_id': 10}},
            },
            format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))

        self.assertEqual(response.status_code, 201)
        event = AutomationWebhookEvent.objects.get()
        self.assertLessEqual(len(event.idempotency_key), 220)
        self.assertTrue(event.idempotency_key.startswith('automation:webhook:'))
