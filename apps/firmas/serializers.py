import re

from rest_framework import serializers

from .models import (
    DocumentoSolicitudFirma,
    HistorialEstadoSolicitudFirma,
    SolicitudDemoERP,
    SolicitudFirmaElectronica,
)


PHONE_RE = re.compile(r'^(09\d{8}|\+593\d{9})$')
MAX_DOCUMENT_SIZE = 15 * 1024 * 1024
ALLOWED_DOCUMENT_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
}


PUBLIC_DOCUMENT_FIELDS = {
    'cedula_anverso': DocumentoSolicitudFirma.TipoDocumento.CEDULA_ANVERSO,
    'cedula_reverso': DocumentoSolicitudFirma.TipoDocumento.CEDULA_REVERSO,
    'selfie_cedula': DocumentoSolicitudFirma.TipoDocumento.SELFIE_CEDULA,
    'ruc_pdf': DocumentoSolicitudFirma.TipoDocumento.RUC_PDF,
    'constitucion_compania': DocumentoSolicitudFirma.TipoDocumento.CONSTITUCION_COMPANIA,
    'nombramiento_representante': DocumentoSolicitudFirma.TipoDocumento.NOMBRAMIENTO_REPRESENTANTE,
    'aceptacion_nombramiento': DocumentoSolicitudFirma.TipoDocumento.ACEPTACION_NOMBRAMIENTO,
    'carta_autorizacion': DocumentoSolicitudFirma.TipoDocumento.CARTA_AUTORIZACION,
    'cedula_representante': DocumentoSolicitudFirma.TipoDocumento.CEDULA_REPRESENTANTE,
    'documento_adicional': DocumentoSolicitudFirma.TipoDocumento.DOCUMENTO_ADICIONAL,
}


def validate_document_file(file):
    if file.size > MAX_DOCUMENT_SIZE:
        raise serializers.ValidationError('El archivo no puede superar 15 MB.')
    content_type = (getattr(file, 'content_type', '') or '').lower()
    if content_type and content_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise serializers.ValidationError('Formato no permitido. Usa PDF, JPG o PNG.')


class DocumentoSolicitudFirmaSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    download_url = serializers.SerializerMethodField()
    file_available = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoSolicitudFirma
        fields = [
            'id', 'request', 'document_type', 'document_type_display',
            'file_name', 'mime_type', 'status', 'status_display',
            'uploaded_at', 'download_url', 'file_available',
        ]
        read_only_fields = ['request', 'file_name', 'mime_type', 'uploaded_at', 'download_url', 'file_available']

    def get_download_url(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        return request.build_absolute_uri(f'/api/firmas/documentos/{obj.id}/descargar/')

    def get_file_available(self, obj):
        if not obj.file:
            return False
        try:
            return obj.file.storage.exists(obj.file.name)
        except Exception:
            return False


class DocumentoSolicitudFirmaUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoSolicitudFirma
        fields = ['document_type', 'file', 'status']

    def validate_file(self, value):
        validate_document_file(value)
        return value

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
    identification_type_display = serializers.CharField(source='get_identification_type_display', read_only=True)
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
            'id', 'request_number', 'company', 'customer', 'request_type', 'request_type_display',
            'identification_type', 'identification_type_display', 'first_name', 'last_name',
            'second_last_name', 'full_name', 'identification', 'fingerprint_code',
            'birth_date', 'nationality', 'gender', 'ruc', 'has_ruc', 'business_name',
            'company_unit', 'applicant_position', 'request_reason', 'email',
            'secondary_email', 'phone', 'secondary_phone', 'province', 'city', 'address',
            'representative_identification_type', 'representative_identification',
            'representative_names', 'representative_last_names',
            'validity', 'validity_display', 'container_type', 'wants_erp',
            'interested_plan', 'interested_plan_display', 'status', 'status_display',
            'source', 'source_display', 'provider', 'provider_display',
            'internal_cost', 'sale_price', 'margin', 'internal_notes',
            'provider_request_id', 'emitted_at', 'rejected_reason',
            'created_at', 'updated_at', 'documents', 'status_history',
        ]
        read_only_fields = ['request_number', 'margin', 'created_at', 'updated_at', 'documents', 'status_history']

    def validate_phone(self, value):
        value = (value or '').strip()
        if not PHONE_RE.match(value):
            raise serializers.ValidationError('Ingresa un celular Ecuador válido: 09xxxxxxxx o +593xxxxxxxxx.')
        return value

    def validate_secondary_phone(self, value):
        value = (value or '').strip()
        if value and not PHONE_RE.match(value):
            raise serializers.ValidationError('Ingresa un celular Ecuador válido: 09xxxxxxxx o +593xxxxxxxxx.')
        return value

    def validate(self, attrs):
        request_type = attrs.get('request_type') or getattr(self.instance, 'request_type', None)
        required = [
            'identification_type', 'first_name', 'last_name', 'identification',
            'fingerprint_code', 'birth_date', 'nationality', 'gender',
            'email', 'phone', 'province', 'city', 'address',
        ]

        if request_type in (
            SolicitudFirmaElectronica.TipoSolicitud.REPRESENTANTE_LEGAL,
            SolicitudFirmaElectronica.TipoSolicitud.MIEMBRO_EMPRESA,
        ):
            required += ['ruc', 'business_name', 'applicant_position']

        if request_type == SolicitudFirmaElectronica.TipoSolicitud.MIEMBRO_EMPRESA:
            required += [
                'company_unit', 'request_reason', 'representative_identification_type',
                'representative_identification', 'representative_names', 'representative_last_names',
            ]

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
            'id', 'request_number', 'request_type', 'identification_type',
            'first_name', 'last_name', 'second_last_name', 'identification',
            'fingerprint_code', 'birth_date', 'nationality', 'gender', 'ruc',
            'has_ruc', 'business_name', 'company_unit', 'applicant_position',
            'request_reason', 'email', 'secondary_email', 'phone', 'secondary_phone',
            'province', 'city', 'address', 'representative_identification_type',
            'representative_identification', 'representative_names',
            'representative_last_names', 'validity', 'container_type',
            'wants_erp', 'interested_plan',
        ]
        read_only_fields = ['id', 'request_number']

    def create(self, validated_data):
        validated_data['source'] = SolicitudFirmaElectronica.Origen.LANDING
        validated_data['status'] = SolicitudFirmaElectronica.Estado.NUEVA
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
