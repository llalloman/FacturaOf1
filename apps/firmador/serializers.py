from rest_framework import serializers

from .models import FirmadorDocumento, FirmadorWorkspace


class FirmadorWorkspaceSerializer(serializers.ModelSerializer):
    used_storage_bytes = serializers.SerializerMethodField()
    monthly_signatures_used = serializers.SerializerMethodField()

    class Meta:
        model = FirmadorWorkspace
        fields = [
            'id', 'tipo', 'nombre', 'identificacion', 'email', 'activo',
            'max_file_size_bytes', 'max_storage_bytes', 'monthly_signature_limit',
            'default_retention_days', 'max_retention_days',
            'used_storage_bytes', 'monthly_signatures_used',
        ]

    def get_used_storage_bytes(self, obj):
        return obj.active_storage_bytes()

    def get_monthly_signatures_used(self, obj):
        return obj.monthly_signatures_used()


class FirmadorDocumentoSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = FirmadorDocumento
        fields = [
            'id', 'workspace', 'original_file_name', 'signed_file_name',
            'original_size', 'signed_size', 'stored_bytes',
            'original_hash', 'signed_hash', 'keep_file', 'retention_days',
            'expires_at', 'deleted_at', 'status', 'certificado_origen',
            'reason', 'location', 'visible_signature', 'error_message',
            'download_url', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        request = self.context.get('request')
        if not request or not obj.signed_file:
            return None
        return request.build_absolute_uri(f'/api/firmador/documentos/{obj.id}/descargar/')

