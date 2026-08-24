from django.contrib import admin

from .models import (
    FirmadorCertificado,
    FirmadorConsentimientoLegal,
    FirmadorDocumento,
    FirmadorWorkspace,
)


@admin.register(FirmadorWorkspace)
class FirmadorWorkspaceAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'email', 'tipo', 'activo', 'is_primary', 'owner_user', 'created_at')
    list_filter = ('tipo', 'activo', 'is_primary', 'created_at')
    search_fields = ('nombre', 'email', 'identificacion', 'owner_user__email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(FirmadorDocumento)
class FirmadorDocumentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'original_file_name', 'status', 'signature_type', 'keep_file', 'created_at')
    list_filter = ('status', 'signature_type', 'keep_file', 'certificado_origen', 'created_at')
    search_fields = ('original_file_name', 'signed_file_name', 'workspace__nombre', 'workspace__email')
    readonly_fields = ('created_at', 'updated_at', 'deleted_at')


@admin.register(FirmadorCertificado)
class FirmadorCertificadoAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'alias', 'active', 'expires_at', 'created_at')
    list_filter = ('active', 'expires_at', 'created_at')
    search_fields = ('alias', 'original_file_name', 'fingerprint', 'workspace__email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(FirmadorConsentimientoLegal)
class FirmadorConsentimientoLegalAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'workspace', 'accepted_terms', 'accepted_privacy', 'terms_version', 'privacy_version', 'source', 'accepted_at')
    list_filter = ('accepted_terms', 'accepted_privacy', 'terms_version', 'privacy_version', 'source', 'accepted_at')
    search_fields = ('user__email', 'workspace__email', 'workspace__nombre', 'ip_address')
    readonly_fields = (
        'user', 'workspace', 'accepted_terms', 'accepted_privacy', 'accepted_at',
        'ip_address', 'user_agent', 'terms_version', 'privacy_version', 'source',
        'created_at',
    )
