from rest_framework import permissions


class IsAuthenticated(permissions.IsAuthenticated):
    """
    Permiso básico de autenticación
    """
    pass


class IsTenantUser(permissions.BasePermission):
    """
    Verifica que el usuario pertenece a una empresa (tenant).
    SUPER_ADMIN siempre tiene acceso (no está atado a ninguna empresa).
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Super admin no requiere empresa
        if getattr(request.user, 'rol', None) == 'SUPER_ADMIN':
            return True
        return (
            hasattr(request.user, 'empresa') and
            request.user.empresa is not None
        )
