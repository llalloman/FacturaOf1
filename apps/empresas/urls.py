from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, serializers, filters
from rest_framework.permissions import IsAuthenticated
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
    permission_classes = [IsSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ruc', 'razon_social', 'nombre_comercial', 'email']
    ordering_fields = ['razon_social', 'ruc', 'fecha_creacion']


router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')

urlpatterns = [
    path('', include(router.urls)),
]
