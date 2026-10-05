from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.firmas.models import SolicitudFirmaElectronica
from apps.firmas.pricing import customer_key
from .commercial_context import build_commercial_context, validate_public_coupon

from .models import AutomationAuditLog, AutomationPrivacyConsent, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction
from .permissions import HasAutomationToken
from apps.core.permissions import is_platform_user
from .conversation_service import resume_expired_conversation, send_lead_message, set_conversation_mode
from .serializers import (
    AutomationAuditLogSerializer,
    AutomationPrivacyConsentSerializer,
    AutomationWebhookEventSerializer,
    CommercialLeadAdminSerializer,
    CommercialLeadSerializer,
    ConversationMessageSerializer,
    ConversationStateSerializer,
    WhatsAppInteractionAdminSerializer,
    SignatureOrderAutomationSerializer,
    SignatureOrderStatusSerializer,
    WhatsAppInteractionSerializer,
    normalize_phone,
)


class AutomationBaseMixin:
    authentication_classes = []
    permission_classes = [HasAutomationToken]


class IsSuperAdminOnly(permissions.BasePermission):
    message = 'Solo SUPER_ADMIN puede administrar los leads de automation.'

    def has_permission(self, request, view):
        user = request.user
        return is_platform_user(user, 'automation')


class IsAutomationConversationUser(permissions.BasePermission):
    message = 'Tu rol no tiene acceso a la bandeja de conversaciones.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and (
                user.is_superuser or getattr(user, 'rol', None) in ('SUPER_ADMIN', 'ADMIN_EMPRESA', 'VENDEDOR')
            )
        )


class LeadUpsertView(AutomationBaseMixin, generics.CreateAPIView):
    serializer_class = CommercialLeadSerializer


class InteractionCreateView(AutomationBaseMixin, generics.CreateAPIView):
    serializer_class = WhatsAppInteractionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interaction = serializer.save()
        status_code = status.HTTP_201_CREATED if getattr(interaction, 'created', False) else status.HTTP_200_OK
        return Response(self.get_serializer(interaction).data, status=status_code)


class LeadContextView(AutomationBaseMixin, APIView):
    def get(self, request, phone):
        identifier = str(phone or '').strip()
        channel = request.query_params.get('channel', 'whatsapp')
        if '@' in identifier:
            lead = get_object_or_404(CommercialLead, contact_key=identifier, source_channel=channel)
        else:
            normalized = ''.join(ch for ch in identifier if ch.isdigit())
            if normalized.startswith('0'):
                normalized = f'593{normalized[1:]}'
            if not normalized.startswith('593') and len(normalized) == 9:
                normalized = f'593{normalized}'
            lead = get_object_or_404(CommercialLead, normalized_phone=normalized, source_channel=channel)
        lead = resume_expired_conversation(lead.pk)
        interactions = WhatsAppInteraction.objects.filter(lead=lead).order_by('-created_at')[:10]
        return Response({
            'lead': CommercialLeadSerializer(lead).data,
            'recent_interactions': WhatsAppInteractionSerializer(interactions, many=True).data,
        })


class CommercialContextView(AutomationBaseMixin, APIView):
    """Read-only source of commercial facts for trusted automation clients."""

    def get(self, request):
        channel = request.query_params.get('channel', 'whatsapp')
        if channel != 'whatsapp':
            return Response({'detail': 'Canal no soportado.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_commercial_context())


class CommercialCouponValidationView(AutomationBaseMixin, APIView):
    """Quote an explicitly AI-published coupon using checkout pricing rules."""

    def post(self, request):
        channel = request.data.get('channel', 'whatsapp')
        if channel != 'whatsapp':
            return Response({'detail': 'Canal no soportado.'}, status=status.HTTP_400_BAD_REQUEST)
        code = request.data.get('code', '')
        plan_code = request.data.get('plan_code', '')
        customer = customer_key(
            request.data.get('identification'), request.data.get('email'), request.data.get('phone'),
        )
        quote = validate_public_coupon(code, plan_code, customer)
        coupon_applied = bool(quote['coupon'])
        return Response({
            'valid': True,
            'code': quote['coupon_entered'].code,
            'plan_code': quote['price'].validity,
            'applied': coupon_applied,
            'message': ('Cupón aplicado correctamente.' if coupon_applied else
                        'Cupón válido; la promoción vigente ofrece un mejor precio.'),
            'regular_price': str(quote['regular_price']),
            'final_price': str(quote['final_price']),
            'discount_amount': str(quote['discount_amount']),
            'currency': 'USD',
            'price_includes_tax': True,
            'subtotal_without_tax': str(quote['subtotal_without_tax']),
            'tax_rate': str(quote['tax_rate']),
            'tax_amount': str(quote['tax_amount']),
            'applied_source': 'coupon' if coupon_applied else ('promotion' if quote['promotion'] else 'regular'),
            'quote_only': True,
        })


class AutomationConversationStateView(AutomationBaseMixin, APIView):
    def patch(self, request, lead_id):
        serializer = ConversationStateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data.get('conversation_mode')
        if not target:
            return Response({'conversation_mode': 'Este campo es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            lead = CommercialLead.objects.select_for_update().get(pk=lead_id)
            set_conversation_mode(
                lead,
                target,
                actor_type=AutomationAuditLog.ActorType.N8N,
                reason=serializer.validated_data.get('handoff_reason'),
                stage=serializer.validated_data.get('conversation_stage'),
            )
        return Response(CommercialLeadSerializer(lead).data)


class AutomationLeadMessageView(AutomationBaseMixin, APIView):
    def post(self, request, lead_id):
        serializer = ConversationMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead, interaction = send_lead_message(
            lead_id,
            message=serializer.validated_data['message'],
            sender_type=WhatsAppInteraction.SenderType.AI,
            origin='n8n',
            idempotency_key=serializer.validated_data.get('idempotency_key'),
            handoff_ack=serializer.validated_data.get('handoff_ack', False),
        )
        return Response(WhatsAppInteractionSerializer(interaction).data, status=status.HTTP_200_OK)


class AutomationGatewayBotAuthorizationView(AutomationBaseMixin, APIView):
    def post(self, request):
        target = str(request.data.get('to') or '').strip()
        if not target:
            return Response({'detail': 'to es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if '@' in target:
            lead = CommercialLead.objects.filter(source_channel='whatsapp').filter(
                Q(contact_key=target) | Q(reply_to_jid=target) | Q(remote_jid=target)
            ).first()
        else:
            lead = CommercialLead.objects.filter(
                source_channel='whatsapp', normalized_phone=normalize_phone(target),
            ).first()
        mode = lead.conversation_mode if lead else CommercialLead.ConversationMode.BOT
        return Response({
            'allowed': mode == CommercialLead.ConversationMode.BOT,
            'conversation_mode': mode,
            'lead_id': lead.pk if lead else None,
        }, status=status.HTTP_200_OK if mode == CommercialLead.ConversationMode.BOT else status.HTTP_409_CONFLICT)


class AutomationGatewayManualOutboundView(AutomationBaseMixin, APIView):
    def post(self, request):
        payload = request.data.copy()
        payload.update({
            'direction': WhatsAppInteraction.Direction.OUTBOUND,
            'sender_type': WhatsAppInteraction.SenderType.HUMAN,
            'origin': 'whatsapp_manual',
            'upsert_lead': True,
        })
        serializer = WhatsAppInteractionSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            interaction = serializer.save()
            if interaction.lead_id:
                lead = CommercialLead.objects.select_for_update().get(pk=interaction.lead_id)
                set_conversation_mode(
                    lead,
                    CommercialLead.ConversationMode.HUMAN_ACTIVE,
                    actor_type=AutomationAuditLog.ActorType.GATEWAY,
                    reason='advisor_replied_from_whatsapp',
                    stage='human_active',
                )
        response_status = status.HTTP_201_CREATED if getattr(interaction, 'created', False) else status.HTTP_200_OK
        return Response(WhatsAppInteractionSerializer(interaction).data, status=response_status)


class SignatureOrderDetailView(AutomationBaseMixin, APIView):
    def get(self, request, identifier):
        queryset = SolicitudFirmaElectronica.objects.annotate(documents_count=Count('documents'))
        lookup = {'request_number': identifier} if not str(identifier).isdigit() else {'id': identifier}
        solicitud = get_object_or_404(queryset, **lookup)
        return Response(SignatureOrderAutomationSerializer(solicitud).data)


class SignatureOrderStatusView(AutomationBaseMixin, APIView):
    def patch(self, request, identifier):
        lookup = {'request_number': identifier} if not str(identifier).isdigit() else {'id': identifier}
        solicitud = get_object_or_404(SolicitudFirmaElectronica, **lookup)
        serializer = SignatureOrderStatusSerializer(instance=solicitud, data=request.data)
        serializer.is_valid(raise_exception=True)
        solicitud = serializer.save()
        return Response(SignatureOrderAutomationSerializer(solicitud).data)


class WebhookEventCreateView(AutomationBaseMixin, generics.CreateAPIView):
    queryset = AutomationWebhookEvent.objects.all()
    serializer_class = AutomationWebhookEventSerializer


class WebhookEventAcknowledgeView(AutomationBaseMixin, APIView):
    """Confirma entrega o fallo sin crear eventos duplicados."""
    @transaction.atomic
    def post(self, request, event_id):
        event = get_object_or_404(
            AutomationWebhookEvent.objects.select_for_update(),
            event_id=event_id,
        )
        result = str(request.data.get('status') or '').upper()
        allowed = (AutomationWebhookEvent.Status.SENT, AutomationWebhookEvent.Status.FAILED, AutomationWebhookEvent.Status.SKIPPED)
        if result not in allowed:
            return Response({'detail': 'status debe ser SENT, FAILED o SKIPPED.'}, status=status.HTTP_400_BAD_REQUEST)
        terminal_duplicate = (
            result in (AutomationWebhookEvent.Status.SENT, AutomationWebhookEvent.Status.SKIPPED)
            and event.status == result
        ) or (
            result == AutomationWebhookEvent.Status.FAILED
            and event.status == AutomationWebhookEvent.Status.FAILED
            and event.dead_lettered_at is not None
        )
        if terminal_duplicate:
            return Response(AutomationWebhookEventSerializer(event).data)
        from django.utils import timezone
        from datetime import timedelta
        event.attempt_count = int(request.data.get('attempt_count') or event.attempt_count or 0) + 1
        event.status = result
        event.dispatch_en_curso = False
        event.dispatch_iniciado_at = None
        event.last_error = str(request.data.get('error') or '') if result == AutomationWebhookEvent.Status.FAILED else ''
        if result == AutomationWebhookEvent.Status.SENT:
            event.sent_at = timezone.now()
            event.next_attempt_at = None
        elif result == AutomationWebhookEvent.Status.FAILED:
            if event.attempt_count >= 5:
                event.dead_lettered_at = timezone.now()
                event.next_attempt_at = None
            else:
                event.status = AutomationWebhookEvent.Status.PENDING
                event.next_attempt_at = timezone.now() + timedelta(seconds=2 ** event.attempt_count)
        event.save(update_fields=['status', 'attempt_count', 'last_error', 'dispatch_en_curso', 'dispatch_iniciado_at', 'sent_at', 'next_attempt_at', 'dead_lettered_at', 'updated_at'])
        return Response(AutomationWebhookEventSerializer(event).data)


class WebhookEventRetryView(AutomationBaseMixin, APIView):
    @transaction.atomic
    def post(self, request, event_id):
        event = get_object_or_404(
            AutomationWebhookEvent.objects.select_for_update(),
            event_id=event_id,
        )
        if event.status != AutomationWebhookEvent.Status.FAILED or not event.dead_lettered_at:
            return Response({'detail': 'Solo se puede reintentar un evento dead-letter.'}, status=status.HTTP_400_BAD_REQUEST)
        event.status = AutomationWebhookEvent.Status.PENDING
        event.attempt_count = 0
        event.last_error = ''
        event.dead_lettered_at = None
        event.dispatch_en_curso = False
        event.dispatch_iniciado_at = None
        event.next_attempt_at = timezone.now()
        event.save(update_fields=['status', 'attempt_count', 'last_error', 'dispatch_en_curso', 'dispatch_iniciado_at', 'dead_lettered_at', 'next_attempt_at', 'updated_at'])
        return Response(AutomationWebhookEventSerializer(event).data)


class AuditLogCreateView(AutomationBaseMixin, generics.CreateAPIView):
    queryset = AutomationAuditLog.objects.all()
    serializer_class = AutomationAuditLogSerializer


class PrivacyConsentCreateView(AutomationBaseMixin, generics.CreateAPIView):
    queryset = AutomationPrivacyConsent.objects.select_related('lead').all()
    serializer_class = AutomationPrivacyConsentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consent = serializer.save()
        status_code = status.HTTP_201_CREATED if getattr(consent, 'created', False) else status.HTTP_200_OK
        AutomationAuditLog.objects.create(
            actor_type=AutomationAuditLog.ActorType.N8N,
            actor_id='privacy-consents',
            action='automation.privacy_notice.recorded',
            entity_type='AutomationPrivacyConsent',
            entity_id=str(consent.id),
            metadata={
                'lead_id': consent.lead_id,
                'contact_key': consent.contact_key,
                'privacy_notice_version': consent.privacy_notice_version,
                'created': getattr(consent, 'created', False),
            },
        )
        return Response(self.get_serializer(consent).data, status=status_code)


class AdminCommercialLeadViewSet(viewsets.ModelViewSet):
    serializer_class = CommercialLeadAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAutomationConversationUser]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'interest_type', 'source_channel', 'is_lid', 'conversation_mode']
    ordering_fields = ['last_interaction_at', 'created_at', 'updated_at', 'priority', 'status', 'conversation_mode']
    ordering = ['-last_interaction_at', '-created_at']

    def get_queryset(self):
        queryset = CommercialLead.objects.annotate(
            interactions_count=Count('interactions')
        ).select_related('assigned_to', 'human_active_by', 'human_released_by').prefetch_related('interactions', 'privacy_consents')
        user = self.request.user
        if not (user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'):
            queryset = queryset.filter(source_channel='whatsapp').filter(
                Q(assigned_to=user) | Q(assigned_to__isnull=True)
            )
        category = self.request.query_params.get('category', '').strip()
        requires_human = self.request.query_params.get('requires_human', '').strip().lower()
        conversation_mode = self.request.query_params.get('conversation_mode', '').strip()
        date_from = parse_date(self.request.query_params.get('date_from', ''))
        date_to = parse_date(self.request.query_params.get('date_to', ''))
        search = self.request.query_params.get('search', '').strip()
        if category:
            queryset = queryset.filter(Q(last_category=category) | Q(interest_type=category))
        if conversation_mode:
            queryset = queryset.filter(conversation_mode=conversation_mode)
        if requires_human in ('true', '1', 'yes', 'si', 'sí'):
            queryset = queryset.filter(
                Q(conversation_mode=CommercialLead.ConversationMode.HUMAN_PENDING)
                | Q(conversation_mode=CommercialLead.ConversationMode.HUMAN_ACTIVE)
                | Q(status=CommercialLead.Status.REQUIRES_HUMAN)
                | Q(interactions__requires_human=True)
            ).distinct()
        elif requires_human in ('false', '0', 'no'):
            queryset = queryset.exclude(
                Q(conversation_mode=CommercialLead.ConversationMode.HUMAN_PENDING)
                | Q(conversation_mode=CommercialLead.ConversationMode.HUMAN_ACTIVE)
                | Q(status=CommercialLead.Status.REQUIRES_HUMAN)
                | Q(interactions__requires_human=True)
            ).distinct()
        if date_from:
            queryset = queryset.filter(Q(last_interaction_at__date__gte=date_from) | Q(created_at__date__gte=date_from))
        if date_to:
            queryset = queryset.filter(Q(last_interaction_at__date__lte=date_to) | Q(created_at__date__lte=date_to))
        if search:
            queryset = queryset.filter(
                Q(phone__icontains=search)
                | Q(normalized_phone__icontains=search)
                | Q(contact_key__icontains=search)
                | Q(reply_to_jid__icontains=search)
                | Q(push_name__icontains=search)
                | Q(name__icontains=search)
                | Q(company__icontains=search)
                | Q(email__icontains=search)
                | Q(summary__icontains=search)
                | Q(last_category__icontains=search)
                | Q(last_intent__icontains=search)
            )
        return queryset

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        if getattr(self.request.user, 'rol', None) == 'VENDEDOR':
            for field in ('assigned_to', 'status', 'priority', 'summary'):
                if field in serializer.fields:
                    serializer.fields[field].read_only = True
        return serializer

    def perform_update(self, serializer):
        if getattr(self.request.user, 'rol', None) == 'VENDEDOR':
            serializer.validated_data.pop('assigned_to', None)
        instance = self.get_object()
        before = {
            'status': instance.status,
            'priority': instance.priority,
            'assigned_to_id': instance.assigned_to_id,
            'internal_notes': instance.internal_notes,
            'summary': instance.summary,
        }
        lead = serializer.save()
        after = {
            'status': lead.status,
            'priority': lead.priority,
            'assigned_to_id': lead.assigned_to_id,
            'internal_notes': lead.internal_notes,
            'summary': lead.summary,
        }
        changes = {
            key: {'before': before[key], 'after': after[key]}
            for key in before
            if before[key] != after[key]
        }
        if changes:
            AutomationAuditLog.objects.create(
                actor_type=AutomationAuditLog.ActorType.USER,
                actor_id=str(self.request.user.id),
                action='automation.lead.updated',
                entity_type='CommercialLead',
                entity_id=str(lead.id),
                metadata={'changes': changes},
            )

    @action(detail=True, methods=['patch'], url_path='conversation')
    def conversation(self, request, pk=None):
        serializer = ConversationStateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data.get('conversation_mode')
        if target not in (CommercialLead.ConversationMode.BOT, CommercialLead.ConversationMode.HUMAN_ACTIVE):
            return Response(
                {'conversation_mode': 'Un asesor puede tomar la conversación o devolverla al bot.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        selected = self.get_object()
        with transaction.atomic():
            lead = CommercialLead.objects.select_for_update().get(pk=selected.pk)
            user = request.user
            is_super = user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'
            if target == CommercialLead.ConversationMode.HUMAN_ACTIVE:
                if lead.assigned_to_id and lead.assigned_to_id != user.pk and not is_super:
                    raise PermissionDenied('La conversación está asignada a otro asesor.')
                if lead.assigned_to_id is None:
                    lead.assigned_to = user
                    lead.save(update_fields=['assigned_to', 'updated_at'])
                set_conversation_mode(
                    lead, target, actor=user, actor_type=AutomationAuditLog.ActorType.USER,
                    stage=serializer.validated_data.get('conversation_stage') or 'human_active',
                )
            else:
                if lead.assigned_to_id not in (None, user.pk) and not is_super:
                    raise PermissionDenied('Solo el asesor asignado puede devolver esta conversación al bot.')
                set_conversation_mode(
                    lead, target, actor=user, actor_type=AutomationAuditLog.ActorType.USER,
                    stage=serializer.validated_data.get('conversation_stage') or 'active',
                )
        return Response(CommercialLeadAdminSerializer(lead).data)

    @action(detail=True, methods=['post'], url_path='messages')
    def messages(self, request, pk=None):
        serializer = ConversationMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = self.get_object()
        _, interaction = send_lead_message(
            lead.pk,
            message=serializer.validated_data['message'],
            sender_type=WhatsAppInteraction.SenderType.HUMAN,
            origin='facturaof1',
            idempotency_key=serializer.validated_data.get('idempotency_key'),
            actor=request.user,
        )
        return Response(WhatsAppInteractionAdminSerializer(interaction).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response({
            'total': queryset.count(),
            'new': queryset.filter(status=CommercialLead.Status.NEW).count(),
            'requires_advisor': queryset.filter(
                Q(conversation_mode=CommercialLead.ConversationMode.HUMAN_PENDING)
                | Q(conversation_mode=CommercialLead.ConversationMode.HUMAN_ACTIVE)
                | Q(status=CommercialLead.Status.REQUIRES_HUMAN)
                | Q(interactions__requires_human=True)
            ).distinct().count(),
            'in_follow_up': queryset.filter(
                status__in=[
                    CommercialLead.Status.IN_FOLLOW_UP,
                    CommercialLead.Status.CONTACTED,
                    CommercialLead.Status.QUALIFIED,
                    CommercialLead.Status.PROPOSAL_SENT,
                ]
            ).count(),
            'converted': queryset.filter(status=CommercialLead.Status.CONVERTED).count(),
            'without_follow_up': queryset.filter(
                Q(last_interaction_at__isnull=True) | Q(status__in=[CommercialLead.Status.NEW, CommercialLead.Status.BOT_RESPONDED])
            ).count(),
        })


class AutomationHealthView(AutomationBaseMixin, APIView):
    def get(self, request):
        return Response({'status': 'ok', 'service': 'automation'})
