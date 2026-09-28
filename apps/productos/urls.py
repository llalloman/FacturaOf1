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
from apps.core.tenant import ActiveCompanyWriteMixin, require_active_empresa, tenant_queryset


class ProductoViewSet(ActiveCompanyWriteMixin, ExportMixin, viewsets.ModelViewSet):
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'productos'
    pagination_class = None  # Devolver todos los productos sin paginar
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'tipo',
        'aplica_iva',
        'activo',
        'maneja_inventario',
        'controla_caducidad',
        'exige_lote',
    ]
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
        ('controla_caducidad', 'Controla Caducidad'),
        ('exige_lote', 'Exige Lote'),
        ('dias_alerta_caducidad', 'Días Alerta Caducidad'),
        ('activo', 'Activo'),
    ]

    def get_queryset(self):
        queryset = tenant_queryset(self.request, Producto.objects.all())
        include_inactive = str(self.request.query_params.get('include_inactive', '')).lower() in ('1', 'true', 'yes')
        if self.action == 'list' and not include_inactive and 'activo' not in self.request.query_params:
            queryset = queryset.filter(activo=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(empresa=require_active_empresa(self.request))

    def perform_update(self, serializer):
        empresa = require_active_empresa(self.request)
        if serializer.instance.empresa_id != empresa.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('El producto no pertenece a la empresa activa.')
        serializer.save(empresa=empresa)

    def destroy(self, request, *args, **kwargs):
        producto = self.get_object()
        self._require_instance_active_empresa(producto)
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
