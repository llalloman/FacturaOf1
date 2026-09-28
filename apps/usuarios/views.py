"""
Views para el módulo de usuarios
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

from .models import EmpresaMembresia, Usuario
from .serializers import (
    CustomTokenObtainPairSerializer,
    UsuarioSerializer,
    UsuarioCreateSerializer,
    CambiarPasswordSerializer,
    EmpresaMembresiaSerializer,
)
from .permissions import IsSuperAdmin, IsAdminEmpresa
from apps.core.permissions import HasModuleAccess, is_global_platform_user, is_platform_user
from apps.core.tenant import active_empresa

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Vista personalizada para obtener tokens JWT"""
    serializer_class = CustomTokenObtainPairSerializer


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar usuarios
    - Super Admin: puede ver y gestionar todos los usuarios
    - Admin Empresa: puede ver y gestionar usuarios de su empresa
    """
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated]
    module_required = 'usuarios'

    def get_permissions(self):
        if self.action in ('me', 'cambiar_password'):
            return [IsAuthenticated()]
        if self.action == 'membresias':
            return [IsAdminEmpresa(), HasModuleAccess()]
        if self.action in ('activar', 'desactivar', 'reset_password'):
            return [IsAdminEmpresa(), HasModuleAccess()]
        return [permission() for permission in (IsAuthenticated, HasModuleAccess)]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UsuarioCreateSerializer
        return UsuarioSerializer
    
    def get_queryset(self):
        """Filtrar usuarios según el rol del usuario autenticado"""
        user = self.request.user
        
        if is_platform_user(user, 'usuarios') and not getattr(self.request, 'tenant', None):
            # Solo el alcance global puede ver el consolidado sin contexto.
            if is_global_platform_user(user):
                return Usuario.objects.all()
            return Usuario.objects.none()
        empresa = active_empresa(self.request)
        membership = EmpresaMembresia.objects.filter(
            usuario=user, empresa=empresa, activa=True,
        ).first() if empresa else None
        if (membership and membership.rol_empresa == 'ADMIN_EMPRESA') or (user.es_admin_empresa and empresa):
            # Admin de empresa solo ve usuarios de su empresa
            return Usuario.objects.filter(empresa=empresa)
        else:
            # Otros usuarios solo se ven a sí mismos
            return Usuario.objects.filter(id=user.id)
    
    def perform_create(self, serializer):
        """Asignar empresa automáticamente si no es super admin"""
        user = self.request.user
        
        empresa = active_empresa(self.request)
        if getattr(self.request, 'tenant', None) and empresa:
            usuario = serializer.save(empresa=empresa)
        elif not is_platform_user(user, 'usuarios') and empresa:
            # Si no es super admin, asignar su propia empresa
            usuario = serializer.save(empresa=empresa)
        else:
            usuario = serializer.save()

        if usuario.empresa_id and not usuario.es_super_admin:
            EmpresaMembresia.objects.get_or_create(
                usuario=usuario,
                empresa_id=usuario.empresa_id,
                defaults={
                    'rol_empresa': usuario.rol,
                    'predeterminada': True,
                    'creada_por': user,
                    'metadatos': {'origen': 'creacion_usuario_legacy_compatible'},
                },
            )
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Obtener información del usuario autenticado"""
        serializer = self.get_serializer(request.user)
        data = dict(serializer.data)
        data['empresa_contexto_id'] = getattr(getattr(request, 'tenant', None), 'id', None)
        data['membresias'] = EmpresaMembresiaSerializer(
            EmpresaMembresia.objects.filter(
                usuario=request.user,
                activa=True,
                empresa__activa=True,
            ).select_related('empresa'),
            many=True,
        ).data
        return Response(data)

    @action(detail=False, methods=['get', 'post'], url_path='contextos')
    def contextos(self, request):
        """Lista o valida el contexto de empresa del usuario autenticado."""
        if request.method == 'GET':
            membresias = EmpresaMembresia.objects.filter(
                usuario=request.user,
                activa=True,
                empresa__activa=True,
            ).select_related('empresa')
            data = list(EmpresaMembresiaSerializer(membresias, many=True).data)

            # Compatibilidad con usuarios existentes que aún solo tienen empresa_id.
            if request.user.empresa_id and not any(
                item['empresa'] == request.user.empresa_id for item in data
            ):
                empresa = request.user.empresa
                if empresa and empresa.activa:
                    data.insert(0, {
                        'id': None,
                        'empresa': empresa.id,
                        'empresa_nombre': empresa.razon_social,
                        'empresa_activa': empresa.activa,
                        'rol_empresa': request.user.rol,
                        'modulos': [],
                        'activa': True,
                        'predeterminada': True,
                        'metadatos': {'origen': 'legacy_usuario_empresa'},
                    })
            return Response(data)

        empresa_id = request.data.get('empresa_id')
        if not empresa_id:
            return Response(
                {'empresa_id': 'Este campo es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.empresas.models import Empresa
        empresa = Empresa.objects.filter(pk=empresa_id, activa=True).first()
        if not empresa:
            return Response(
                {'empresa_id': 'La empresa no existe o está inactiva.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = EmpresaMembresia.objects.filter(
            usuario=request.user, empresa=empresa, activa=True,
        ).first()
        legacy_access = request.user.empresa_id == empresa.id
        if not is_platform_user(request.user, 'empresas') and not membership and not legacy_access:
            return Response(
                {'detail': 'El usuario no tiene una membresía activa para esta empresa.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # JWT es stateless: el cliente debe enviar este contexto en X-Empresa-ID.
        from apps.core.audit import audit_event
        audit_event(
            empresa=empresa,
            usuario=request.user,
            accion='SELECCIONAR_CONTEXTO_EMPRESA',
            modulo='multiempresa',
            referencia=str(empresa.id),
            datos={
                'empresa_id': empresa.id,
                'origen': 'usuarios.contextos',
                'rol_empresa': membership.rol_empresa if membership else request.user.rol,
            },
        )
        return Response({
            'empresa_id': empresa.id,
            'empresa_nombre': empresa.razon_social,
            'rol_empresa': membership.rol_empresa if membership else request.user.rol,
            'header_requerido': 'X-Empresa-ID',
        })

    @action(detail=False, methods=['get', 'post'], url_path='membresias')
    def membresias(self, request):
        """Administra accesos empresa-usuario dentro del alcance permitido."""
        user = request.user
        if is_platform_user(user, 'usuarios') and not getattr(request, 'tenant', None):
            queryset = (
                EmpresaMembresia.objects.all()
                if is_global_platform_user(user)
                else EmpresaMembresia.objects.none()
            )
        elif active_empresa(request):
            queryset = EmpresaMembresia.objects.filter(empresa=active_empresa(request))
        else:
            queryset = EmpresaMembresia.objects.none()

        if request.method == 'GET':
            return Response(EmpresaMembresiaSerializer(
                queryset.select_related('usuario', 'empresa'), many=True,
            ).data)

        serializer = EmpresaMembresiaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        empresa = serializer.validated_data['empresa']
        usuario = serializer.validated_data['usuario']
        if getattr(request, 'tenant', None) and empresa.id != request.tenant.id:
            return Response(
                {'empresa': 'La membresía no coincide con la empresa activa.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not is_platform_user(user, 'usuarios') and empresa.id != getattr(active_empresa(request), 'id', None):
            return Response(
                {'empresa': 'No puedes crear membresías fuera de tu empresa.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not usuario.is_active:
            return Response(
                {'usuario': 'El usuario está inactivo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        membership = serializer.save(creada_por=user)
        return Response(
            EmpresaMembresiaSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'])
    def cambiar_password(self, request):
        """Cambiar contraseña del usuario autenticado"""
        serializer = CambiarPasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        # Cambiar la contraseña
        request.user.set_password(serializer.validated_data['password_nueva'])
        request.user.save()
        
        return Response({
            'message': 'Contraseña cambiada exitosamente.'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """Activar un usuario"""
        usuario = self.get_object()
        usuario.is_active = True
        usuario.save()
        return Response({
            'message': f'Usuario {usuario.email} activado exitosamente.'
        })
    
    @action(detail=True, methods=['post'])
    def desactivar(self, request, pk=None):
        """Desactivar un usuario"""
        usuario = self.get_object()
        
        if usuario.es_super_admin:
            return Response({
                'error': 'No se puede desactivar un super administrador.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        usuario.is_active = False
        usuario.save()
        return Response({
            'message': f'Usuario {usuario.email} desactivado exitosamente.'
        })

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Resetear contraseña de un usuario (solo admins)"""
        usuario = self.get_object()
        password = request.data.get('password')
        if not password or len(password) < 8:
            return Response(
                {'error': 'La contraseña debe tener al menos 8 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        usuario.set_password(password)
        usuario.save()
        return Response({'message': f'Contraseña de {usuario.email} reseteada exitosamente.'})
