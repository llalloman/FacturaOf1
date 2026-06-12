"""
Views para el módulo de usuarios
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

from .models import Usuario
from .serializers import (
    CustomTokenObtainPairSerializer,
    UsuarioSerializer,
    UsuarioCreateSerializer,
    CambiarPasswordSerializer
)
from .permissions import IsSuperAdmin, IsAdminEmpresa
from apps.core.permissions import HasModuleAccess

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
        
        if user.es_super_admin:
            # Super admin ve todos los usuarios
            return Usuario.objects.all()
        elif user.es_admin_empresa and user.empresa:
            # Admin de empresa solo ve usuarios de su empresa
            return Usuario.objects.filter(empresa=user.empresa)
        else:
            # Otros usuarios solo se ven a sí mismos
            return Usuario.objects.filter(id=user.id)
    
    def perform_create(self, serializer):
        """Asignar empresa automáticamente si no es super admin"""
        user = self.request.user
        
        if not user.es_super_admin and user.empresa:
            # Si no es super admin, asignar su propia empresa
            serializer.save(empresa=user.empresa)
        else:
            serializer.save()
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Obtener información del usuario autenticado"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
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
