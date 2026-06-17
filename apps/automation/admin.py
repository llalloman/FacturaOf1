from django.contrib import admin

from .models import AutomationAuditLog, AutomationWebhookEvent, CommercialLead, WhatsAppInteraction


@admin.register(CommercialLead)
class CommercialLeadAdmin(admin.ModelAdmin):
    list_display = ('normalized_phone', 'interest_type', 'status', 'priority', 'last_interaction_at')
    list_filter = ('interest_type', 'status', 'priority', 'source_channel')
    search_fields = ('normalized_phone', 'phone', 'name', 'company', 'email', 'summary')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(WhatsAppInteraction)
class WhatsAppInteractionAdmin(admin.ModelAdmin):
    list_display = ('normalized_phone', 'direction', 'category', 'intent', 'requires_human', 'created_at')
    list_filter = ('direction', 'message_type', 'category', 'intent', 'requires_human')
    search_fields = ('normalized_phone', 'phone', 'message_body', 'idempotency_key', 'message_id')
    readonly_fields = ('created_at',)


@admin.register(AutomationWebhookEvent)
class AutomationWebhookEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'status', 'entity_type', 'entity_id', 'attempt_count', 'created_at')
    list_filter = ('event_type', 'status')
    search_fields = ('event_id', 'idempotency_key', 'entity_id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AutomationAuditLog)
class AutomationAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor_type', 'entity_type', 'entity_id', 'created_at')
    list_filter = ('actor_type', 'action', 'entity_type')
    search_fields = ('action', 'entity_id', 'actor_id')
    readonly_fields = ('created_at',)
