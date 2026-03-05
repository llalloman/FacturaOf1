from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Producto
from .serializers import ProductoSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'aplica_iva', 'activo', 'maneja_inventario']
    search_fields = ['codigo_principal', 'codigo_auxiliar', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'precio', 'codigo_principal']
    ordering = ['nombre']
    pagination_class = None  # Devuelve todos los productos sin paginar

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'empresa') and user.empresa:
            return Producto.objects.filter(empresa=user.empresa, activo=True)
        return Producto.objects.none()

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


router = DefaultRouter()
router.register(r'productos', ProductoViewSet, basename='producto')

urlpatterns = [
    path('', include(router.urls)),
]
