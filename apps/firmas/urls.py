from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DocumentoSolicitudFirmaViewSet,
    FirmaCuponElectronicoViewSet,
    FirmaPrecioElectronicaViewSet,
    FirmaPromocionElectronicaViewSet,
    SolicitudFirmaElectronicaViewSet,
    crear_demo_publica,
    crear_solicitud_publica,
    finalizar_solicitud_publica,
    precios_firma_publicos,
    validar_cupon_publico,
    subir_documento_solicitud_publica,
)

router = DefaultRouter()
router.register(r'solicitudes', SolicitudFirmaElectronicaViewSet, basename='solicitudes-firma')
router.register(r'documentos', DocumentoSolicitudFirmaViewSet, basename='documentos-firma')
router.register(r'precios', FirmaPrecioElectronicaViewSet, basename='precios-firma')
router.register(r'promociones', FirmaPromocionElectronicaViewSet, basename='promociones-firma')
router.register(r'cupones', FirmaCuponElectronicoViewSet, basename='cupones-firma')

urlpatterns = [
    path('', include(router.urls)),
    path('demos-publicas/', crear_demo_publica, name='solicitud-demo-publica'),
    path('precios-publicos/', precios_firma_publicos, name='precios-firma-publicos'),
    path('cupones-publicos/validar/', validar_cupon_publico, name='validar-cupon-firma-publico'),
    path('solicitudes-publicas/', crear_solicitud_publica, name='solicitud-firma-publica'),
    path('solicitudes-publicas/<int:pk>/documentos/', subir_documento_solicitud_publica, name='solicitud-firma-publica-documento'),
    path('solicitudes-publicas/<int:pk>/finalizar/', finalizar_solicitud_publica, name='solicitud-firma-publica-finalizar'),
]
