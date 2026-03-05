"""
Middleware Multi-Tenant para manejar el contexto de empresa
"""
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware para manejar el contexto de empresa (tenant) en cada request
    """
    
    def process_request(self, request):
        """
        Extrae la empresa del usuario autenticado o del header
        """
        # Inicializar el tenant como None
        request.tenant = None
        
        # Si el usuario está autenticado y tiene empresa asignada
        if hasattr(request, 'user') and request.user.is_authenticated:
            if hasattr(request.user, 'empresa') and request.user.empresa:
                request.tenant = request.user.empresa
        
        # Permitir especificar empresa via header (solo para super admins)
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
        """
        Validar que endpoints protegidos tengan tenant
        """
        # Rutas que no requieren tenant
        rutas_sin_tenant = [
            '/admin/',
            '/api/auth/',
            '/api/usuarios/me/',
        ]
        
        # Si la ruta no requiere tenant, continuar
        for ruta in rutas_sin_tenant:
            if request.path.startswith(ruta):
                return None
        
        # Si es un endpoint de API y requiere empresa
        if request.path.startswith('/api/') and hasattr(request, 'user'):
            if request.user.is_authenticated and not request.user.es_super_admin:
                # Rutas que requieren tenant
                if any(x in request.path for x in ['/facturacion/', '/productos/', '/clientes/']):
                    if not request.tenant:
                        return JsonResponse({
                            'error': 'No se ha especificado una empresa válida'
                        }, status=400)
        
        return None
