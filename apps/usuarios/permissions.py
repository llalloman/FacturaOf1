"""
Permissions personalizados para el módulo de usuarios
"""
from rest_framework import permissions
from apps.core.permissions import is_platform_user


class IsSuperAdmin(permissions.BasePermission):
    """
    Permiso personalizado para verificar si el usuario es Super Admin
    """
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            is_platform_user(request.user, 'usuarios')
        )


class IsAdminEmpresa(permissions.BasePermission):
    """
    Permiso personalizado para verificar si el usuario es Admin de Empresa o Super Admin
    """
    
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_platform_user(user, 'usuarios') or user.es_admin_empresa:
            return True
        empresa = getattr(request, 'tenant', None) or getattr(user, 'empresa', None)
        return bool(
            empresa and user.membresias.filter(
                empresa=empresa, activa=True, rol_empresa='ADMIN_EMPRESA'
            ).exists()
        )


class PuedeFacturar(permissions.BasePermission):
    """
    Permiso personalizado para verificar si el usuario puede facturar
    """
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.puede_facturar
        )
