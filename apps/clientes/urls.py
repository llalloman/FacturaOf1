from django.urls import path, include
from rest_framework import viewsets, permissions, filters
from rest_framework.routers import DefaultRouter
from django_filters.rest_framework import DjangoFilterBackend
from .models import Cliente
from .serializers import ClienteSerializer
from apps.core.export_mixin import ExportMixin


class ClienteViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [permissions.IsAuthenticated]
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


router = DefaultRouter()
router.register(r'', ClienteViewSet, basename='cliente')

urlpatterns = [
    path('', include(router.urls)),
]
