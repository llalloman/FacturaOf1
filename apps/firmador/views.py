import logging
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.http import FileResponse, Http404, HttpResponse
from django.utils.http import content_disposition_header
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FirmadorCertificado, FirmadorDocumento, FirmadorWorkspace
from .serializers import FirmadorCertificadoSerializer, FirmadorDocumentoSerializer, FirmadorWorkspaceSerializer
from .services.certificates import decrypt_certificate, parse_and_encrypt_certificate
from .services.pdf_signer import (
    sign_pdf_with_pkcs12,
    validate_certificate_upload,
    validate_pdf_upload,
)


logger = logging.getLogger(__name__)


def _default_limit(name, default_mb):
    return int(getattr(settings, name, default_mb * 1024 * 1024))


def _workspace_defaults():
    return {
        'max_file_size_bytes': _default_limit('FIRMADOR_MAX_FILE_SIZE_BYTES', 25),
        'max_storage_bytes': _default_limit('FIRMADOR_MAX_STORAGE_BYTES_PER_WORKSPACE', 1024),
        'monthly_signature_limit': int(getattr(settings, 'FIRMADOR_MONTHLY_SIGNATURE_LIMIT', 100)),
        'default_retention_days': int(getattr(settings, 'FIRMADOR_DEFAULT_RETENTION_DAYS', 30)),
        'max_retention_days': int(getattr(settings, 'FIRMADOR_MAX_RETENTION_DAYS', 180)),
    }


def get_or_create_workspace(user):
    workspace = FirmadorWorkspace.objects.filter(owner_user=user, activo=True).order_by('-created_at').first()
    if workspace:
        return workspace

    empresa = getattr(user, 'empresa', None)
    if empresa:
        return FirmadorWorkspace.objects.create(
            owner_user=user,
            empresa=empresa,
            tipo=FirmadorWorkspace.Tipo.EMPRESA_ERP,
            nombre=empresa.razon_social,
            identificacion=empresa.ruc,
            email=empresa.email or user.email,
            **_workspace_defaults(),
        )

    return FirmadorWorkspace.objects.create(
        owner_user=user,
        tipo=FirmadorWorkspace.Tipo.PERSONA_NATURAL,
        nombre=user.get_full_name() or user.email,
        identificacion=getattr(user, 'cedula', '') or '',
        email=user.email,
        **_workspace_defaults(),
    )


def _float_param(data, name, default):
    try:
        return float(data.get(name, default))
    except (TypeError, ValueError):
        return default


def _int_param(data, name, default):
    try:
        return int(data.get(name, default))
    except (TypeError, ValueError):
        return default


def _signature_box_from_percent(pdf_file, page_number, x_percent, y_percent, width_percent, height_percent):
    try:
        from PyPDF2 import PdfReader

        current = pdf_file.tell() if hasattr(pdf_file, 'tell') else None
        reader = PdfReader(pdf_file)
        page_index = min(max(int(page_number or 1) - 1, 0), len(reader.pages) - 1)
        page = reader.pages[page_index]
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)
        if current is not None:
            pdf_file.seek(current)
    except Exception:
        page_width = 612
        page_height = 792
        if hasattr(pdf_file, 'seek'):
            pdf_file.seek(0)

    x = max(0, min(95, x_percent)) / 100 * page_width
    box_width = max(8, min(95, width_percent)) / 100 * page_width
    box_height = max(6, min(50, height_percent)) / 100 * page_height
    y_top = max(0, min(95, y_percent)) / 100 * page_height
    y = max(0, page_height - y_top - box_height)
    return (int(x), int(y), int(min(x + box_width, page_width)), int(min(y + box_height, page_height)))


class FirmadorDocumentoViewSet(viewsets.ModelViewSet):
    serializer_class = FirmadorDocumentoSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = FirmadorDocumento.objects.select_related('workspace', 'user', 'certificado').exclude(status=FirmadorDocumento.Estado.ELIMINADO)
        if user.is_superuser or getattr(user, 'rol', '') == 'SUPER_ADMIN':
            return qs
        return qs.filter(workspace__owner_user=user)

    @action(detail=True, methods=['get'], url_path='descargar')
    def descargar(self, request, pk=None):
        documento = self.get_object()
        if not documento.signed_file:
            raise Http404
        return FileResponse(
            documento.signed_file.open('rb'),
            as_attachment=True,
            filename=documento.signed_file_name or 'documento-firmado.pdf',
            content_type='application/pdf',
        )

    def destroy(self, request, *args, **kwargs):
        documento = self.get_object()
        if documento.original_file:
            documento.original_file.delete(save=False)
        if documento.signed_file:
            documento.signed_file.delete(save=False)
        documento.status = FirmadorDocumento.Estado.ELIMINADO
        documento.deleted_at = timezone.now()
        documento.keep_file = False
        documento.stored_bytes = 0
        documento.save(update_fields=['status', 'deleted_at', 'keep_file', 'stored_bytes', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class FirmadorCertificadoViewSet(viewsets.ModelViewSet):
    serializer_class = FirmadorCertificadoSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        workspace = get_or_create_workspace(self.request.user)
        return FirmadorCertificado.objects.filter(workspace=workspace, active=True)

    def create(self, request, *args, **kwargs):
        workspace = get_or_create_workspace(request.user)
        cert_file = request.FILES.get('certificate')
        password = request.data.get('certificate_password', '')
        alias = (request.data.get('alias') or '').strip()

        if not cert_file:
            return Response({'certificate': 'Este campo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'certificate_password': 'Ingresa la clave del certificado.'}, status=status.HTTP_400_BAD_REQUEST)
        if workspace.certificados.filter(active=True).count() >= 2:
            return Response({'detail': 'Puedes almacenar hasta 2 certificados digitales.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_certificate_upload(cert_file)
            content = cert_file.read()
            info = parse_and_encrypt_certificate(content, password)
        except DjangoValidationError as exc:
            return Response({'detail': exc.messages[0] if hasattr(exc, 'messages') else str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if info.expires_at <= timezone.now():
            return Response({'detail': 'El certificado esta vencido.'}, status=status.HTTP_400_BAD_REQUEST)

        if FirmadorCertificado.objects.filter(workspace=workspace, fingerprint=info.fingerprint, active=True).exists():
            return Response({'detail': 'Este certificado ya fue cargado.'}, status=status.HTTP_400_BAD_REQUEST)

        certificado = FirmadorCertificado.objects.create(
            workspace=workspace,
            user=request.user,
            alias=alias or getattr(cert_file, 'name', '') or 'Certificado digital',
            original_file_name=getattr(cert_file, 'name', '') or 'certificado.p12',
            encrypted_content=info.encrypted_content,
            file_size=len(content),
            fingerprint=info.fingerprint,
            subject=info.subject,
            issuer=info.issuer,
            expires_at=info.expires_at,
        )
        return Response(self.get_serializer(certificado).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        certificado = self.get_object()
        certificado.active = False
        certificado.save(update_fields=['active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def perfil_firmador(request):
    workspace = get_or_create_workspace(request.user)
    return Response(FirmadorWorkspaceSerializer(workspace).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def firmar_documento(request):
    workspace = get_or_create_workspace(request.user)
    pdf_file = request.FILES.get('pdf')
    cert_file = request.FILES.get('certificate')
    certificate_id = request.data.get('certificate_id')
    password = request.data.get('certificate_password', '')
    keep_file = str(request.data.get('keep_file', 'false')).lower() in ('true', '1', 'yes', 'on')
    visible_signature = str(request.data.get('visible_signature', 'false')).lower() in ('true', '1', 'yes', 'on')
    signature_type = (request.data.get('signature_type') or FirmadorDocumento.TipoFirma.AVANZADA).strip().upper()
    signature_type_aliases = {
        'ADVANCED': FirmadorDocumento.TipoFirma.AVANZADA,
        'AVANZADO': FirmadorDocumento.TipoFirma.AVANZADA,
        'VISIBLE': FirmadorDocumento.TipoFirma.AVANZADA,
        'QRCODE': FirmadorDocumento.TipoFirma.QR,
        'CODIGO_QR': FirmadorDocumento.TipoFirma.QR,
        'CODIGO QR': FirmadorDocumento.TipoFirma.QR,
    }
    signature_type = signature_type_aliases.get(signature_type, signature_type)
    if signature_type not in FirmadorDocumento.TipoFirma.values:
        signature_type = FirmadorDocumento.TipoFirma.AVANZADA
    if signature_type == FirmadorDocumento.TipoFirma.SIMPLE:
        visible_signature = False
    signature_page = max(_int_param(request.data, 'signature_page', 1), 1)
    signature_x = max(0, min(95, _float_param(request.data, 'signature_x', 6)))
    signature_y = max(0, min(95, _float_param(request.data, 'signature_y', 72)))
    signature_width = max(8, min(95, _float_param(request.data, 'signature_width', 36)))
    signature_height = max(6, min(50, _float_param(request.data, 'signature_height', 10)))
    reason = request.data.get('reason', 'Firmado electrónicamente')
    location = request.data.get('location', 'Ecuador')
    retention_days = int(request.data.get('retention_days') or workspace.default_retention_days)
    retention_days = min(max(retention_days, 1), workspace.max_retention_days)

    if not pdf_file:
        return Response({'pdf': 'Este campo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
    certificado = None
    if certificate_id:
        certificado = FirmadorCertificado.objects.filter(id=certificate_id, workspace=workspace, active=True).first()
        if not certificado:
            return Response({'certificate_id': 'El certificado seleccionado no existe.'}, status=status.HTTP_400_BAD_REQUEST)
        if certificado.expires_at <= timezone.now():
            return Response({'certificate_id': 'El certificado seleccionado esta vencido.'}, status=status.HTTP_400_BAD_REQUEST)

        cert_file = ContentFile(decrypt_certificate(bytes(certificado.encrypted_content)), name=certificado.original_file_name)

    if not cert_file:
        return Response({'certificate': 'Este campo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'certificate_password': 'Ingresa la clave del certificado.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_pdf_upload(pdf_file, workspace.max_file_size_bytes)
        validate_certificate_upload(cert_file)
    except DjangoValidationError as exc:
        return Response({'detail': exc.messages[0] if hasattr(exc, 'messages') else str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if workspace.monthly_signatures_used() >= workspace.monthly_signature_limit:
        return Response({'detail': 'Alcanzaste el límite mensual de documentos firmados.'}, status=status.HTTP_402_PAYMENT_REQUIRED)

    estimated_signed_size = pdf_file.size * 2
    projected_storage = workspace.active_storage_bytes() + (estimated_signed_size if keep_file else 0)
    if keep_file and projected_storage > workspace.max_storage_bytes:
        return Response({'detail': 'No tienes espacio suficiente para guardar este documento. Actualiza tu plan o descarga sin guardar.'}, status=status.HTTP_402_PAYMENT_REQUIRED)

    documento = FirmadorDocumento.objects.create(
        workspace=workspace,
        user=request.user,
        certificado=certificado,
        original_file_name=getattr(pdf_file, 'name', '') or 'documento.pdf',
        original_size=pdf_file.size,
        keep_file=keep_file,
        retention_days=retention_days if keep_file else 0,
        expires_at=timezone.now() + timedelta(days=retention_days) if keep_file else None,
        certificado_origen=FirmadorDocumento.CertificadoOrigen.GUARDADO if certificado else FirmadorDocumento.CertificadoOrigen.TEMPORAL,
        signature_type=signature_type,
        signature_page=signature_page,
        signature_x=round(signature_x),
        signature_y=round(signature_y),
        signature_width=round(signature_width),
        signature_height=round(signature_height),
        reason=reason,
        location=location,
        visible_signature=visible_signature,
    )

    try:
        result = sign_pdf_with_pkcs12(
            pdf_file=pdf_file,
            certificate_file=cert_file,
            certificate_password=password,
            reason=reason,
            location=location,
            visible_signature=visible_signature,
            signature_page=signature_page,
            signature_box=_signature_box_from_percent(pdf_file, signature_page, signature_x, signature_y, signature_width, signature_height) if visible_signature else None,
            signature_type=signature_type,
            qr_url=f"{(getattr(settings, 'PUBLIC_BASE_URL', '') or 'https://firmador.of1solutions.com').rstrip('/')}/firmador/validar?documento={documento.id}",
        )
        documento.original_hash = result.original_hash
        documento.signed_hash = result.signed_hash
        documento.signed_file_name = result.signed_file_name
        documento.signed_size = len(result.content)
        if keep_file and workspace.active_storage_bytes() + documento.original_size + documento.signed_size > workspace.max_storage_bytes:
            documento.status = FirmadorDocumento.Estado.ERROR
            documento.error_message = 'No tienes espacio suficiente para guardar este documento.'
            documento.save(update_fields=['original_hash', 'signed_hash', 'signed_file_name', 'signed_size', 'status', 'error_message', 'updated_at'])
            return Response(
                {'detail': 'No tienes espacio suficiente para guardar este documento. Actualiza tu plan o descarga sin guardar.'},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        if keep_file:
            pdf_file.seek(0)
            documento.original_file.save(documento.original_file_name, pdf_file, save=False)
            documento.signed_file.save(result.signed_file_name, ContentFile(result.content), save=False)
            documento.stored_bytes = documento.original_size + documento.signed_size
        documento.status = FirmadorDocumento.Estado.FIRMADO
        documento.save()
    except Exception as exc:
        logger.exception('Error firmando PDF. workspace_id=%s documento_id=%s', workspace.id, documento.id)
        documento.status = FirmadorDocumento.Estado.ERROR
        if isinstance(exc, DjangoValidationError):
            message = exc.messages[0] if hasattr(exc, 'messages') else str(exc)
        else:
            message = str(exc)
        documento.error_message = message
        documento.save(update_fields=['status', 'error_message', 'updated_at'])
        return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)

    response = HttpResponse(result.content, content_type='application/pdf')
    response['Content-Disposition'] = content_disposition_header(True, result.signed_file_name)
    response['X-Firmador-Document-Id'] = str(documento.id)
    response['X-Firmador-Keep-File'] = 'true' if keep_file else 'false'
    return response
