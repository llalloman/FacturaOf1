from rest_framework import serializers
from django.conf import settings
from django.core import signing

from .models import FirmadorCertificado, FirmadorDocumento, FirmadorWorkspace


VALIDATION_TOKEN_SALT = 'firmador.documento.validacion'


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
    validation_url = serializers.SerializerMethodField()

    class Meta:
        model = FirmadorDocumento
        fields = [
            'id', 'workspace', 'original_file_name', 'signed_file_name',
            'original_size', 'signed_size', 'stored_bytes',
            'original_hash', 'signed_hash', 'keep_file', 'retention_days',
            'expires_at', 'deleted_at', 'status', 'certificado', 'certificado_origen',
            'signature_type', 'signature_page', 'signature_x', 'signature_y',
            'signature_width', 'signature_height',
            'reason', 'location', 'visible_signature', 'error_message',
            'download_url', 'validation_url', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        request = self.context.get('request')
        if not request or not obj.signed_file:
            return None
        return request.build_absolute_uri(f'/api/firmador/documentos/{obj.id}/descargar/')

    def get_validation_url(self, obj):
        if obj.signature_type != FirmadorDocumento.TipoFirma.QR:
            return None
        public_base = (getattr(settings, 'FIRMADOR_PUBLIC_BASE_URL', '') or 'https://firmador.of1solutions.com').rstrip('/')
        token = signing.dumps({'documento': int(obj.id)}, salt=VALIDATION_TOKEN_SALT)
        return f'{public_base}/firmador/validar?documento={obj.id}&token={token}'


class FirmadorCertificadoSerializer(serializers.ModelSerializer):
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = FirmadorCertificado
        fields = [
            'id', 'alias', 'original_file_name', 'file_size', 'fingerprint',
            'subject', 'issuer', 'expires_at', 'active', 'is_expired',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_is_expired(self, obj):
        from django.utils import timezone
        return obj.expires_at <= timezone.now()


class FirmadorAdminWorkspaceListSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source='owner_user.email', read_only=True)
    owner_name = serializers.CharField(source='owner_user.get_full_name', read_only=True)
    owner_active = serializers.BooleanField(source='owner_user.is_active', read_only=True)
    owner_email_verificado = serializers.BooleanField(source='owner_user.email_verificado', read_only=True)
    used_storage_bytes = serializers.SerializerMethodField()
    documentos_count = serializers.IntegerField(read_only=True)
    certificados_count = serializers.IntegerField(read_only=True)
    monthly_signatures_used = serializers.SerializerMethodField()

    class Meta:
        model = FirmadorWorkspace
        fields = [
            'id', 'tipo', 'nombre', 'identificacion', 'email', 'activo',
            'owner_email', 'owner_name', 'owner_active', 'owner_email_verificado',
            'max_file_size_bytes', 'max_storage_bytes', 'monthly_signature_limit',
            'default_retention_days', 'max_retention_days',
            'used_storage_bytes', 'monthly_signatures_used',
            'documentos_count', 'certificados_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_used_storage_bytes(self, obj):
        return obj.active_storage_bytes()

    def get_monthly_signatures_used(self, obj):
        return obj.monthly_signatures_used()


class FirmadorAdminWorkspaceDetailSerializer(FirmadorAdminWorkspaceListSerializer):
    documentos_recientes = serializers.SerializerMethodField()
    certificados_activos = serializers.SerializerMethodField()

    class Meta(FirmadorAdminWorkspaceListSerializer.Meta):
        fields = FirmadorAdminWorkspaceListSerializer.Meta.fields + [
            'documentos_recientes', 'certificados_activos',
        ]

    def get_documentos_recientes(self, obj):
        documentos = obj.documentos.select_related('certificado').order_by('-created_at')[:10]
        return FirmadorDocumentoSerializer(documentos, many=True, context=self.context).data

    def get_certificados_activos(self, obj):
        certificados = obj.certificados.filter(active=True).order_by('-created_at')
        return FirmadorCertificadoSerializer(certificados, many=True, context=self.context).data


class FirmadorAdminWorkspaceUpdateSerializer(serializers.ModelSerializer):
    owner_active = serializers.BooleanField(required=False)

    class Meta:
        model = FirmadorWorkspace
        fields = [
            'activo', 'max_file_size_bytes', 'max_storage_bytes',
            'monthly_signature_limit', 'default_retention_days',
            'max_retention_days', 'owner_active',
        ]

    def validate(self, attrs):
        default_retention = attrs.get('default_retention_days', getattr(self.instance, 'default_retention_days', 30))
        max_retention = attrs.get('max_retention_days', getattr(self.instance, 'max_retention_days', 180))
        if default_retention > max_retention:
            raise serializers.ValidationError({'default_retention_days': 'La retencion predeterminada no puede superar la maxima.'})
        return attrs

    def update(self, instance, validated_data):
        owner_active = validated_data.pop('owner_active', None)
        instance = super().update(instance, validated_data)
        if owner_active is not None:
            instance.owner_user.is_active = owner_active
            instance.owner_user.save(update_fields=['is_active'])
        return instance
