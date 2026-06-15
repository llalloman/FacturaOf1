import logging
import os

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasModuleAccess

from .models import (
    DocumentoSolicitudFirma,
    HistorialEstadoSolicitudFirma,
    SolicitudDemoERP,
    SolicitudFirmaElectronica,
)
from .serializers import (
    CambiarEstadoFirmaSerializer,
    DocumentoSolicitudFirmaSerializer,
    DocumentoSolicitudFirmaUploadSerializer,
    HistorialEstadoSolicitudFirmaSerializer,
    PUBLIC_DOCUMENT_FIELDS,
    SolicitudDemoERPSerializer,
    SolicitudFirmaElectronicaPublicSerializer,
    SolicitudFirmaElectronicaSerializer,
    validate_document_file,
)


logger = logging.getLogger(__name__)


def is_super_admin(user):
    return user and user.is_authenticated and (user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN')


def user_can_access_request(user, solicitud):
    if is_super_admin(user):
        return True
    empresa = getattr(user, 'empresa', None)
    return empresa and solicitud.company_id == empresa.id


class SolicitudFirmaElectronicaViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitudFirmaElectronicaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'firmas_electronicas'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'request_type', 'source', 'interested_plan', 'provider']
    search_fields = ['request_number', 'first_name', 'last_name', 'second_last_name', 'identification', 'ruc', 'business_name', 'email', 'phone']
    ordering_fields = ['created_at', 'updated_at', 'status', 'sale_price', 'margin']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            SolicitudFirmaElectronica.objects
            .select_related('company', 'customer')
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


class DocumentoSolicitudFirmaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DocumentoSolicitudFirmaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'firmas_electronicas'

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


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def crear_solicitud_publica(request):
    with transaction.atomic():
        serializer = SolicitudFirmaElectronicaPublicSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        solicitud = serializer.save()
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

    notificar_solicitud_publica(request, solicitud)
    return Response(
        {
            'id': solicitud.id,
            'request_number': solicitud.request_number,
            'mensaje': f'Tu solicitud {solicitud.request_number} fue registrada correctamente.',
        },
        status=status.HTTP_201_CREATED,
    )


def notificar_solicitud_publica(request, solicitud):
    documents = ', '.join(solicitud.documents.values_list('document_type', flat=True)) or 'Sin documentos'
    admin_url = request.build_absolute_uri(f'/firmas-electronicas?solicitud={solicitud.id}')
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'info@of1solutions.com'

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
        f'Ubicación: {solicitud.city}, {solicitud.province}\n'
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
        send_mail(
            admin_subject,
            admin_message,
            from_email,
            ['info@of1solutions.com'],
            fail_silently=False,
        )
    except Exception:
        logger.exception('No se pudo enviar correo interno de solicitud de firma %s', solicitud.request_number)

    try:
        send_mail(
            cliente_subject,
            cliente_message,
            from_email,
            [solicitud.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('No se pudo enviar correo al cliente de solicitud de firma %s', solicitud.request_number)


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
