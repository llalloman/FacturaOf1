from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.firmas.models import SolicitudFirmaElectronica

from .models import AutomationAuditLog, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction
from .permissions import HasAutomationToken
from .serializers import (
    AutomationAuditLogSerializer,
    AutomationWebhookEventSerializer,
    CommercialLeadAdminSerializer,
    CommercialLeadSerializer,
    SignatureOrderAutomationSerializer,
    SignatureOrderStatusSerializer,
    WhatsAppInteractionSerializer,
)


class AutomationBaseMixin:
    authentication_classes = []
    permission_classes = [HasAutomationToken]


class IsSuperAdminOnly(permissions.BasePermission):
    message = 'Solo SUPER_ADMIN puede administrar los leads de automation.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'))


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
        interactions = WhatsAppInteraction.objects.filter(lead=lead).order_by('-created_at')[:10]
        return Response({
            'lead': CommercialLeadSerializer(lead).data,
            'recent_interactions': WhatsAppInteractionSerializer(interactions, many=True).data,
        })


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


class AuditLogCreateView(AutomationBaseMixin, generics.CreateAPIView):
    queryset = AutomationAuditLog.objects.all()
    serializer_class = AutomationAuditLogSerializer


class AdminCommercialLeadViewSet(viewsets.ModelViewSet):
    serializer_class = CommercialLeadAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOnly]
    http_method_names = ['get', 'patch', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'interest_type', 'source_channel', 'is_lid']
    ordering_fields = ['last_interaction_at', 'created_at', 'updated_at', 'priority', 'status']
    ordering = ['-last_interaction_at', '-created_at']

    def get_queryset(self):
        queryset = CommercialLead.objects.annotate(
            interactions_count=Count('interactions')
        ).prefetch_related('interactions')
        category = self.request.query_params.get('category', '').strip()
        requires_human = self.request.query_params.get('requires_human', '').strip().lower()
        date_from = parse_date(self.request.query_params.get('date_from', ''))
        date_to = parse_date(self.request.query_params.get('date_to', ''))
        search = self.request.query_params.get('search', '').strip()
        if category:
            queryset = queryset.filter(Q(last_category=category) | Q(interest_type=category))
        if requires_human in ('true', '1', 'yes', 'si', 'sí'):
            queryset = queryset.filter(Q(status=CommercialLead.Status.REQUIRES_HUMAN) | Q(interactions__requires_human=True)).distinct()
        elif requires_human in ('false', '0', 'no'):
            queryset = queryset.exclude(Q(status=CommercialLead.Status.REQUIRES_HUMAN) | Q(interactions__requires_human=True)).distinct()
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

    def perform_update(self, serializer):
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

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response({
            'total': queryset.count(),
            'new': queryset.filter(status=CommercialLead.Status.NEW).count(),
            'requires_advisor': queryset.filter(
                Q(status=CommercialLead.Status.REQUIRES_HUMAN) | Q(interactions__requires_human=True)
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
