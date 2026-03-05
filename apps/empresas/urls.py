from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, serializers, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Empresa


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = [
            'id', 'ruc', 'razon_social', 'nombre_comercial', 'ciudad',
            'tipo_contribuyente', 'contribuyente_especial', 'obligado_contabilidad',
            'gran_contribuyente', 'regimen_rimpe', 'tipo_rimpe',
            'exportador', 'tipo_exportador', 'agente_retencion',
            'direccion_matriz', 'telefono', 'email', 'ambiente',
            'certificado_digital', 'password_certificado', 'fecha_vencimiento_certificado',
            'firmado_automatico',
            'establecimiento_codigo', 'punto_emision_codigo',
            'logo', 'mensaje_personalizado',
            'activa', 'verificada', 'fecha_creacion',
        ]
        read_only_fields = ['id', 'fecha_creacion']


class IsSuperAdmin(IsAuthenticated):
    """Solo usuarios con rol SUPER_ADMIN pueden gestionar empresas"""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return getattr(request.user, 'rol', None) == 'SUPER_ADMIN'


class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all().order_by('-id')
    serializer_class = EmpresaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ruc', 'razon_social', 'nombre_comercial', 'email']
    ordering_fields = ['razon_social', 'ruc', 'fecha_creacion']

    def get_permissions(self):
        rol = getattr(self.request.user, 'rol', None)
        # mi_empresa: cualquier usuario autenticado puede acceder a su empresa
        if self.action == 'mi_empresa':
            return [IsAuthenticated()]
        # ADMIN_EMPRESA puede leer y actualizar su propia empresa (controlado en get_queryset)
        if rol == 'ADMIN_EMPRESA' and self.action in ('list', 'retrieve', 'partial_update', 'update'):
            return [IsAuthenticated()]
        return [IsSuperAdmin()]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'rol', None) == 'SUPER_ADMIN' or user.is_superuser:
            return Empresa.objects.all().order_by('-id')
        # ADMIN_EMPRESA solo ve su propia empresa
        empresa = getattr(user, 'empresa', None)
        if empresa:
            return Empresa.objects.filter(pk=empresa.pk)
        return Empresa.objects.none()

    @action(detail=False, methods=['get', 'patch'], url_path='mi_empresa')
    def mi_empresa(self, request):
        """Retorna la empresa del usuario autenticado (para ADMIN_EMPRESA)."""
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response({'error': 'No tienes empresa asignada.'}, status=404)
        if request.method == 'PATCH':
            serializer = self.get_serializer(empresa, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(self.get_serializer(empresa).data)


router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')

urlpatterns = [
    path('', include(router.urls)),
]
