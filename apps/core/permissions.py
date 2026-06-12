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


def require_module(*modules):
    """
    Decorator for function-based API views.
    Example: @require_module('declaraciones')
    """
    def decorator(view_func):
        view_func.module_required = list(modules)
        return view_func
    return decorator


def user_has_module_access(user, modules):
    if isinstance(modules, str):
        required_modules = {modules}
    else:
        required_modules = set(modules or [])

    if not required_modules:
        return True

    if not user or not user.is_authenticated:
        return False

    if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
        return True

    empresa = getattr(user, 'empresa', None)
    if not empresa:
        return False

    from apps.suscripciones.models import Suscripcion, ModuloPermiso, get_todos_modulos_codigos

    suscripcion = (
        Suscripcion.objects
        .filter(empresa=empresa, estado__in=['ACTIVA', 'PRUEBA'])
        .select_related('plan')
        .order_by('-fecha_inicio')
        .first()
    )
    if not suscripcion:
        return False

    if suscripcion.estado == 'PRUEBA':
        enabled_modules = set(get_todos_modulos_codigos())
    else:
        enabled_modules = set(
            ModuloPermiso.objects
            .filter(plan=suscripcion.plan)
            .values_list('modulo', flat=True)
        )

    return bool(required_modules & enabled_modules)


class HasModuleAccess(permissions.BasePermission):
    """
    Enforces subscription module access at API level.

    A view can declare:
      module_required = 'facturacion'
      module_required = ['ventas', 'pos']  # access if any module is enabled

    Views without module_required are not blocked by this permission, which lets
    us apply it incrementally without breaking auxiliary endpoints.
    """
    message = 'Este módulo no está incluido en tu plan actual.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        required = getattr(view, 'module_required', None)
        if not required:
            return True

        return user_has_module_access(request.user, required)
