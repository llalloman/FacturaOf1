import logging
import os
import uuid

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, send_mail
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.shortcuts import redirect
from django.urls import reverse
from django_filters.rest_framework import DjangoFilterBackend
from django.utils.html import escape
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response

from .models import (
    ConsentimientoFirmaElectronica,
    DocumentoSolicitudFirma,
    FirmaCuponElectronico,
    FirmaPagoElectronico,
    FirmaPrecioElectronica,
    FirmaPromocionElectronica,
    HistorialEstadoSolicitudFirma,
    SolicitudDemoERP,
    SolicitudFirmaElectronica,
)
from .serializers import (
    CambiarEstadoFirmaSerializer,
    ConsentimientoFirmaElectronicaSerializer,
    DocumentoSolicitudFirmaSerializer,
    FirmaCuponElectronicoSerializer,
    FirmaPrecioElectronicaSerializer,
    FirmaPromocionElectronicaSerializer,
    FirmaPromocionBulkSerializer,
    MarcarPagoTransferenciaFirmaSerializer,
    DocumentoSolicitudFirmaUploadSerializer,
    HistorialEstadoSolicitudFirmaSerializer,
    PUBLIC_DOCUMENT_FIELDS,
    SolicitudDemoERPSerializer,
    SolicitudFirmaElectronicaPublicSerializer,
    SolicitudFirmaElectronicaSerializer,
    SIGNATURE_PRIVACY_VERSION,
    SIGNATURE_TERMS_VERSION,
    validate_document_file,
)
from .pricing import customer_key, promotion_price, resolve_signature_price
from .services.payphone_service import (
    PayPhoneConfigurationError,
    PayPhoneProviderError,
    confirmar_pago_payphone_firma,
    crear_pago_payphone_firma,
    crear_pago_payphone_firma_box,
)
from apps.pagos.services import PagoOnlineApplicationError, empresa_para_solicitud_firma, registrar_pago_firma_transferencia
from apps.bancos.serializers import CuentaBancariaSerializer


logger = logging.getLogger(__name__)


def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def is_super_admin(user):
    return user and user.is_authenticated and (user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN')


def user_can_access_request(user, solicitud):
    if is_super_admin(user):
        return True
    empresa = getattr(user, 'empresa', None)
    return empresa and solicitud.company_id == empresa.id


class IsSuperAdminOnly(BasePermission):
    message = 'Solo SUPER_ADMIN puede administrar firmas electrónicas.'

    def has_permission(self, request, view):
        return is_super_admin(request.user)


class SolicitudFirmaElectronicaViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitudFirmaElectronicaSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'request_type', 'source', 'interested_plan', 'provider']
    search_fields = ['request_number', 'first_name', 'last_name', 'second_last_name', 'identification', 'ruc', 'business_name', 'email', 'phone']
    ordering_fields = ['created_at', 'updated_at', 'status', 'sale_price', 'margin']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            SolicitudFirmaElectronica.objects
            .select_related('company', 'customer', 'legal_consent')
            .prefetch_related('documents', 'status_history')
        )
        user = self.request.user
        if is_super_admin(user):
            return qs
        empresa = getattr(user, 'empresa', None)
        if empresa:
            return qs.filter(company=empresa)
        return qs.none()

    def perform_create(self, serializer):
        empresa = getattr(self.request.user, 'empresa', None)
        if not is_super_admin(self.request.user) and empresa:
            serializer.save(company=empresa)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], url_path='cambiar_estado')
    def cambiar_estado(self, request, pk=None):
        solicitud = self.get_object()
        serializer = CambiarEstadoFirmaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        previous = solicitud.status
        new_status = serializer.validated_data['status']
        solicitud.status = new_status
        solicitud.rejected_reason = serializer.validated_data.get('rejected_reason', solicitud.rejected_reason)
        solicitud.provider_request_id = serializer.validated_data.get('provider_request_id', solicitud.provider_request_id)
        if new_status == SolicitudFirmaElectronica.Estado.EMITIDA and not solicitud.emitted_at:
            solicitud.emitted_at = timezone.now()
        solicitud.save()
        HistorialEstadoSolicitudFirma.objects.create(
            request=solicitud,
            previous_status=previous,
            new_status=new_status,
            comment=serializer.validated_data.get('comment', ''),
            changed_by_user=request.user,
        )
        return Response(SolicitudFirmaElectronicaSerializer(solicitud, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='documentos')
    def subir_documento(self, request, pk=None):
        solicitud = self.get_object()
        serializer = DocumentoSolicitudFirmaUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        documento = serializer.save(request=solicitud)
        return Response(
            DocumentoSolicitudFirmaSerializer(documento, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='historial')
    def historial(self, request, pk=None):
        solicitud = self.get_object()
        serializer = HistorialEstadoSolicitudFirmaSerializer(solicitud.status_history.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='marcar_pago_transferencia')
    def marcar_pago_transferencia(self, request, pk=None):
        solicitud = self.get_object()
        serializer = MarcarPagoTransferenciaFirmaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.bancos.models import CuentaBancaria

        empresa = empresa_para_solicitud_firma(solicitud)
        cuenta = CuentaBancaria.objects.filter(
            pk=serializer.validated_data['cuenta_bancaria'],
            empresa=empresa,
            activa=True,
        ).first()
        if not cuenta:
            return Response({'cuenta_bancaria': 'Cuenta bancaria no encontrada o inactiva para la empresa destino.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            registrar_pago_firma_transferencia(
                solicitud,
                cuenta_bancaria=cuenta,
                amount=serializer.validated_data.get('amount'),
                fecha_pago=serializer.validated_data.get('fecha_pago'),
                referencia=serializer.validated_data.get('referencia', ''),
                observacion=serializer.validated_data.get('observacion', ''),
                usuario=request.user,
            )
        except PagoOnlineApplicationError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        solicitud.refresh_from_db()
        return Response(SolicitudFirmaElectronicaSerializer(solicitud, context={'request': request}).data)


class DocumentoSolicitudFirmaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DocumentoSolicitudFirmaSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]

    def get_queryset(self):
        qs = DocumentoSolicitudFirma.objects.select_related('request', 'request__company')
        user = self.request.user
        if is_super_admin(user):
            return qs
        empresa = getattr(user, 'empresa', None)
        if empresa:
            return qs.filter(request__company=empresa)
        return qs.none()

    @action(detail=True, methods=['get'], url_path='descargar')
    def descargar(self, request, pk=None):
        documento = self.get_object()
        if not user_can_access_request(request.user, documento.request):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not documento.file or not documento.file.storage.exists(documento.file.name):
            logger.warning(
                'Documento de firma no encontrado en storage. documento_id=%s path=%s',
                documento.id,
                getattr(documento.file, 'name', ''),
            )
            return Response(
                {
                    'detail': 'El archivo no está disponible en el almacenamiento. Vuelve a cargar el documento.',
                    'code': 'file_missing',
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return FileResponse(
            documento.file.open('rb'),
            as_attachment=False,
            filename=documento.file_name or os.path.basename(documento.file.name),
            content_type=documento.mime_type or 'application/octet-stream',
        )


class ConsentimientoFirmaElectronicaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ConsentimientoFirmaElectronicaSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    queryset = ConsentimientoFirmaElectronica.objects.select_related('request').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['terms_version', 'privacy_version', 'accepted_terms', 'accepted_privacy']
    search_fields = ['request__request_number', 'request__identification', 'request__email', 'ip_address']
    ordering_fields = ['accepted_at', 'created_at']
    ordering = ['-accepted_at']


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperAdminOnly])
def cuentas_pago_transferencia_firma(request):
    from apps.bancos.models import CuentaBancaria
    from apps.pagos.services import _default_empresa

    empresa = _default_empresa()
    if not empresa:
        return Response({'detail': 'Configura PAYMENTS_DEFAULT_COMPANY_ID para listar cuentas de pago de firmas.'}, status=status.HTTP_400_BAD_REQUEST)
    cuentas = CuentaBancaria.objects.filter(empresa=empresa, activa=True).order_by('banco', 'numero_cuenta')
    return Response(CuentaBancariaSerializer(cuentas, many=True).data)


class FirmaPrecioElectronicaViewSet(viewsets.ModelViewSet):
    serializer_class = FirmaPrecioElectronicaSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    queryset = FirmaPrecioElectronica.objects.prefetch_related('promotions').all().order_by('order', 'regular_price')
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['order', 'regular_price', 'validity', 'active']
    ordering = ['order', 'regular_price']


class FirmaPromocionElectronicaViewSet(viewsets.ModelViewSet):
    serializer_class = FirmaPromocionElectronicaSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    queryset = FirmaPromocionElectronica.objects.select_related('price').all().order_by('-active', '-start_date')
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['price', 'active']
    ordering_fields = ['start_date', 'end_date', 'promotional_price', 'active']
    ordering = ['-active', '-start_date']

    @action(detail=False, methods=['post'], url_path='crear-multiples')
    @transaction.atomic
    def crear_multiples(self, request):
        serializer = FirmaPromocionBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        group_key = uuid.uuid4()
        created = []
        for price in data['prices']:
            promo = FirmaPromocionElectronica.objects.create(
                price=price,
                name=data['name'],
                group_key=group_key,
                discount_type=data['discount_type'],
                discount_value=data['discount_value'],
                promotional_price=promotion_price(price, data['discount_type'], data['discount_value']),
                start_date=data['start_date'],
                end_date=data['end_date'],
                active=data['active'],
            )
            created.append(promo)
        return Response(FirmaPromocionElectronicaSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


class FirmaCuponElectronicoViewSet(viewsets.ModelViewSet):
    serializer_class = FirmaCuponElectronicoSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    queryset = FirmaCuponElectronico.objects.prefetch_related('prices').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['active', 'discount_type']
    search_fields = ['code', 'name']
    ordering_fields = ['start_date', 'end_date', 'code', 'active']
    ordering = ['-active', '-start_date']

    def destroy(self, request, *args, **kwargs):
        coupon = self.get_object()
        if coupon.uses.exists():
            return Response(
                {'detail': 'No se puede eliminar un cupón utilizado. Puedes desactivarlo.'},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([AllowAny])
def precios_firma_publicos(request):
    precios = (
        FirmaPrecioElectronica.objects
        .filter(active=True)
        .prefetch_related('promotions')
        .order_by('order', 'regular_price')
    )
    return Response(FirmaPrecioElectronicaSerializer(precios, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def validar_cupon_publico(request):
    validity = request.data.get('validity')
    code = request.data.get('code', '')
    key = customer_key(request.data.get('identification'), request.data.get('email'), request.data.get('phone'))
    quote = resolve_signature_price(validity, code, key)
    coupon_wins = bool(quote['coupon'])
    return Response({
        'valid': True,
        'code': quote['coupon_entered'].code,
        'applied': coupon_wins,
        'message': 'Cupón aplicado correctamente.' if coupon_wins else 'El cupón es válido, pero la promoción vigente ofrece un mejor precio.',
        'regular_price': quote['regular_price'],
        'final_price': quote['final_price'],
        'discount_amount': quote['discount_amount'],
        'subtotal_without_tax': quote['subtotal_without_tax'],
        'tax_rate': quote['tax_rate'],
        'tax_amount': quote['tax_amount'],
        'applied_source': 'coupon' if coupon_wins else ('promotion' if quote['promotion'] else 'regular'),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def crear_solicitud_publica(request):
    with transaction.atomic():
        serializer = SolicitudFirmaElectronicaPublicSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        solicitud = serializer.save()
        ConsentimientoFirmaElectronica.objects.create(
            request=solicitud,
            accepted_terms=True,
            accepted_privacy=True,
            ip_address=get_client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:1000],
            terms_version=request.data.get('terms_version') or SIGNATURE_TERMS_VERSION,
            privacy_version=request.data.get('privacy_version') or SIGNATURE_PRIVACY_VERSION,
        )
        logger.info(
            'Consentimiento legal registrado para solicitud de firma %s desde IP %s',
            solicitud.request_number,
            get_client_ip(request),
        )
        for field_name, document_type in PUBLIC_DOCUMENT_FIELDS.items():
            file = request.FILES.get(field_name)
            if not file:
                continue
            validate_document_file(file)
            DocumentoSolicitudFirma.objects.create(
                request=solicitud,
                document_type=document_type,
                file=file,
                file_name=getattr(file, 'name', ''),
                mime_type=getattr(file, 'content_type', '') or '',
            )

    return Response(
        {
            'id': solicitud.id,
            'request_number': solicitud.request_number,
            'mensaje': f'Tu solicitud {solicitud.request_number} fue registrada correctamente.',
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def subir_documento_solicitud_publica(request, pk):
    solicitud = get_object_or_404(SolicitudFirmaElectronica, pk=pk)
    request_number = request.data.get('request_number')
    if request_number != solicitud.request_number:
        return Response({'detail': 'Número de solicitud inválido.'}, status=status.HTTP_403_FORBIDDEN)

    document_type = request.data.get('document_type')
    allowed_types = set(PUBLIC_DOCUMENT_FIELDS.values())
    if document_type not in allowed_types:
        return Response({'document_type': 'Tipo de documento no permitido.'}, status=status.HTTP_400_BAD_REQUEST)

    file = request.FILES.get('file')
    if not file:
        return Response({'file': 'Este campo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    validate_document_file(file)
    documento = DocumentoSolicitudFirma.objects.create(
        request=solicitud,
        document_type=document_type,
        file=file,
        file_name=getattr(file, 'name', ''),
        mime_type=getattr(file, 'content_type', '') or '',
    )
    return Response(
        DocumentoSolicitudFirmaSerializer(documento, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def finalizar_solicitud_publica(request, pk):
    solicitud = get_object_or_404(SolicitudFirmaElectronica, pk=pk)
    request_number = request.data.get('request_number')
    if request_number != solicitud.request_number:
        return Response({'detail': 'Número de solicitud inválido.'}, status=status.HTTP_403_FORBIDDEN)

    email_status = notificar_solicitud_publica(request, solicitud)
    return Response(
        {
            'id': solicitud.id,
            'request_number': solicitud.request_number,
            'mensaje': f'Tu solicitud {solicitud.request_number} fue registrada correctamente.',
            'email_status': email_status,
        }
    )




def _public_signature_summary(solicitud):
    return {
        'id': solicitud.id,
        'request_number': solicitud.request_number,
        'request_type': solicitud.request_type,
        'request_type_display': solicitud.get_request_type_display(),
        'identification_type': solicitud.identification_type,
        'identification': solicitud.identification,
        'full_name': solicitud.full_name,
        'first_name': solicitud.first_name,
        'last_name': solicitud.last_name,
        'second_last_name': solicitud.second_last_name,
        'email': solicitud.email,
        'phone': solicitud.phone,
        'secondary_phone': solicitud.secondary_phone,
        'province': solicitud.province,
        'city': solicitud.city,
        'parish': solicitud.parish,
        'address': solicitud.address,
        'ruc': solicitud.ruc,
        'business_name': solicitud.business_name,
        'company_unit': solicitud.company_unit,
        'applicant_position': solicitud.applicant_position,
        'request_reason': solicitud.request_reason,
        'representative_names': solicitud.representative_names,
        'representative_last_names': solicitud.representative_last_names,
        'validity': solicitud.validity,
        'validity_display': solicitud.get_validity_display(),
        'container_type': solicitud.container_type,
        'sale_price': str(solicitud.sale_price),
        'subtotal_without_tax': str(solicitud.subtotal_without_tax),
        'tax_amount': str(solicitud.tax_amount),
        'status': solicitud.status,
        'status_display': solicitud.get_status_display(),
        'documents': [
            {
                'document_type': doc.document_type,
                'document_type_display': doc.get_document_type_display(),
                'file_name': doc.file_name,
                'uploaded_at': doc.uploaded_at,
                'created_at': doc.uploaded_at,
            }
            for doc in solicitud.documents.all()
        ],
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def consultar_solicitud_publica_pago(request):
    request_number = request.query_params.get('request_number', '').strip()
    transaction = request.query_params.get('transaction', '').strip()
    verification = request.query_params.get('verification', '').strip().lower()
    if not request_number:
        return Response({'detail': 'Número de solicitud requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    solicitud = get_object_or_404(
        SolicitudFirmaElectronica.objects.prefetch_related('documents', 'payments'),
        request_number=request_number,
    )

    payment = None
    if transaction:
        payment = get_object_or_404(
            FirmaPagoElectronico,
            request=solicitud,
            client_transaction_id=transaction,
        )
    else:
        if not verification:
            return Response({'detail': 'Ingresa la cédula, RUC, pasaporte, correo o teléfono asociado a la solicitud.'}, status=status.HTTP_400_BAD_REQUEST)
        verification_digits = ''.join(ch for ch in verification if ch.isdigit())
        matches_identity = verification_digits and verification_digits in {
            ''.join(ch for ch in (solicitud.identification or '') if ch.isdigit()),
            ''.join(ch for ch in (solicitud.ruc or '') if ch.isdigit()),
            ''.join(ch for ch in (solicitud.phone or '') if ch.isdigit()),
            ''.join(ch for ch in (solicitud.secondary_phone or '') if ch.isdigit()),
        }
        matches_email = verification in {
            (solicitud.email or '').strip().lower(),
            (solicitud.secondary_email or '').strip().lower(),
        }
        if not matches_identity and not matches_email:
            return Response({'detail': 'Los datos ingresados no coinciden con la solicitud.'}, status=status.HTTP_403_FORBIDDEN)
        payments = solicitud.payments.all()
        payment = (
            payments.filter(status=FirmaPagoElectronico.Estado.PAID).order_by('-paid_at', '-created_at').first()
            or payments.order_by('-created_at').first()
        )

    payment_payload = None
    if payment:
        payment_payload = {
            'status': payment.status,
            'status_display': payment.get_status_display(),
            'provider': payment.provider,
            'provider_display': payment.get_provider_display(),
            'payment_method': payment.provider,
            'payment_method_display': payment.get_provider_display(),
            'amount': str(payment.amount),
            'base_amount': str(payment.base_amount),
            'processing_fee': str(payment.processing_fee),
            'processing_fee_tax': str(payment.processing_fee_tax),
            'currency': payment.currency,
            'client_transaction_id': payment.client_transaction_id,
            'provider_transaction_id': payment.provider_transaction_id,
            'authorization_code': payment.authorization_code,
            'paid_at': payment.paid_at,
        }

    return Response({
        'solicitud': _public_signature_summary(solicitud),
        'payment': payment_payload,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def crear_pago_payphone_firma_publico(request, pk):
    solicitud = get_object_or_404(SolicitudFirmaElectronica, pk=pk)
    request_number = request.data.get('request_number')
    if request_number != solicitud.request_number:
        return Response({'detail': 'Número de solicitud inválido.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        payment = crear_pago_payphone_firma(solicitud, request)
    except PayPhoneConfigurationError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except PayPhoneProviderError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
        'id': payment.id,
        'provider': payment.provider,
        'status': payment.status,
        'amount': str(payment.amount),
        'base_amount': str(payment.base_amount),
        'processing_fee': str(payment.processing_fee),
        'processing_fee_tax': str(payment.processing_fee_tax),
        'currency': payment.currency,
        'client_transaction_id': payment.client_transaction_id,
        'payment_url': payment.payment_url,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def crear_cajita_payphone_firma_publico(request, pk):
    solicitud = get_object_or_404(SolicitudFirmaElectronica, pk=pk)
    request_number = request.data.get('request_number')
    if request_number != solicitud.request_number:
        return Response({'detail': 'Número de solicitud inválido.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        payment = crear_pago_payphone_firma_box(solicitud, request)
    except PayPhoneConfigurationError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    box_config = dict(payment.raw_request)
    box_config['token'] = getattr(settings, 'PAYPHONE_TOKEN', '')
    return Response({
        'id': payment.id,
        'provider': payment.provider,
        'status': payment.status,
        'amount': str(payment.amount),
        'base_amount': str(payment.base_amount),
        'processing_fee': str(payment.processing_fee),
        'processing_fee_tax': str(payment.processing_fee_tax),
        'currency': payment.currency,
        'client_transaction_id': payment.client_transaction_id,
        'box_config': box_config,
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def payphone_firma_callback_publico(request):
    data = request.data if request.method == 'POST' else request.query_params
    client_transaction_id = data.get('clientTransactionId') or data.get('client_transaction_id') or data.get('reference')
    if not client_transaction_id:
        return Response({'detail': 'clientTransactionId requerido.'}, status=status.HTTP_400_BAD_REQUEST)
    payment = get_object_or_404(FirmaPagoElectronico, client_transaction_id=client_transaction_id, provider=FirmaPagoElectronico.Provider.PAYPHONE)
    payment.raw_response = dict(data)
    provider_status = str(data.get('status') or data.get('state') or data.get('transactionStatus') or '').upper()
    if provider_status in {'APPROVED', 'PAID', 'SUCCESS', 'OK', '1'}:
        payment.status = FirmaPagoElectronico.Estado.PAID
        payment.paid_at = timezone.now()
    elif provider_status in {'CANCELLED', 'CANCELED', 'VOID'}:
        payment.status = FirmaPagoElectronico.Estado.CANCELLED
    elif provider_status in {'FAILED', 'REJECTED', 'ERROR', 'DECLINED'}:
        payment.status = FirmaPagoElectronico.Estado.FAILED
    payment.provider_transaction_id = str(data.get('transactionId') or data.get('id') or payment.provider_transaction_id or '')
    payment.save(update_fields=['status', 'provider_transaction_id', 'raw_response', 'paid_at', 'updated_at'])
    return Response({'detail': 'Callback registrado.', 'status': payment.status})


def _append_query(url, params):
    separator = '&' if '?' in url else '?'
    query = '&'.join(f'{key}={value}' for key, value in params.items() if value not in (None, ''))
    return f'{url}{separator}{query}' if query else url


@api_view(['GET'])
@permission_classes([AllowAny])
def payphone_firma_retorno_publico(request):
    provider_id = request.query_params.get('id')
    client_transaction_id = request.query_params.get('clientTransactionId')
    success_url = getattr(settings, 'PAYPHONE_SIGNATURE_SUCCESS_URL', '') or '/solicitar-firma-electronica/pago-confirmado'
    failed_url = getattr(settings, 'PAYPHONE_SIGNATURE_FAILED_URL', '') or '/solicitar-firma-electronica/pago-error'

    if not provider_id or not client_transaction_id:
        return redirect(_append_query(failed_url, {'payment': 'missing_params'}))

    try:
        payment = confirmar_pago_payphone_firma(provider_id, client_transaction_id)
    except FirmaPagoElectronico.DoesNotExist:
        return redirect(_append_query(failed_url, {'payment': 'not_found'}))
    except (PayPhoneConfigurationError, PayPhoneProviderError) as exc:
        logger.warning('No se pudo confirmar pago PayPhone. client_transaction_id=%s error=%s', client_transaction_id, exc)
        return redirect(_append_query(failed_url, {'payment': 'failed', 'transaction': client_transaction_id}))

    if payment.status == FirmaPagoElectronico.Estado.PAID:
        return redirect(_append_query(success_url, {
            'payment': 'success',
            'request': payment.request.request_number,
            'transaction': payment.client_transaction_id,
        }))
    return redirect(_append_query(failed_url, {
        'payment': payment.status.lower(),
        'request': payment.request.request_number,
        'transaction': payment.client_transaction_id,
    }))


@api_view(['GET'])
@permission_classes([AllowAny])
def payphone_firma_cancelado_publico(request):
    frontend_url = getattr(settings, 'PAYPHONE_SIGNATURE_CANCEL_URL', '') or '/solicitar-firma-electronica/pago-cancelado'
    return redirect(_append_query(frontend_url, {'payment': 'cancelled'}))


def _email_button(url, label, background='#2563eb'):
    return (
        f'<a href="{escape(url)}" '
        f'style="display:inline-block;background:{background};color:#ffffff;text-decoration:none;'
        'font-weight:700;border-radius:10px;padding:12px 18px;font-size:14px;">'
        f'{escape(label)}</a>'
    )


def _email_layout(title, subtitle, body_html):
    return f"""
<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:24px 28px;color:#ffffff;">
                <div style="font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#93c5fd;">OF1 Solutions</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">{escape(title)}</h1>
                <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;line-height:1.6;">{escape(subtitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
                Este correo fue generado automáticamente por OF1 Solutions. Si necesitas ayuda, responde este mensaje o contáctanos por WhatsApp.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _detail_table(rows):
    rendered_rows = ''.join(
        '<tr>'
        f'<td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">{escape(str(label))}</td>'
        f'<td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #e2e8f0;">{escape(str(value or "-"))}</td>'
        '</tr>'
        for label, value in rows
    )
    return (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;margin:16px 0 0;">'
        f'{rendered_rows}'
        '</table>'
    )


def _send_structured_email(subject, text_body, html_body, from_email, recipients):
    email = EmailMultiAlternatives(subject, text_body, from_email, recipients)
    email.attach_alternative(html_body, 'text/html')
    return email.send(fail_silently=False)


def _notificar_solicitud_publica_plain_legacy(request, solicitud):
    documents = ', '.join(solicitud.documents.values_list('document_type', flat=True)) or 'Sin documentos'
    admin_url = request.build_absolute_uri(f'/firmas-electronicas?solicitud={solicitud.id}')
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'info@of1solutions.com'
    email_status = {
        'admin_sent': False,
        'client_sent': False,
        'admin_error': '',
        'client_error': '',
    }

    admin_subject = f'Nueva solicitud de firma {solicitud.request_number}'
    admin_message = (
        'Nueva solicitud de firma electrónica\n\n'
        f'Número: {solicitud.request_number}\n'
        f'Tipo: {solicitud.get_request_type_display()}\n'
        f'Cliente: {solicitud.full_name}\n'
        f'Identificación: {solicitud.identification}\n'
        f'RUC: {solicitud.ruc or "-"}\n'
        f'Empresa: {solicitud.business_name or "-"}\n'
        f'Correo: {solicitud.email}\n'
        f'Teléfono: {solicitud.phone}\n'
        f'Ubicación: {solicitud.parish or "-"}, {solicitud.city}, {solicitud.province}\n'
        f'Documentos: {documents}\n\n'
        f'Revisar en administración: {admin_url}\n'
    )
    cliente_subject = f'Solicitud de firma electrónica recibida {solicitud.request_number}'
    cliente_message = (
        f'Hola {solicitud.full_name},\n\n'
        'Hemos recibido tu solicitud de firma electrónica en OF1 Solutions.\n\n'
        f'Número de solicitud: {solicitud.request_number}\n'
        f'Tipo de solicitud: {solicitud.get_request_type_display()}\n'
        f'Identificación: {solicitud.identification}\n'
        f'Correo registrado: {solicitud.email}\n\n'
        'Un asesor revisará la información y documentación cargada para continuar el proceso.\n'
        'Para confirmar el pago o consultar el estado de tu trámite, contáctanos por WhatsApp indicando tu número de solicitud.\n\n'
        'Gracias por confiar en OF1 Solutions.\n'
    )

    try:
        sent = send_mail(
            admin_subject,
            admin_message,
            from_email,
            ['info@of1solutions.com'],
            fail_silently=False,
        )
        email_status['admin_sent'] = sent > 0
    except Exception as exc:
        email_status['admin_error'] = str(exc)
        logger.exception('No se pudo enviar correo interno de solicitud de firma %s', solicitud.request_number)

    try:
        sent = send_mail(
            cliente_subject,
            cliente_message,
            from_email,
            [solicitud.email],
            fail_silently=False,
        )
        email_status['client_sent'] = sent > 0
    except Exception as exc:
        email_status['client_error'] = str(exc)
        logger.exception('No se pudo enviar correo al cliente de solicitud de firma %s', solicitud.request_number)

    return email_status


def notificar_solicitud_publica(request, solicitud):
    documents = ', '.join(solicitud.documents.values_list('document_type', flat=True)) or 'Sin documentos'
    admin_url = request.build_absolute_uri(f'/firmas-electronicas?solicitud={solicitud.id}')
    firmador_url = (getattr(settings, 'FIRMADOR_PUBLIC_BASE_URL', '') or 'https://firmador.of1solutions.com').rstrip('/')
    whatsapp_url = 'https://api.whatsapp.com/send/?phone=593991840854'
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'info@of1solutions.com'
    email_status = {
        'admin_sent': False,
        'client_sent': False,
        'admin_error': '',
        'client_error': '',
    }

    admin_subject = f'Nueva solicitud de firma {solicitud.request_number}'
    admin_message = (
        'Nueva solicitud de firma electrónica\n\n'
        f'Número: {solicitud.request_number}\n'
        f'Tipo: {solicitud.get_request_type_display()}\n'
        f'Cliente: {solicitud.full_name}\n'
        f'Identificación: {solicitud.identification}\n'
        f'RUC: {solicitud.ruc or "-"}\n'
        f'Empresa: {solicitud.business_name or "-"}\n'
        f'Correo: {solicitud.email}\n'
        f'Teléfono: {solicitud.phone}\n'
        f'Vigencia: {solicitud.get_validity_display()}\n'
        f'Valor: ${solicitud.sale_price}\n'
        f'Ubicación: {solicitud.parish or "-"}, {solicitud.city}, {solicitud.province}\n'
        f'Documentos: {documents}\n\n'
        f'Revisar en administración: {admin_url}\n'
    )
    admin_html = _email_layout(
        f'Nueva solicitud {solicitud.request_number}',
        'Hay una nueva solicitud pública de firma electrónica para revisar.',
        (
            '<p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">'
            'Se registró una solicitud desde el formulario público. Revisa la documentación y el pago para continuar el proceso.'
            '</p>'
            + _detail_table([
                ('Número', solicitud.request_number),
                ('Tipo', solicitud.get_request_type_display()),
                ('Cliente', solicitud.full_name),
                ('Identificación', solicitud.identification),
                ('RUC', solicitud.ruc or '-'),
                ('Empresa', solicitud.business_name or '-'),
                ('Correo', solicitud.email),
                ('Teléfono', solicitud.phone),
                ('Vigencia', solicitud.get_validity_display()),
                ('Valor', f'${solicitud.sale_price}'),
                ('Ubicación', f'{solicitud.parish or "-"}, {solicitud.city}, {solicitud.province}'),
                ('Documentos', documents),
            ])
            + f'<div style="margin-top:22px;">{_email_button(admin_url, "Revisar solicitud")}</div>'
        ),
    )

    cliente_subject = f'Solicitud de firma electrónica recibida {solicitud.request_number}'
    cliente_message = (
        f'Hola {solicitud.full_name},\n\n'
        'Hemos recibido tu solicitud de firma electrónica en OF1 Solutions.\n\n'
        f'Número de solicitud: {solicitud.request_number}\n'
        f'Tipo de solicitud: {solicitud.get_request_type_display()}\n'
        f'Identificación: {solicitud.identification}\n'
        f'Vigencia: {solicitud.get_validity_display()}\n'
        f'Valor: ${solicitud.sale_price}\n'
        f'Correo registrado: {solicitud.email}\n\n'
        'Un asesor revisará la información y documentación cargada para continuar el proceso.\n'
        'Cuando tengas tu firma emitida, también puedes usar OF1 Firmador para firmar PDFs desde el navegador o la app Android.\n\n'
        f'Firmador OF1: {firmador_url}\n'
        'Para confirmar el pago o consultar el estado de tu trámite, contáctanos por WhatsApp indicando tu número de solicitud.\n\n'
        'Gracias por confiar en OF1 Solutions.\n'
    )
    cliente_html = _email_layout(
        f'Recibimos tu solicitud {solicitud.request_number}',
        'Tu solicitud de firma electrónica fue registrada correctamente.',
        (
            f'<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Hola <strong>{escape(solicitud.full_name)}</strong>, gracias por confiar en OF1 Solutions. '
            'Un asesor revisará tus datos, documentos y pago para continuar con la emisión.</p>'
            + _detail_table([
                ('Número de solicitud', solicitud.request_number),
                ('Tipo de solicitud', solicitud.get_request_type_display()),
                ('Identificación', solicitud.identification),
                ('Vigencia', solicitud.get_validity_display()),
                ('Valor', f'${solicitud.sale_price}'),
                ('Correo registrado', solicitud.email),
            ])
            + '<div style="margin-top:22px;padding:18px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:16px;">'
            '<div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#2563eb;letter-spacing:.04em;">También incluido en OF1</div>'
            '<h2 style="margin:6px 0 8px;font-size:18px;color:#0f172a;">Usa OF1 Firmador para firmar tus PDFs</h2>'
            '<p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.7;">'
            'Cuando tu firma electrónica esté emitida, puedes ingresar al firmador para cargar documentos PDF, firmarlos y descargarlos de forma sencilla.'
            '</p>'
            f'{_email_button(firmador_url, "Abrir OF1 Firmador")}'
            '</div>'
            + f'<div style="margin-top:18px;">{_email_button(whatsapp_url, "Contactar por WhatsApp", "#16a34a")}</div>'
        ),
    )

    try:
        sent = _send_structured_email(
            admin_subject,
            admin_message,
            admin_html,
            from_email,
            ['info@of1solutions.com'],
        )
        email_status['admin_sent'] = sent > 0
    except Exception as exc:
        email_status['admin_error'] = str(exc)
        logger.exception('No se pudo enviar correo interno de solicitud de firma %s', solicitud.request_number)

    try:
        sent = _send_structured_email(
            cliente_subject,
            cliente_message,
            cliente_html,
            from_email,
            [solicitud.email],
        )
        email_status['client_sent'] = sent > 0
    except Exception as exc:
        email_status['client_error'] = str(exc)
        logger.exception('No se pudo enviar correo al cliente de solicitud de firma %s', solicitud.request_number)

    return email_status


@api_view(['POST'])
@permission_classes([AllowAny])
def crear_demo_publica(request):
    serializer = SolicitudDemoERPSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    demo = serializer.save()
    return Response(
        {
            'id': demo.id,
            'mensaje': 'Hemos recibido tu solicitud. Un asesor de OF1 Solutions se comunicará contigo para agendar la demostración.',
        },
        status=status.HTTP_201_CREATED,
    )
