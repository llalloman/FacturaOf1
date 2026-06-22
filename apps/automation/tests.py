from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from .models import AutomationPrivacyConsent, CommercialLead
from .views import PrivacyConsentCreateView


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
