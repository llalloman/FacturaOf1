from django.urls import path, include
from django.db.models.deletion import ProtectedError
from rest_framework import viewsets, permissions, filters, status
from rest_framework.routers import DefaultRouter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Cliente
from .serializers import ClienteSerializer
from apps.core.export_mixin import ExportMixin
from apps.core.permissions import HasModuleAccess


class ClienteViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [permissions.IsAuthenticated, HasModuleAccess]
    module_required = 'clientes'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo', 'tipo_identificacion']
    search_fields = ['identificacion', 'razon_social', 'nombre_comercial']
    ordering_fields = ['razon_social', 'fecha_creacion']
    ordering = ['razon_social']
    export_filename = 'clientes'
    export_fields = [
        ('tipo_identificacion', 'Tipo ID'),
        ('identificacion', 'Identificación'),
        ('razon_social', 'Razón Social'),
        ('nombre_comercial', 'Nombre Comercial'),
        ('email', 'Email'),
        ('telefono', 'Teléfono'),
        ('direccion', 'Dirección'),
        ('activo', 'Activo'),
    ]

    def get_queryset(self):
        return Cliente.objects.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    def destroy(self, request, *args, **kwargs):
        cliente = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            if cliente.activo:
                cliente.activo = False
                cliente.save(update_fields=['activo', 'fecha_modificacion'])
            return Response(
                {
                    'mensaje': (
                        'El cliente tiene documentos asociados y no puede eliminarse definitivamente. '
                        'Se marcó como inactivo para conservar el historial.'
                    ),
                    'accion': 'desactivado',
                    'id': cliente.id,
                },
                status=status.HTTP_200_OK,
            )


router = DefaultRouter()
router.register(r'', ClienteViewSet, basename='cliente')

urlpatterns = [
    path('', include(router.urls)),
]
