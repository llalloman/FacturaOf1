from unittest.mock import Mock, patch

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.firmas.models import FirmaCuponElectronico, FirmaPrecioElectronica, FirmaPromocionElectronica
from .models import AutomationPrivacyConsent, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction
from apps.usuarios.models import Usuario
from .views import (
    AdminCommercialLeadViewSet,
    AutomationConversationStateView,
    AutomationGatewayManualOutboundView,
    AutomationLeadMessageView,
    CommercialContextView,
    CommercialCouponValidationView,
    InteractionCreateView,
    PrivacyConsentCreateView,
    WebhookEventCreateView,
)


@override_settings(AUTOMATION_API_TOKEN='test-token')
class AutomationCommercialContextTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.context_view = CommercialContextView.as_view()
        self.coupon_view = CommercialCouponValidationView.as_view()
        self.today = timezone.localdate()
        self.price = FirmaPrecioElectronica.objects.create(
            validity='1_ANIO', regular_price='115.00', tax_rate='15.00', active=True,
        )

    def test_context_requires_token_and_only_exposes_current_ai_coupons(self):
        FirmaPromocionElectronica.objects.create(
            price=self.price, name='Promo actual', discount_type='FINAL_PRICE',
            discount_value='100.00', promotional_price='100.00',
            start_date=self.today, end_date=self.today, active=True,
        )
        FirmaCuponElectronico.objects.create(
            code='AI10', name='Cupón IA', discount_type='PERCENTAGE', discount_value='10.00',
            start_date=self.today, end_date=self.today, public_to_ai=True,
        )
        FirmaCuponElectronico.objects.create(
            code='PRIVADO', name='Privado', discount_type='PERCENTAGE', discount_value='20.00',
            start_date=self.today, end_date=self.today, public_to_ai=False,
        )
        denied = self.context_view(self.factory.get('/api/automation/commercial-context/?channel=whatsapp'))
        response = self.context_view(self.factory.get(
            '/api/automation/commercial-context/?channel=whatsapp', HTTP_X_AUTOMATION_TOKEN='test-token',
        ))
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source_of_truth'], 'FacturaOF1')
        self.assertEqual(response.data['signature_catalog'][0]['current_price'], '100.00')
        self.assertEqual([coupon['code'] for coupon in response.data['public_coupons']], ['AI10'])

    def test_coupon_validation_uses_checkout_price_logic(self):
        FirmaCuponElectronico.objects.create(
            code='AI10', name='Cupón IA', discount_type='PERCENTAGE', discount_value='10.00',
            start_date=self.today, end_date=self.today, public_to_ai=True,
        )
        response = self.coupon_view(self.factory.post(
            '/api/automation/commercial-context/validate-coupon/',
            {'code': 'ai10', 'plan_code': '1_ANIO'}, format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['final_price'], '103.50')
        self.assertTrue(response.data['applied'])
        self.assertTrue(response.data['quote_only'])

    def test_coupon_validation_rejects_coupon_not_published_to_ai(self):
        FirmaCuponElectronico.objects.create(
            code='PRIVATE', name='Cupón privado', discount_type='PERCENTAGE', discount_value='10.00',
            start_date=self.today, end_date=self.today, public_to_ai=False,
        )
        response = self.coupon_view(self.factory.post(
            '/api/automation/commercial-context/validate-coupon/',
            {'code': 'PRIVATE', 'plan_code': '1_ANIO'}, format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ))
        self.assertEqual(response.status_code, 400)


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


@override_settings(
    AUTOMATION_API_TOKEN='test-token',
    WHATSAPP_GATEWAY_URL='http://gateway:8081',
    WHATSAPP_GATEWAY_TOKEN='gateway-test-token',
    AUTOMATION_HANDOFF_NOTIFICATION_EMAIL='sales@example.com',
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class AutomationConversationHandoffTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.lead = CommercialLead.objects.create(
            phone='593999999999',
            normalized_phone='593999999999',
            contact_key='593999999999@s.whatsapp.net',
            reply_to_jid='593999999999@s.whatsapp.net',
            source_channel='whatsapp',
        )
        self.advisor = Usuario.objects.create_user(
            email='advisor@example.com', password='test', rol='VENDEDOR',
        )

    @patch('apps.automation.conversation_service.requests.post')
    def test_bot_mode_allows_ai_reply_and_records_n8n_origin(self, gateway_post):
        gateway_response = Mock()
        gateway_response.json.return_value = {'message_id': 'bot-msg-1', 'to': self.lead.reply_to_jid}
        gateway_response.raise_for_status.return_value = None
        gateway_post.return_value = gateway_response
        view = AutomationLeadMessageView.as_view()

        response = view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {'message': 'Hola, ¿en qué puedo ayudarte?', 'idempotency_key': 'n8n:reply:inbound-1'},
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)

        self.assertEqual(response.status_code, 200)
        interaction = WhatsAppInteraction.objects.get()
        self.assertEqual(interaction.sender_type, WhatsAppInteraction.SenderType.AI)
        self.assertEqual(interaction.origin, 'n8n')
        self.assertEqual(interaction.gateway_status, 'sent')

    def test_pending_mode_blocks_normal_ai_reply(self):
        self.lead.conversation_mode = CommercialLead.ConversationMode.HUMAN_PENDING
        self.lead.human_requested_at = timezone.now()
        self.lead.save(update_fields=['conversation_mode', 'human_requested_at'])
        view = AutomationLeadMessageView.as_view()

        response = view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {'message': 'Respuesta automática', 'idempotency_key': 'n8n:reply:inbound-pending'},
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(WhatsAppInteraction.objects.count(), 0)

    def test_n8n_handoff_sets_pending_and_notifies_once(self):
        view = AutomationConversationStateView.as_view()
        payload = {
            'conversation_mode': 'HUMAN_PENDING',
            'conversation_stage': 'handoff',
            'handoff_reason': 'customer_requested_human',
        }
        with self.captureOnCommitCallbacks(execute=True):
            first = view(self.factory.patch(
                f'/api/automation/leads/{self.lead.pk}/conversation/', payload, format='json',
                HTTP_X_AUTOMATION_TOKEN='test-token',
            ), lead_id=self.lead.pk)
            second = view(self.factory.patch(
                f'/api/automation/leads/{self.lead.pk}/conversation/', payload, format='json',
                HTTP_X_AUTOMATION_TOKEN='test-token',
            ), lead_id=self.lead.pk)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.conversation_mode, CommercialLead.ConversationMode.HUMAN_PENDING)
        self.assertEqual(self.lead.handoff_reason, 'customer_requested_human')
        self.assertEqual(len(mail.outbox), 1)

    def test_bot_message_is_blocked_when_human_has_control(self):
        self.lead.conversation_mode = CommercialLead.ConversationMode.HUMAN_ACTIVE
        self.lead.save(update_fields=['conversation_mode'])
        view = AutomationLeadMessageView.as_view()
        response = view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {'message': 'Respuesta automática', 'idempotency_key': 'reply-1'},
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(WhatsAppInteraction.objects.count(), 0)

    @patch('apps.automation.conversation_service.requests.post')
    def test_single_handoff_ack_is_allowed_while_pending(self, gateway_post):
        gateway_response = Mock()
        gateway_response.json.return_value = {'message_id': 'handoff-ack-1', 'to': self.lead.reply_to_jid}
        gateway_response.raise_for_status.return_value = None
        gateway_post.return_value = gateway_response
        self.lead.conversation_mode = CommercialLead.ConversationMode.HUMAN_PENDING
        self.lead.human_requested_at = timezone.now()
        self.lead.save(update_fields=['conversation_mode', 'human_requested_at'])
        handoff_key = f'handoff-ack:{self.lead.pk}:{self.lead.human_requested_at.isoformat()}'

        view = AutomationLeadMessageView.as_view()
        response = view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {'message': 'Un asesor continuará contigo.', 'idempotency_key': handoff_key, 'handoff_ack': True},
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)

        self.assertEqual(response.status_code, 200)
        gateway_post.assert_called_once()
        self.assertEqual(gateway_post.call_args.kwargs['json']['origin'], 'n8n_handoff_ack')
        interaction = WhatsAppInteraction.objects.get()
        self.assertEqual(interaction.origin, 'n8n_handoff_ack')

        duplicate = view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {'message': 'Un asesor continuará contigo.', 'idempotency_key': handoff_key, 'handoff_ack': True},
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)
        self.assertEqual(duplicate.status_code, 409)

        second_ack = view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {
                'message': 'Un asesor continuará contigo.',
                'idempotency_key': f'handoff-ack:{self.lead.pk}:{self.lead.human_requested_at.isoformat()}-second',
                'handoff_ack': True,
            },
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)
        self.assertEqual(second_ack.status_code, 409)

    @patch('apps.automation.conversation_service.requests.post')
    def test_advisor_cannot_send_before_taking_conversation(self, gateway_post):
        view = AdminCommercialLeadViewSet.as_view({'post': 'messages'})
        request = self.factory.post(
            f'/api/automation/admin/leads/{self.lead.pk}/messages/',
            {'message': 'Ya te ayudo', 'idempotency_key': 'advisor-reply-before-take'}, format='json',
        )
        force_authenticate(request, user=self.advisor)
        response = view(request, pk=self.lead.pk)

        self.assertEqual(response.status_code, 403)
        gateway_post.assert_not_called()
        self.assertEqual(WhatsAppInteraction.objects.count(), 0)

    @patch('apps.automation.conversation_service.requests.post')
    def test_advisor_can_take_conversation_and_send_whatsapp(self, gateway_post):
        gateway_response = Mock()
        gateway_response.json.return_value = {'message_id': 'gateway-msg-1', 'to': self.lead.reply_to_jid}
        gateway_response.raise_for_status.return_value = None
        gateway_post.return_value = gateway_response

        conversation_view = AdminCommercialLeadViewSet.as_view({'patch': 'conversation'})
        request = self.factory.patch(
            f'/api/automation/admin/leads/{self.lead.pk}/conversation/',
            {'conversation_mode': 'HUMAN_ACTIVE'}, format='json',
        )
        force_authenticate(request, user=self.advisor)
        taken = conversation_view(request, pk=self.lead.pk)
        self.assertEqual(taken.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.assigned_to, self.advisor)
        self.assertEqual(self.lead.conversation_mode, CommercialLead.ConversationMode.HUMAN_ACTIVE)

        message_view = AdminCommercialLeadViewSet.as_view({'post': 'messages'})
        request = self.factory.post(
            f'/api/automation/admin/leads/{self.lead.pk}/messages/',
            {'message': 'Ya te ayudo', 'idempotency_key': 'advisor-reply-1'}, format='json',
        )
        force_authenticate(request, user=self.advisor)
        sent = message_view(request, pk=self.lead.pk)

        self.assertEqual(sent.status_code, 200)
        gateway_post.assert_called_once()
        interaction = WhatsAppInteraction.objects.get()
        self.assertEqual(interaction.sender_type, WhatsAppInteraction.SenderType.HUMAN)
        self.assertEqual(interaction.origin, 'facturaof1')
        self.assertEqual(interaction.gateway_status, 'sent')
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.conversation_mode, CommercialLead.ConversationMode.HUMAN_ACTIVE)

        request = self.factory.patch(
            f'/api/automation/admin/leads/{self.lead.pk}/conversation/',
            {'conversation_mode': 'BOT'}, format='json',
        )
        force_authenticate(request, user=self.advisor)
        resumed = conversation_view(request, pk=self.lead.pk)
        self.assertEqual(resumed.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.conversation_mode, CommercialLead.ConversationMode.BOT)

        ai_view = AutomationLeadMessageView.as_view()
        ai_response = ai_view(self.factory.post(
            f'/api/automation/leads/{self.lead.pk}/messages/',
            {'message': 'Gracias por esperar.', 'idempotency_key': 'n8n:reply:after-resume'},
            format='json', HTTP_X_AUTOMATION_TOKEN='test-token',
        ), lead_id=self.lead.pk)
        self.assertEqual(ai_response.status_code, 200)
        self.assertEqual(gateway_post.call_count, 2)

    def test_gateway_manual_message_takes_over_and_is_idempotent(self):
        view = AutomationGatewayManualOutboundView.as_view()
        payload = {
            'contact_key': self.lead.contact_key,
            'reply_to_jid': self.lead.reply_to_jid,
            'phone': self.lead.phone,
            'message_id': 'manual-out-1',
            'body': 'Hola, soy un asesor.',
        }
        first = view(self.factory.post(
            '/api/automation/gateway/manual-outbound/', payload, format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))
        second = view(self.factory.post(
            '/api/automation/gateway/manual-outbound/', payload, format='json',
            HTTP_X_AUTOMATION_TOKEN='test-token',
        ))

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.conversation_mode, CommercialLead.ConversationMode.HUMAN_ACTIVE)
        self.assertEqual(WhatsAppInteraction.objects.count(), 1)
