from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Producto
from .serializers import ProductoSerializer
from apps.core.export_mixin import ExportMixin


class ProductoViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Devolver todos los productos sin paginar
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'aplica_iva', 'activo', 'maneja_inventario']
    search_fields = ['codigo_principal', 'codigo_auxiliar', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'precio', 'codigo_principal']
    ordering = ['nombre']
    export_filename = 'productos'
    export_fields = [
        ('codigo_principal', 'Código'),
        ('nombre', 'Nombre'),
        ('tipo', 'Tipo'),
        ('precio', 'Precio'),
        ('aplica_iva', 'Aplica IVA'),
        ('porcentaje_iva', 'Tarifa IVA %'),
        ('maneja_inventario', 'Maneja Inventario'),
        ('activo', 'Activo'),
    ]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'empresa') and user.empresa:
            return Producto.objects.filter(empresa=user.empresa)
        return Producto.objects.none()

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


router = DefaultRouter()
router.register(r'productos', ProductoViewSet, basename='producto')

urlpatterns = [
    path('', include(router.urls)),
]
