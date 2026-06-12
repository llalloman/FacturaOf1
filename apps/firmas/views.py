from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
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
    SolicitudDemoERPSerializer,
    SolicitudFirmaElectronicaPublicSerializer,
    SolicitudFirmaElectronicaSerializer,
)


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
    search_fields = ['first_name', 'last_name', 'identification', 'ruc', 'business_name', 'email', 'phone']
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
        return FileResponse(documento.file.open('rb'), as_attachment=True, filename=documento.file_name)


@api_view(['POST'])
@permission_classes([AllowAny])
def crear_solicitud_publica(request):
    serializer = SolicitudFirmaElectronicaPublicSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    solicitud = serializer.save()
    return Response(
        {
            'id': solicitud.id,
            'mensaje': 'Hemos recibido tu solicitud. Un asesor de OF1 Solutions se comunicará contigo para continuar el proceso.',
        },
        status=status.HTTP_201_CREATED,
    )


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
