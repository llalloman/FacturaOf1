from rest_framework import permissions


def is_platform_user(user, capability=None):
    """Compatibilidad global + acceso explícito de OF1 Solutions."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
        return True
    accesses = getattr(user, 'accesos_plataforma', None)
    if accesses is None:
        return False
    access_list = accesses.filter(activa=True)
    if not access_list.exists():
        return False
    if capability is None:
        return True
    for access in access_list:
        if access.rol == 'ADMIN_GLOBAL' or capability in (access.alcances or []):
            return True
    return False


def is_global_platform_user(user):
    """Indica si el usuario puede operar sin seleccionar una empresa."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
        return True
    accesses = getattr(user, 'accesos_plataforma', None)
    return bool(
        accesses is not None
        and accesses.filter(activa=True, rol='ADMIN_GLOBAL').exists()
    )


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
        if is_platform_user(request.user):
            return True
        return (
            getattr(request, 'tenant', None) is not None
            or (
                hasattr(request.user, 'empresa')
                and request.user.empresa is not None
            )
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


def user_has_module_access(user, modules, empresa=None):
    if isinstance(modules, str):
        required_modules = {modules}
    else:
        required_modules = set(modules or [])

    if not required_modules:
        return True

    if not user or not user.is_authenticated:
        return False

    # Solo el administrador global (o una capacidad explícita) puede saltar
    # el catálogo de módulos de la empresa; un auditor de plataforma no debe
    # heredar acceso operativo por el mero hecho de existir como usuario de
    # OF1 Solutions.
    if is_platform_user(user, 'modules'):
        return True

    empresa = empresa or getattr(user, 'empresa', None)
    if not empresa:
        return False

    # La membresía es el alcance explícito para el contexto activo. Un listado
    # no vacío limita el acceso aunque la suscripción de la empresa incluya más
    # módulos. Si está vacío, conservamos el comportamiento legacy de usuarios
    # existentes que todavía no tienen módulos migrados.
    membership = getattr(user, 'membresias', None)
    if membership is not None:
        membership = membership.filter(empresa=empresa, activa=True).first()
    scoped_modules = set((membership.modulos or []) if membership else [])
    if scoped_modules:
        return bool(required_modules & scoped_modules)

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

        return user_has_module_access(
            request.user,
            required,
            getattr(request, 'tenant', None),
        )

    @staticmethod
    def _object_empresa_id(obj):
        """Obtiene el tenant de agregados directos y relaciones operativas."""
        direct = getattr(obj, 'empresa_id', None)
        if direct is not None:
            return direct

        company = getattr(obj, 'company_id', None)
        if company is not None:
            return company

        for relation_name in (
            'comprobante', 'cuenta', 'bodega', 'caja', 'pedido', 'rol',
            'establecimiento', 'cuenta_por_pagar', 'orden_compra',
            'venta', 'factura', 'cotizacion',
        ):
            try:
                relation = getattr(obj, relation_name, None)
            except Exception:
                # Relaciones one-to-one inversas pueden lanzar
                # RelatedObjectDoesNotExist cuando aún no existen.
                continue
            if relation is None:
                continue
            relation_empresa_id = getattr(relation, 'empresa_id', None)
            if relation_empresa_id is not None:
                return relation_empresa_id
            relation_company_id = getattr(relation, 'company_id', None)
            if relation_company_id is not None:
                return relation_company_id
            nested = getattr(relation, 'empresa', None)
            nested_id = getattr(nested, 'id', None)
            if nested_id is not None:
                return nested_id
        return None

    def has_object_permission(self, request, view, obj):
        # Sin contexto, las plataformas globales conservan su lectura
        # consolidada. Con una empresa seleccionada, ningún objeto de otra
        # empresa puede ser recuperado ni mutado por este permiso.
        from apps.core.tenant import active_empresa

        empresa = active_empresa(request)
        if not empresa:
            return True
        object_empresa_id = self._object_empresa_id(obj)
        return object_empresa_id is None or object_empresa_id == empresa.id


class IsCompanyAdminOrPlatform(permissions.BasePermission):
    """Permite operaciones administrativas en el contexto activo."""

    message = 'Se requiere administración de la empresa activa.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_platform_user(user, 'empresa_admin'):
            return True

        empresa = getattr(request, 'tenant', None) or getattr(user, 'empresa', None)
        if not empresa:
            return False
        membership = getattr(user, 'membresias', None)
        if membership is not None:
            scoped = membership.filter(empresa=empresa, activa=True).first()
            if scoped:
                return scoped.rol_empresa == 'ADMIN_EMPRESA'
        return getattr(user, 'rol', None) == 'ADMIN_EMPRESA' and user.empresa_id == empresa.id
