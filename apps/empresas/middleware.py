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
]


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware para manejar el contexto de empresa (tenant) en cada request.
    También bloquea el acceso si la suscripción de la empresa ha expirado.
    """

    def process_request(self, request):
        request.tenant = None

        if hasattr(request, 'user') and request.user.is_authenticated:
            if hasattr(request.user, 'empresa') and request.user.empresa:
                request.tenant = request.user.empresa

        empresa_id = request.headers.get('X-Empresa-ID')
        if empresa_id and hasattr(request, 'user') and request.user.is_authenticated:
            if request.user.es_super_admin:
                from apps.empresas.models import Empresa
                try:
                    request.tenant = Empresa.objects.get(id=empresa_id)
                except Empresa.DoesNotExist:
                    pass

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

        # Super admins pasan siempre
        if request.user.es_super_admin:
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

