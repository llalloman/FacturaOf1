from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminCommercialLeadViewSet,
    AutomationConversationStateView,
    AutomationGatewayBotAuthorizationView,
    AutomationGatewayManualOutboundView,
    AutomationLeadMessageView,
    AuditLogCreateView,
    AutomationHealthView,
    CommercialContextView,
    CommercialCouponValidationView,
    InteractionCreateView,
    LeadContextView,
    LeadUpsertView,
    PrivacyConsentCreateView,
    SignatureOrderDetailView,
    SignatureOrderStatusView,
    WebhookEventCreateView,
    WebhookEventAcknowledgeView,
    WebhookEventRetryView,
)

router = DefaultRouter()
router.register(r'admin/leads', AdminCommercialLeadViewSet, basename='automation-admin-leads')

urlpatterns = [
    path('health/', AutomationHealthView.as_view(), name='automation-health'),
    path('leads/', LeadUpsertView.as_view(), name='automation-leads'),
    path('leads/context/<str:phone>/', LeadContextView.as_view(), name='automation-lead-context'),
    path('commercial-context/', CommercialContextView.as_view(), name='automation-commercial-context'),
    path('commercial-context/validate-coupon/', CommercialCouponValidationView.as_view(), name='automation-commercial-coupon-validation'),
    path('leads/<int:lead_id>/conversation/', AutomationConversationStateView.as_view(), name='automation-lead-conversation'),
    path('leads/<int:lead_id>/messages/', AutomationLeadMessageView.as_view(), name='automation-lead-message'),
    path('gateway/authorize-bot-send/', AutomationGatewayBotAuthorizationView.as_view(), name='automation-gateway-authorize-bot-send'),
    path('gateway/manual-outbound/', AutomationGatewayManualOutboundView.as_view(), name='automation-gateway-manual-outbound'),
    path('interactions/', InteractionCreateView.as_view(), name='automation-interactions'),
    path('privacy-consents/', PrivacyConsentCreateView.as_view(), name='automation-privacy-consents'),
    path('signature-orders/<str:identifier>/', SignatureOrderDetailView.as_view(), name='automation-signature-order-detail'),
    path('signature-orders/<str:identifier>/status/', SignatureOrderStatusView.as_view(), name='automation-signature-order-status'),
    path('webhook-events/', WebhookEventCreateView.as_view(), name='automation-webhook-events'),
    path('webhook-events/<str:event_id>/ack/', WebhookEventAcknowledgeView.as_view(), name='automation-webhook-event-ack'),
    path('webhook-events/<str:event_id>/retry/', WebhookEventRetryView.as_view(), name='automation-webhook-event-retry'),
    path('audit-events/', AuditLogCreateView.as_view(), name='automation-audit-events'),
] + router.urls
