"""
Permissions personalizados para el módulo de usuarios
"""
from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """
    Permiso personalizado para verificar si el usuario es Super Admin
    """
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.es_super_admin
        )


class IsAdminEmpresa(permissions.BasePermission):
    """
    Permiso personalizado para verificar si el usuario es Admin de Empresa o Super Admin
    """
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.es_admin_empresa or request.user.es_super_admin)
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
