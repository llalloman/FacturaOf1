from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, filters
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models.deletion import ProtectedError
from .models import Producto
from .serializers import ProductoSerializer
from apps.core.export_mixin import ExportMixin
from apps.core.permissions import HasModuleAccess


class ProductoViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'productos'
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

    def _get_empresa_contexto(self):
        empresa = getattr(self.request, 'tenant', None) or getattr(self.request.user, 'empresa', None)
        empresa_id = self.request.headers.get('X-Empresa-ID')
        if not empresa and empresa_id and getattr(self.request.user, 'es_super_admin', False):
            from apps.empresas.models import Empresa
            empresa = Empresa.objects.filter(id=empresa_id).first()
        return empresa

    def get_queryset(self):
        empresa = self._get_empresa_contexto()
        if empresa:
            queryset = Producto.objects.filter(empresa=empresa)
            include_inactive = str(self.request.query_params.get('include_inactive', '')).lower() in ('1', 'true', 'yes')
            if self.action == 'list' and not include_inactive and 'activo' not in self.request.query_params:
                queryset = queryset.filter(activo=True)
            return queryset
        return Producto.objects.none()

    def perform_create(self, serializer):
        empresa = self._get_empresa_contexto()
        if not empresa:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'empresa': 'Selecciona una empresa para crear el producto.'})
        serializer.save(empresa=empresa)

    def destroy(self, request, *args, **kwargs):
        producto = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            if producto.activo:
                producto.activo = False
                producto.save(update_fields=['activo'])
            return Response(
                {
                    'success': True,
                    'soft_deleted': True,
                    'mensaje': 'El producto tiene movimientos o documentos asociados. Se marcó como inactivo para conservar la trazabilidad.',
                },
                status=status.HTTP_200_OK,
            )


router = DefaultRouter()
router.register(r'productos', ProductoViewSet, basename='producto')

urlpatterns = [
    path('', include(router.urls)),
]
