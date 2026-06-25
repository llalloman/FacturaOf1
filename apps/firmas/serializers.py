import re

from decimal import Decimal

from rest_framework import serializers

from .models import (
    ConsentimientoFirmaElectronica,
    DocumentoSolicitudFirma,
    FirmaCuponElectronico,
    FirmaCuponUso,
    FirmaPrecioElectronica,
    FirmaPromocionElectronica,
    HistorialEstadoSolicitudFirma,
    SolicitudDemoERP,
    SolicitudFirmaElectronica,
    FirmaPagoElectronico,
)
from .pricing import customer_key, promotion_price, resolve_signature_price


SIGNATURE_TERMS_VERSION = 'firma-2026-06-22'
SIGNATURE_PRIVACY_VERSION = 'privacidad-2026-06-22'
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


class FirmaPromocionElectronicaSerializer(serializers.ModelSerializer):
    is_current = serializers.BooleanField(read_only=True)

    class Meta:
        model = FirmaPromocionElectronica
        fields = [
            'id', 'price', 'name', 'group_key', 'discount_type', 'discount_value',
            'promotional_price', 'start_date', 'end_date',
            'active', 'is_current', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'group_key', 'is_current', 'created_at', 'updated_at']
        extra_kwargs = {'promotional_price': {'required': False}}

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        price_obj = attrs.get('price', getattr(self.instance, 'price', None))
        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', 'FINAL_PRICE'))
        discount_value = attrs.get('discount_value', getattr(self.instance, 'discount_value', None))
        if 'promotional_price' in attrs and 'discount_value' not in attrs:
            discount_type = 'FINAL_PRICE'
            discount_value = attrs['promotional_price']
            attrs['discount_type'] = discount_type
            attrs['discount_value'] = discount_value
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La fecha fin no puede ser menor a la fecha de inicio.'})
        if discount_value is not None and discount_value <= 0:
            raise serializers.ValidationError({'discount_value': 'El descuento debe ser mayor a cero.'})
        if discount_type == 'PERCENTAGE' and discount_value is not None and discount_value >= 100:
            raise serializers.ValidationError({'discount_value': 'El porcentaje debe ser menor a 100.'})
        if price_obj and discount_value is not None:
            promotional_price = promotion_price(price_obj, discount_type, discount_value)
            attrs['promotional_price'] = promotional_price
        else:
            promotional_price = attrs.get('promotional_price', getattr(self.instance, 'promotional_price', None))
        if price_obj and promotional_price is not None and promotional_price >= price_obj.regular_price:
            raise serializers.ValidationError({'promotional_price': 'El precio promocional debe ser menor al precio normal.'})
        return attrs


class FirmaPromocionBulkSerializer(serializers.Serializer):
    prices = serializers.PrimaryKeyRelatedField(queryset=FirmaPrecioElectronica.objects.all(), many=True, allow_empty=False)
    name = serializers.CharField(max_length=120)
    discount_type = serializers.ChoiceField(choices=FirmaPromocionElectronica.DiscountType.choices)
    discount_value = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        price_ids = [price.pk for price in attrs['prices']]
        if len(price_ids) != len(set(price_ids)):
            raise serializers.ValidationError({'prices': 'No repitas una vigencia en la promoción.'})
        if attrs['end_date'] < attrs['start_date']:
            raise serializers.ValidationError({'end_date': 'La fecha fin no puede ser menor a la fecha de inicio.'})
        if attrs['discount_type'] == 'PERCENTAGE' and attrs['discount_value'] >= 100:
            raise serializers.ValidationError({'discount_value': 'El porcentaje debe ser menor a 100.'})
        errors = []
        for price in attrs['prices']:
            final = promotion_price(price, attrs['discount_type'], attrs['discount_value'])
            if final >= price.regular_price:
                errors.append(price.get_validity_display())
        if errors:
            raise serializers.ValidationError({'prices': f'El descuento no reduce el precio de: {", ".join(errors)}.'})
        return attrs


class FirmaCuponElectronicoSerializer(serializers.ModelSerializer):
    is_current = serializers.BooleanField(read_only=True)
    usage_count = serializers.IntegerField(source='uses.count', read_only=True)

    class Meta:
        model = FirmaCuponElectronico
        fields = [
            'id', 'code', 'name', 'discount_type', 'discount_value', 'prices',
            'start_date', 'end_date', 'minimum_amount', 'max_total_uses',
            'max_uses_per_customer', 'active', 'is_current', 'usage_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_current', 'usage_count', 'created_at', 'updated_at']

    def validate_code(self, value):
        value = value.strip().upper()
        queryset = FirmaCuponElectronico.objects.filter(code=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Ya existe un cupón con este código.')
        return value

    def validate_max_uses_per_customer(self, value):
        if value < 1:
            raise serializers.ValidationError('Debe permitirse al menos un uso por cliente.')
        return value

    def validate_max_total_uses(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError('El límite total debe ser mayor a cero.')
        return value

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', None))
        discount_value = attrs.get('discount_value', getattr(self.instance, 'discount_value', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La fecha fin no puede ser menor a la fecha de inicio.'})
        if discount_value is not None and discount_value <= 0:
            raise serializers.ValidationError({'discount_value': 'El descuento debe ser mayor a cero.'})
        if discount_type == 'PERCENTAGE' and discount_value is not None and discount_value >= 100:
            raise serializers.ValidationError({'discount_value': 'El porcentaje debe ser menor a 100.'})
        return attrs
class FirmaPrecioElectronicaSerializer(serializers.ModelSerializer):
    validity_display = serializers.CharField(source='get_validity_display', read_only=True)
    active_promotion = serializers.SerializerMethodField()
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = FirmaPrecioElectronica
        fields = [
            'id', 'validity', 'validity_display', 'regular_price', 'current_price',
            'tax_rate', 'producto_erp', 'active', 'order', 'active_promotion', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'validity_display', 'current_price', 'active_promotion', 'created_at', 'updated_at']

    def get_active_promotion(self, obj):
        promotion = obj.active_promotion()
        if not promotion:
            return None
        return FirmaPromocionElectronicaSerializer(promotion).data

    def validate_regular_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('El precio debe ser mayor a cero.')
        return value

    def validate_tax_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('La tarifa de IVA debe estar entre 0 y 100.')
        return value


def aplicar_precio_firma(validated_data):
    validity = validated_data.get('validity')
    if not validity:
        return validated_data
    key = customer_key(validated_data.get('identification'), validated_data.get('email'), validated_data.get('phone'))
    quote = resolve_signature_price(validity, validated_data.get('coupon_code', ''), key, lock_coupon=True)
    validated_data['price_catalog'] = quote['price']
    validated_data['promotion_applied'] = quote['promotion']
    validated_data['coupon_applied'] = quote['coupon']
    validated_data['coupon_code'] = quote['coupon'].code if quote['coupon'] else ''
    validated_data['regular_price'] = quote['regular_price']
    validated_data['sale_price'] = quote['final_price']
    validated_data['discount_amount'] = quote['discount_amount']
    validated_data['coupon_discount_amount'] = quote['coupon_discount_amount']
    validated_data['tax_rate'] = quote['tax_rate']
    validated_data['subtotal_without_tax'] = quote['subtotal_without_tax']
    validated_data['tax_amount'] = quote['tax_amount']
    return validated_data


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


class ConsentimientoFirmaElectronicaSerializer(serializers.ModelSerializer):
    request_number = serializers.CharField(source='request.request_number', read_only=True)

    class Meta:
        model = ConsentimientoFirmaElectronica
        fields = [
            'id', 'request', 'request_number', 'accepted_terms', 'accepted_privacy',
            'accepted_at', 'ip_address', 'user_agent', 'terms_version',
            'privacy_version', 'created_at',
        ]
        read_only_fields = fields




class FirmaPagoElectronicoResumenSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pago_online_id = serializers.SerializerMethodField()
    venta_id = serializers.SerializerMethodField()
    venta_numero = serializers.SerializerMethodField()
    movimiento_bancario_id = serializers.SerializerMethodField()
    application_error = serializers.SerializerMethodField()

    class Meta:
        model = FirmaPagoElectronico
        fields = [
            'id', 'provider', 'status', 'status_display', 'amount', 'base_amount',
            'processing_fee', 'processing_fee_tax', 'currency', 'client_transaction_id',
            'provider_transaction_id', 'authorization_code', 'paid_at', 'created_at',
            'pago_online_id', 'venta_id', 'venta_numero', 'movimiento_bancario_id',
            'application_error',
        ]

    def _pago_online(self, obj):
        if hasattr(obj, '_cached_pago_online'):
            return obj._cached_pago_online
        try:
            from apps.pagos.models import PagoOnline
            pago = PagoOnline.objects.select_related('venta', 'movimiento_bancario').filter(
                client_transaction_id=obj.client_transaction_id,
            ).first()
        except Exception:
            pago = None
        obj._cached_pago_online = pago
        return pago

    def get_pago_online_id(self, obj):
        pago = self._pago_online(obj)
        return pago.id if pago else None

    def get_venta_id(self, obj):
        pago = self._pago_online(obj)
        return pago.venta_id if pago else None

    def get_venta_numero(self, obj):
        pago = self._pago_online(obj)
        return getattr(pago.venta, 'numero_venta', '') if pago and pago.venta_id else ''

    def get_movimiento_bancario_id(self, obj):
        pago = self._pago_online(obj)
        return pago.movimiento_bancario_id if pago else None

    def get_application_error(self, obj):
        pago = self._pago_online(obj)
        return pago.application_error if pago else ''


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
    legal_consent = ConsentimientoFirmaElectronicaSerializer(read_only=True)
    payments = FirmaPagoElectronicoResumenSerializer(many=True, read_only=True)

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
            'price_catalog', 'promotion_applied', 'coupon_applied', 'coupon_code',
            'regular_price', 'discount_amount', 'coupon_discount_amount',
            'tax_rate', 'subtotal_without_tax', 'tax_amount',
            'internal_cost', 'sale_price', 'margin', 'internal_notes',
            'provider_request_id', 'emitted_at', 'rejected_reason',
            'created_at', 'updated_at', 'documents', 'status_history', 'legal_consent', 'payments',
        ]
        read_only_fields = ['request_number', 'price_catalog', 'promotion_applied', 'coupon_applied', 'regular_price', 'discount_amount', 'coupon_discount_amount', 'tax_rate', 'subtotal_without_tax', 'tax_amount', 'margin', 'created_at', 'updated_at', 'documents', 'status_history', 'legal_consent', 'payments']

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
        has_ruc = attrs.get('has_ruc', getattr(self.instance, 'has_ruc', False))
        identification = attrs.get('identification', getattr(self.instance, 'identification', ''))

        if request_type == SolicitudFirmaElectronica.TipoSolicitud.PERSONA_NATURAL:
            if has_ruc:
                digits = re.sub(r'\D', '', identification or '')
                if not attrs.get('ruc') and len(digits) == 10:
                    attrs['ruc'] = f'{digits}001'
            else:
                attrs['ruc'] = ''

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
        elif has_ruc:
            required += ['ruc']

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
        aplicar_precio_firma(validated_data)
        instance = super().create(validated_data)
        if instance.coupon_applied_id:
            FirmaCuponUso.objects.create(
                coupon=instance.coupon_applied,
                request=instance,
                customer_key=customer_key(instance.identification, instance.email, instance.phone),
                discount_amount=instance.coupon_discount_amount,
            )
        HistorialEstadoSolicitudFirma.objects.create(
            request=instance,
            previous_status='',
            new_status=instance.status,
            comment='Solicitud creada',
            changed_by_user=self.context.get('request').user if self.context.get('request') and self.context.get('request').user.is_authenticated else None,
        )
        return instance


class SolicitudFirmaElectronicaPublicSerializer(SolicitudFirmaElectronicaSerializer):
    accepted_terms = serializers.BooleanField(write_only=True, required=True)
    accepted_privacy = serializers.BooleanField(write_only=True, required=True)
    terms_version = serializers.CharField(write_only=True, required=False, allow_blank=True)
    privacy_version = serializers.CharField(write_only=True, required=False, allow_blank=True)

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
            'wants_erp', 'interested_plan', 'coupon_code',
            'accepted_terms', 'accepted_privacy', 'terms_version', 'privacy_version',
        ]
        read_only_fields = ['id', 'request_number']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('accepted_terms') is not True:
            raise serializers.ValidationError({'accepted_terms': 'Debes aceptar los Términos y Condiciones.'})
        if attrs.get('accepted_privacy') is not True:
            raise serializers.ValidationError({'accepted_privacy': 'Debes autorizar el tratamiento de datos personales.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('accepted_terms', None)
        validated_data.pop('accepted_privacy', None)
        validated_data.pop('terms_version', None)
        validated_data.pop('privacy_version', None)
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
