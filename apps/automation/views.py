from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.firmas.models import SolicitudFirmaElectronica

from .models import AutomationAuditLog, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction
from .permissions import HasAutomationToken
from .serializers import (
    AutomationAuditLogSerializer,
    AutomationWebhookEventSerializer,
    CommercialLeadSerializer,
    SignatureOrderAutomationSerializer,
    SignatureOrderStatusSerializer,
    WhatsAppInteractionSerializer,
)


class AutomationBaseMixin:
    authentication_classes = []
    permission_classes = [HasAutomationToken]


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
        normalized = ''.join(ch for ch in str(phone or '') if ch.isdigit())
        if normalized.startswith('0'):
            normalized = f'593{normalized[1:]}'
        if not normalized.startswith('593') and len(normalized) == 9:
            normalized = f'593{normalized}'
        lead = get_object_or_404(CommercialLead, normalized_phone=normalized, source_channel=request.query_params.get('channel', 'whatsapp'))
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


class AutomationHealthView(AutomationBaseMixin, APIView):
    def get(self, request):
        return Response({'status': 'ok', 'service': 'automation'})
