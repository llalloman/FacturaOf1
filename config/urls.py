"""
URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from apps.usuarios.auth_views import (
    CustomTokenObtainPairView, current_user, logout, registro_empresa,
    verificar_email, reenviar_codigo, consultar_ruc, validar_certificado, completar_onboarding,
    recuperar_password, cambiar_password,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', current_user, name='current_user'),
    path('api/auth/logout/', logout, name='logout'),
    path('api/auth/registro-empresa/', registro_empresa, name='registro_empresa'),
    path('api/auth/verificar-email/', verificar_email, name='verificar_email'),
    path('api/auth/reenviar-codigo/', reenviar_codigo, name='reenviar_codigo'),
    path('api/auth/consultar-ruc/<str:ruc>/', consultar_ruc, name='consultar_ruc'),
    path('api/auth/validar-certificado/', validar_certificado, name='validar_certificado'),
    path('api/auth/completar-onboarding/', completar_onboarding, name='completar_onboarding'),
    path('api/auth/recuperar-password/', recuperar_password, name='recuperar_password'),
    path('api/auth/cambiar-password/', cambiar_password, name='cambiar_password'),
    
    # API endpoints
    path('api/usuarios/', include('apps.usuarios.urls')),
    path('api/empresas/', include('apps.empresas.urls')),
    path('api/suscripciones/', include('apps.suscripciones.urls')),
    path('api/facturacion/', include('apps.facturacion.urls')),
    path('api/productos/', include('apps.productos.urls')),
    path('api/clientes/', include('apps.clientes.urls')),
    path('api/inventarios/', include('apps.inventarios.urls')),
    path('api/ventas/', include('apps.ventas.urls')),
    path('api/proveedores/', include('apps.proveedores.urls')),
    path('api/pedidos/', include('apps.pedidos.urls')),
    path('api/cartera/', include('apps.cartera.urls')),
    path('api/declaraciones/', include('apps.declaraciones.urls')),
    path('api/cotizaciones/', include('apps.cotizaciones.urls')),
    path('api/contabilidad/', include('apps.contabilidad.urls')),
    
    # Health check para verificar conexión desde POS
    path('api/health/', lambda request: JsonResponse({'status': 'ok'})),
]

from django.http import JsonResponse

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
