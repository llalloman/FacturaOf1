from django.urls import path

from .views import (
    AuditLogCreateView,
    AutomationHealthView,
    InteractionCreateView,
    LeadContextView,
    LeadUpsertView,
    SignatureOrderDetailView,
    SignatureOrderStatusView,
    WebhookEventCreateView,
)

urlpatterns = [
    path('health/', AutomationHealthView.as_view(), name='automation-health'),
    path('leads/', LeadUpsertView.as_view(), name='automation-leads'),
    path('leads/context/<str:phone>/', LeadContextView.as_view(), name='automation-lead-context'),
    path('interactions/', InteractionCreateView.as_view(), name='automation-interactions'),
    path('signature-orders/<str:identifier>/', SignatureOrderDetailView.as_view(), name='automation-signature-order-detail'),
    path('signature-orders/<str:identifier>/status/', SignatureOrderStatusView.as_view(), name='automation-signature-order-status'),
    path('webhook-events/', WebhookEventCreateView.as_view(), name='automation-webhook-events'),
    path('audit-events/', AuditLogCreateView.as_view(), name='automation-audit-events'),
]
