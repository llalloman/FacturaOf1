import re

from rest_framework import serializers

from .models import (
    DocumentoSolicitudFirma,
    HistorialEstadoSolicitudFirma,
    SolicitudDemoERP,
    SolicitudFirmaElectronica,
)


PHONE_RE = re.compile(r'^(09\d{8}|\+593\d{9})$')


class DocumentoSolicitudFirmaSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoSolicitudFirma
        fields = [
            'id', 'request', 'document_type', 'document_type_display',
            'file_name', 'mime_type', 'status', 'status_display',
            'uploaded_at', 'download_url',
        ]
        read_only_fields = ['request', 'file_name', 'mime_type', 'uploaded_at', 'download_url']

    def get_download_url(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        return request.build_absolute_uri(f'/api/firmas/documentos/{obj.id}/descargar/')


class DocumentoSolicitudFirmaUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoSolicitudFirma
        fields = ['document_type', 'file', 'status']

    def create(self, validated_data):
        file = validated_data.get('file')
        validated_data['file_name'] = getattr(file, 'name', '')
        validated_data['mime_type'] = getattr(file, 'content_type', '') or ''
        return super().create(validated_data)


class HistorialEstadoSolicitudFirmaSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = HistorialEstadoSolicitudFirma
        fields = [
            'id', 'request', 'previous_status', 'new_status',
            'comment', 'changed_by_user', 'changed_by_name', 'created_at',
        ]
        read_only_fields = ['request', 'previous_status', 'new_status', 'changed_by_user', 'created_at']

    def get_changed_by_name(self, obj):
        user = obj.changed_by_user
        if not user:
            return ''
        return getattr(user, 'email', '') or str(user)


class SolicitudFirmaElectronicaSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    validity_display = serializers.CharField(source='get_validity_display', read_only=True)
    interested_plan_display = serializers.CharField(source='get_interested_plan_display', read_only=True)
    documents = DocumentoSolicitudFirmaSerializer(many=True, read_only=True)
    status_history = HistorialEstadoSolicitudFirmaSerializer(many=True, read_only=True)

    class Meta:
        model = SolicitudFirmaElectronica
        fields = [
            'id', 'company', 'customer', 'request_type', 'request_type_display',
            'first_name', 'last_name', 'full_name', 'identification', 'fingerprint_code',
            'ruc', 'business_name', 'email', 'phone', 'province', 'city', 'address',
            'validity', 'validity_display', 'container_type', 'wants_erp',
            'interested_plan', 'interested_plan_display', 'status', 'status_display',
            'source', 'source_display', 'provider', 'provider_display',
            'internal_cost', 'sale_price', 'margin', 'internal_notes',
            'provider_request_id', 'emitted_at', 'rejected_reason',
            'created_at', 'updated_at', 'documents', 'status_history',
        ]
        read_only_fields = ['margin', 'created_at', 'updated_at', 'documents', 'status_history']

    def validate_phone(self, value):
        value = (value or '').strip()
        if not PHONE_RE.match(value):
            raise serializers.ValidationError('Ingresa un celular Ecuador válido: 09xxxxxxxx o +593xxxxxxxxx.')
        return value

    def validate(self, attrs):
        request_type = attrs.get('request_type') or getattr(self.instance, 'request_type', None)
        required = ['first_name', 'last_name', 'identification', 'fingerprint_code', 'email', 'phone', 'province', 'city', 'address']

        if request_type == SolicitudFirmaElectronica.TipoSolicitud.REPRESENTANTE_LEGAL:
            required += ['ruc', 'business_name']
        if request_type == SolicitudFirmaElectronica.TipoSolicitud.MIEMBRO_EMPRESA:
            required += ['ruc', 'business_name']

        errors = {}
        for field in required:
            value = attrs.get(field, getattr(self.instance, field, None))
            if value in (None, ''):
                errors[field] = 'Este campo es requerido.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        instance = super().create(validated_data)
        HistorialEstadoSolicitudFirma.objects.create(
            request=instance,
            previous_status='',
            new_status=instance.status,
            comment='Solicitud creada',
            changed_by_user=self.context.get('request').user if self.context.get('request') and self.context.get('request').user.is_authenticated else None,
        )
        return instance


class SolicitudFirmaElectronicaPublicSerializer(SolicitudFirmaElectronicaSerializer):
    class Meta(SolicitudFirmaElectronicaSerializer.Meta):
        fields = [
            'id', 'request_type', 'first_name', 'last_name', 'identification',
            'fingerprint_code', 'ruc', 'business_name', 'email', 'phone',
            'province', 'city', 'address', 'validity', 'container_type',
            'wants_erp', 'interested_plan', 'source', 'provider', 'internal_notes',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['source'] = SolicitudFirmaElectronica.Origen.LANDING
        validated_data['status'] = SolicitudFirmaElectronica.Estado.NUEVA
        if not validated_data.get('provider'):
            validated_data['provider'] = SolicitudFirmaElectronica.Proveedor.UANATACA
        return super().create(validated_data)


class CambiarEstadoFirmaSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SolicitudFirmaElectronica.Estado.choices)
    comment = serializers.CharField(required=False, allow_blank=True)
    rejected_reason = serializers.CharField(required=False, allow_blank=True)
    provider_request_id = serializers.CharField(required=False, allow_blank=True)


class SolicitudDemoERPSerializer(serializers.ModelSerializer):
    interested_plan_display = serializers.CharField(source='get_interested_plan_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = SolicitudDemoERP
        fields = [
            'id', 'business_name', 'contact_name', 'email', 'phone', 'city',
            'business_type', 'interested_plan', 'interested_plan_display',
            'needs_signature', 'already_has_signature', 'message', 'source',
            'source_display', 'status', 'status_display', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'source', 'status', 'created_at', 'updated_at']

    def validate_phone(self, value):
        value = (value or '').strip()
        if not PHONE_RE.match(value):
            raise serializers.ValidationError('Ingresa un celular Ecuador válido: 09xxxxxxxx o +593xxxxxxxxx.')
        return value

    def create(self, validated_data):
        validated_data['source'] = SolicitudDemoERP.Origen.LANDING
        validated_data['status'] = SolicitudDemoERP.Estado.NUEVA
        return super().create(validated_data)
