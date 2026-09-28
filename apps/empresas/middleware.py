"""
Middleware Multi-Tenant para manejar el contexto de empresa
"""
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from django.utils import timezone

# Rutas que no requieren validación de suscripción
_RUTAS_LIBRES = [
    '/admin/',
    '/api/auth/',
    '/api/suscripciones/',
    '/api/empresas/',
    '/api/usuarios/me/',
    '/api/health/',
    '/api/automation/',
]


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware para manejar el contexto de empresa (tenant) en cada request.
    También bloquea el acceso si la suscripción de la empresa ha expirado.
    """

    def process_request(self, request):
        request.tenant = None
        request.active_membership = None
        request.tenant_context_error = False

        if hasattr(request, 'user') and request.user.is_authenticated:
            from apps.core.permissions import is_platform_user
            # La empresa legacy sigue siendo fallback para usuarios
            # operativos. Las identidades de plataforma deben seleccionar
            # explícitamente un tenant; sin selección permanecen globales o
            # sin alcance según su rol.
            if (
                not is_platform_user(request.user)
                and hasattr(request.user, 'empresa')
                and request.user.empresa
            ):
                request.tenant = request.user.empresa

        empresa_id = request.headers.get('X-Empresa-ID')
        if empresa_id and hasattr(request, 'user') and request.user.is_authenticated:
            from apps.empresas.models import Empresa
            from apps.core.permissions import is_platform_user
            empresa_id = str(empresa_id).strip()
            if not empresa_id.isdigit():
                request.tenant_context_error = True
            elif is_platform_user(request.user, 'empresas'):
                try:
                    request.tenant = Empresa.objects.get(id=empresa_id, activa=True)
                except Empresa.DoesNotExist:
                    request.tenant_context_error = True
            else:
                from apps.usuarios.models import EmpresaMembresia
                request.tenant = Empresa.objects.filter(
                    id=empresa_id,
                    activa=True,
                    membresias__usuario=request.user,
                    membresias__activa=True,
                ).first()
                # Fallback temporal para usuarios aún no migrados a membresías.
                if not request.tenant and str(request.user.empresa_id) == str(empresa_id):
                    request.tenant = request.user.empresa
                if not request.tenant:
                    request.tenant_context_error = True

        if request.tenant and hasattr(request, 'user') and request.user.is_authenticated:
            from apps.usuarios.models import EmpresaMembresia
            request.active_membership = EmpresaMembresia.objects.filter(
                usuario=request.user,
                empresa=request.tenant,
                activa=True,
            ).select_related('empresa').first()

        return None

    def process_view(self, request, view_func, view_args, view_kwargs):
        # Rutas que nunca requieren tenant ni suscripción
        for ruta in _RUTAS_LIBRES:
            if request.path.startswith(ruta):
                return None

        if not request.path.startswith('/api/'):
            return None

        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return None

        if request.tenant_context_error:
            return JsonResponse({
                'error': 'empresa_no_autorizada',
                'mensaje': 'El usuario no tiene acceso a la empresa solicitada.',
            }, status=403)

        # Super admins pasan siempre
        from apps.core.permissions import is_platform_user
        if is_platform_user(request.user):
            return None

        # ── Validar suscripción activa ────────────────────────────────────────
        empresa = getattr(request, 'tenant', None)
        if empresa:
            from apps.suscripciones.models import Suscripcion
            now = timezone.now()
            suscripcion = (
                Suscripcion.objects
                .filter(empresa=empresa)
                .exclude(estado__in=['CANCELADA'])
                .order_by('-fecha_inicio')
                .first()
            )

            if not suscripcion:
                return JsonResponse({
                    'error': 'sin_suscripcion',
                    'mensaje': 'No tienes una suscripción activa. Contacta al administrador.',
                }, status=403)

            # Verificar si venció (incluye PRUEBA vencida)
            if suscripcion.fecha_fin <= now and suscripcion.estado not in ['ACTIVA']:
                return JsonResponse({
                    'error': 'suscripcion_vencida',
                    'mensaje': f'Tu suscripción venció el {suscripcion.fecha_fin.strftime("%d/%m/%Y")}. Renueva para continuar.',
                    'fecha_fin': suscripcion.fecha_fin.isoformat(),
                }, status=403)

            if suscripcion.estado in ['SUSPENDIDA', 'VENCIDA']:
                return JsonResponse({
                    'error': 'suscripcion_inactiva',
                    'mensaje': f'Tu suscripción está {suscripcion.estado.lower()}. Contacta al administrador.',
                }, status=403)

        # ── Validar email verificado ──────────────────────────────────────────
        if not request.user.email_verificado:
            return JsonResponse({
                'error': 'email_no_verificado',
                'mensaje': 'Debes verificar tu email antes de continuar.',
            }, status=403)

        # Validación de onboarding fiscal eliminada del middleware global.
        # Ahora la validación de readiness fiscal debe hacerse solo en endpoints de facturación.

        return None

