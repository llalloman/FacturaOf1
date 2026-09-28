from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, serializers, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Empresa, Establecimiento, Notificacion, PuntoEmision
from apps.core.permissions import HasModuleAccess, is_global_platform_user, is_platform_user
from apps.core.tenant import ActiveCompanyWriteMixin, active_empresa, tenant_queryset, require_active_empresa


class EmpresaSerializer(serializers.ModelSerializer):
    # Nunca devolver el archivo privado ni la contraseña (aunque esta última
    # esté cifrada en la base). El frontend recibe únicamente el estado.
    certificado_digital = serializers.FileField(write_only=True, required=False, allow_null=True)
    password_certificado = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tiene_certificado = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = [
            'id', 'ruc', 'razon_social', 'nombre_comercial', 'ciudad',
            'tipo_contribuyente', 'contribuyente_especial', 'obligado_contabilidad',
            'gran_contribuyente', 'regimen_rimpe', 'tipo_rimpe',
            'exportador', 'tipo_exportador', 'agente_retencion',
            'direccion_matriz', 'telefono', 'email', 'ambiente',
            'certificado_digital', 'password_certificado', 'fecha_vencimiento_certificado',
            'tiene_certificado',
            'firmado_automatico',
            'establecimiento_codigo', 'punto_emision_codigo',
            'ruc_proveedor_facturacion_electronica',
            'inventario_permite_stock_negativo',
            'logo', 'mensaje_personalizado',
            'activa', 'verificada', 'fecha_creacion',
        ]
        read_only_fields = ['id', 'fecha_creacion']

    def get_tiene_certificado(self, obj):
        return bool(getattr(obj, 'certificado_data', None) or getattr(obj, 'certificado_digital', None))

    def create(self, validated_data):
        password = validated_data.pop('password_certificado', None)
        instance = Empresa(**validated_data)
        if password is not None:
            instance.set_password_certificado(password)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        password = validated_data.pop('password_certificado', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password is not None:
            instance.set_password_certificado(password)
        instance.save()
        return instance


class IsSuperAdmin(IsAuthenticated):
    """Solo usuarios con rol SUPER_ADMIN pueden gestionar empresas"""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return is_platform_user(request.user, 'empresas')


class IsCompanyAdmin(IsAuthenticated):
    """Permite administrar estructura fiscal dentro del alcance de empresa."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if is_platform_user(request.user, 'empresas'):
            return True

        empresa = active_empresa(request)
        if not empresa:
            return False
        membership = getattr(request.user, 'membresias', None)
        if membership is not None:
            scoped = membership.filter(empresa=empresa, activa=True).first()
            if scoped:
                return scoped.rol_empresa == 'ADMIN_EMPRESA'
        # Compatibilidad para usuarios legacy aún sin membresía migrada.
        return (
            getattr(request.user, 'rol', None) == 'ADMIN_EMPRESA'
            and request.user.empresa_id == empresa.id
        )


class EstablecimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Establecimiento
        fields = [
            'id', 'empresa', 'codigo', 'nombre', 'direccion', 'telefono',
            'activo', 'fecha_creacion',
        ]
        read_only_fields = ['id', 'empresa', 'fecha_creacion']

    def validate_codigo(self, value):
        if not value.isdigit() or len(value) != 3:
            raise serializers.ValidationError('El código debe tener exactamente 3 dígitos.')
        return value


class PuntoEmisionSerializer(serializers.ModelSerializer):
    empresa_id = serializers.IntegerField(source='establecimiento.empresa_id', read_only=True)

    class Meta:
        model = PuntoEmision
        fields = [
            'id', 'establecimiento', 'empresa_id', 'codigo', 'nombre', 'activo',
            'fecha_creacion',
        ]
        read_only_fields = ['id', 'empresa_id', 'fecha_creacion']

    def validate_codigo(self, value):
        if not value.isdigit() or len(value) != 3:
            raise serializers.ValidationError('El código debe tener exactamente 3 dígitos.')
        return value


    def validate_establecimiento(self, value):
        empresa = active_empresa(self.context.get('request'))
        if empresa and value.empresa_id != empresa.id:
            raise serializers.ValidationError(
                'El establecimiento no pertenece a la empresa activa.'
            )
        return value


class EmpresaViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    tenant_relation = '__self__'
    queryset = Empresa.objects.all().order_by('-id')
    serializer_class = EmpresaSerializer
    module_required = 'configuracion'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ruc', 'razon_social', 'nombre_comercial', 'email']
    ordering_fields = ['razon_social', 'ruc', 'fecha_creacion']

    def get_permissions(self):
        rol = getattr(self.request.user, 'rol', None)
        # mi_empresa: cualquier usuario autenticado puede acceder a su empresa
        if self.action == 'mi_empresa':
            if self.request.method == 'PATCH':
                return [IsCompanyAdmin(), HasModuleAccess()]
            return [IsAuthenticated()]
        if self.action in ('partial_update', 'update'):
            return [IsCompanyAdmin(), HasModuleAccess()]
        # ADMIN_EMPRESA puede leer y actualizar su propia empresa (controlado en get_queryset)
        if rol == 'ADMIN_EMPRESA' and self.action in ('list', 'retrieve', 'partial_update', 'update'):
            return [IsAuthenticated()]
        return [IsSuperAdmin()]

    def get_queryset(self):
        user = self.request.user
        if is_global_platform_user(user):
            return Empresa.objects.all().order_by('-id')
        # ADMIN_EMPRESA solo ve su propia empresa
        empresa = active_empresa(self.request)
        if empresa:
            return Empresa.objects.filter(pk=empresa.pk)
        return Empresa.objects.none()

    @action(detail=False, methods=['get', 'patch'], url_path='mi_empresa')
    def mi_empresa(self, request):
        """Retorna la empresa del usuario autenticado (para ADMIN_EMPRESA)."""
        empresa = active_empresa(request)
        if not empresa:
            return Response({'error': 'No tienes empresa asignada.'}, status=404)
        if request.method == 'PATCH':
            serializer = self.get_serializer(empresa, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(self.get_serializer(empresa).data)


class EstablecimientoViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    serializer_class = EstablecimientoSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'configuracion'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nombre', 'direccion']
    ordering_fields = ['codigo', 'nombre', 'fecha_creacion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), HasModuleAccess()]
        return [IsCompanyAdmin(), HasModuleAccess()]

    def get_queryset(self):
        return tenant_queryset(
            self.request,
            Establecimiento.objects.select_related('empresa').all(),
        )

    def perform_create(self, serializer):
        serializer.save(empresa=require_active_empresa(self.request))


class PuntoEmisionViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    tenant_relation = 'establecimiento'
    serializer_class = PuntoEmisionSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'configuracion'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nombre']
    ordering_fields = ['codigo', 'nombre', 'fecha_creacion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), HasModuleAccess()]
        return [IsCompanyAdmin(), HasModuleAccess()]

    def get_queryset(self):
        return tenant_queryset(
            self.request,
            PuntoEmision.objects.select_related(
                'establecimiento', 'establecimiento__empresa'
            ).all(),
            'establecimiento__empresa',
        )

    def perform_create(self, serializer):
        empresa = require_active_empresa(self.request)
        establecimiento = serializer.validated_data['establecimiento']
        if not empresa or establecimiento.empresa_id != empresa.id:
            raise serializers.ValidationError({
                'establecimiento': 'El establecimiento no pertenece a la empresa activa.'
            })
        serializer.save()


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = ['id', 'tipo', 'titulo', 'mensaje', 'url', 'leida', 'fecha_creacion']
        read_only_fields = ['id', 'tipo', 'titulo', 'mensaje', 'url', 'fecha_creacion']


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Notificaciones en-app del usuario autenticado (filtradas por empresa).
    - GET  /api/empresas/notificaciones/        → lista (máx 50 recientes)
    - POST /api/empresas/notificaciones/{id}/marcar_leida/
    - POST /api/empresas/notificaciones/marcar_todas_leidas/
    """
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]

    def _get_empresa(self):
        return active_empresa(self.request)

    def get_queryset(self):
        empresa = self._get_empresa()
        if not empresa:
            return Notificacion.objects.none()
        return Notificacion.objects.filter(empresa=empresa).order_by('-fecha_creacion')[:50]

    @action(detail=True, methods=['post'])
    def marcar_leida(self, request, pk=None):
        notif = self.get_object()
        notif.leida = True
        notif.save(update_fields=['leida'])
        return Response({'ok': True})

    @action(detail=False, methods=['post'])
    def marcar_todas_leidas(self, request):
        empresa = self._get_empresa()
        if not empresa:
            return Response({'ok': False}, status=status.HTTP_400_BAD_REQUEST)
        Notificacion.objects.filter(empresa=empresa, leida=False).update(leida=True)
        return Response({'ok': True})


router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'establecimientos', EstablecimientoViewSet, basename='establecimiento')
router.register(r'puntos-emision', PuntoEmisionViewSet, basename='punto-emision')
router.register(r'notificaciones', NotificacionViewSet, basename='notificacion')

urlpatterns = [
    path('', include(router.urls)),
]
