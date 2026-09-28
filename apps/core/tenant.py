"""Helpers for resolving the active company without breaking legacy users."""


def active_empresa(request):
    """Return the request tenant, falling back to the legacy user company."""
    if not request:
        return None
    tenant = getattr(request, 'tenant', None)
    if tenant:
        return tenant
    user = getattr(request, 'user', None)
    # DRF/JWT autentica dentro de la vista, despues del middleware Django.
    # Resolvemos aqui el encabezado para que el contexto seleccionado por un
    # administrador de plataforma tambien aplique a las vistas API.
    if user and user.is_authenticated:
        empresa_id = str(request.headers.get('X-Empresa-ID', '') or '').strip()
        if empresa_id.isdigit():
            from apps.empresas.models import Empresa
            from apps.core.permissions import is_platform_user
            if is_platform_user(user, 'empresas'):
                tenant = Empresa.objects.filter(id=int(empresa_id), activa=True).first()
            else:
                tenant = Empresa.objects.filter(
                    id=int(empresa_id), activa=True,
                    membresias__usuario=user, membresias__activa=True,
                ).first()
                if not tenant and str(getattr(user, 'empresa_id', '')) == empresa_id:
                    tenant = getattr(user, 'empresa', None)
            if tenant:
                request.tenant = tenant
                return tenant
    from apps.core.permissions import is_platform_user
    if is_platform_user(user):
        return None
    return getattr(user, 'empresa', None)


def tenant_queryset(request, queryset, field='empresa'):
    """Aplica el contexto activo sin convertir un administrador global en un tenant nulo.

    Un usuario de plataforma sin `X-Empresa-ID` puede consultar el consolidado;
    cualquier otro usuario queda limitado a su empresa activa. Las operaciones
    de escritura siguen debiendo exigir `active_empresa(request)` explícito.
    """
    empresa = active_empresa(request)
    if empresa:
        return queryset.filter(**{field: empresa})

    user = getattr(request, 'user', None)
    from apps.core.permissions import is_global_platform_user, is_platform_user
    # Solo el administrador global/legacy puede omitir el tenant. Un auditor
    # o soporte con alcance limitado debe seleccionar una empresa explícita.
    if is_global_platform_user(user):
        return queryset
    accesses = getattr(user, 'accesos_plataforma', None)
    if accesses is not None:
        if accesses.filter(activa=True, rol='ADMIN_GLOBAL').exists():
            return queryset
        if is_platform_user(user, 'auditoria_global'):
            return queryset
    return queryset.none()


def require_active_empresa(request):
    """Devuelve el tenant activo o lanza un error de validación de dominio."""
    empresa = active_empresa(request)
    if not empresa:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'empresa': 'Seleccione una empresa activa antes de realizar esta operación.'})
    return empresa


class ActiveCompanyWriteMixin:
    """Bloquea actualizaciones y eliminaciones fuera de la empresa activa."""

    tenant_relation = 'empresa'

    def _instance_empresa_id(self, instance):
        current = instance
        if self.tenant_relation != '__self__':
            for segment in self.tenant_relation.split('__'):
                if current is None:
                    return None
                current = getattr(current, segment, None)
        if current is None:
            return None
        direct = getattr(current, 'empresa_id', None)
        if direct is not None:
            return direct
        company = getattr(current, 'company_id', None)
        if company is not None:
            return company
        model_name = getattr(getattr(current, '_meta', None), 'model_name', '')
        if model_name == 'empresa' or current.__class__.__name__ == 'Empresa':
            return getattr(current, 'id', None)
        return None

    def _require_instance_active_empresa(self, instance):
        from rest_framework.exceptions import PermissionDenied

        empresa = require_active_empresa(self.request)
        if self._instance_empresa_id(instance) != empresa.id:
            raise PermissionDenied('El registro no pertenece a la empresa activa.')
        return empresa

    def perform_update(self, serializer):
        self._require_instance_active_empresa(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_instance_active_empresa(instance)
        instance.delete()
