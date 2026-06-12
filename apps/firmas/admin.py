from django.contrib import admin

from .models import DocumentoSolicitudFirma, HistorialEstadoSolicitudFirma, SolicitudDemoERP, SolicitudFirmaElectronica


class DocumentoSolicitudFirmaInline(admin.TabularInline):
    model = DocumentoSolicitudFirma
    extra = 0
    readonly_fields = ['file_name', 'mime_type', 'uploaded_at']


class HistorialEstadoSolicitudFirmaInline(admin.TabularInline):
    model = HistorialEstadoSolicitudFirma
    extra = 0
    readonly_fields = ['previous_status', 'new_status', 'comment', 'changed_by_user', 'created_at']
    can_delete = False


@admin.register(SolicitudFirmaElectronica)
class SolicitudFirmaElectronicaAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'identification', 'request_type', 'status', 'interested_plan', 'source', 'created_at']
    list_filter = ['status', 'request_type', 'source', 'provider', 'interested_plan']
    search_fields = ['first_name', 'last_name', 'identification', 'ruc', 'business_name', 'email', 'phone']
    readonly_fields = ['margin', 'created_at', 'updated_at', 'emitted_at']
    inlines = [DocumentoSolicitudFirmaInline, HistorialEstadoSolicitudFirmaInline]


@admin.register(DocumentoSolicitudFirma)
class DocumentoSolicitudFirmaAdmin(admin.ModelAdmin):
    list_display = ['id', 'request', 'document_type', 'status', 'uploaded_at']
    list_filter = ['document_type', 'status']
    search_fields = ['file_name', 'request__identification', 'request__email']


@admin.register(HistorialEstadoSolicitudFirma)
class HistorialEstadoSolicitudFirmaAdmin(admin.ModelAdmin):
    list_display = ['id', 'request', 'previous_status', 'new_status', 'changed_by_user', 'created_at']
    list_filter = ['new_status']
    search_fields = ['request__identification', 'request__email', 'comment']


@admin.register(SolicitudDemoERP)
class SolicitudDemoERPAdmin(admin.ModelAdmin):
    list_display = ['id', 'business_name', 'contact_name', 'phone', 'interested_plan', 'needs_signature', 'status', 'created_at']
    list_filter = ['status', 'interested_plan', 'needs_signature', 'source', 'created_at']
    search_fields = ['business_name', 'contact_name', 'email', 'phone', 'city']
