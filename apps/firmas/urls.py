from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ConsentimientoFirmaElectronicaViewSet,
    DocumentoSolicitudFirmaViewSet,
    FirmaCuponElectronicoViewSet,
    FirmaPrecioElectronicaViewSet,
    FirmaPromocionElectronicaViewSet,
    SolicitudFirmaElectronicaViewSet,
    cuentas_pago_transferencia_firma,
    crear_demo_publica,
    crear_pago_payphone_firma_publico,
    consultar_solicitud_publica_pago,
    crear_cajita_payphone_firma_publico,
    payphone_firma_callback_publico,
    payphone_firma_cancelado_publico,
    payphone_firma_retorno_publico,
    crear_solicitud_publica,
    finalizar_solicitud_publica,
    precios_firma_publicos,
    validar_cupon_publico,
    subir_documento_solicitud_publica,
)

router = DefaultRouter()
router.register(r'solicitudes', SolicitudFirmaElectronicaViewSet, basename='solicitudes-firma')
router.register(r'consentimientos', ConsentimientoFirmaElectronicaViewSet, basename='consentimientos-firma')
router.register(r'documentos', DocumentoSolicitudFirmaViewSet, basename='documentos-firma')
router.register(r'precios', FirmaPrecioElectronicaViewSet, basename='precios-firma')
router.register(r'promociones', FirmaPromocionElectronicaViewSet, basename='promociones-firma')
router.register(r'cupones', FirmaCuponElectronicoViewSet, basename='cupones-firma')

urlpatterns = [
    path('', include(router.urls)),
    path('demos-publicas/', crear_demo_publica, name='solicitud-demo-publica'),
    path('precios-publicos/', precios_firma_publicos, name='precios-firma-publicos'),
    path('cuentas-pago-transferencia/', cuentas_pago_transferencia_firma, name='cuentas-pago-transferencia-firma'),
    path('cupones-publicos/validar/', validar_cupon_publico, name='validar-cupon-firma-publico'),
    path('solicitudes-publicas/', crear_solicitud_publica, name='solicitud-firma-publica'),
    path('solicitudes-publicas/consulta-pago/', consultar_solicitud_publica_pago, name='solicitud-firma-publica-consulta-pago'),
    path('solicitudes-publicas/<int:pk>/documentos/', subir_documento_solicitud_publica, name='solicitud-firma-publica-documento'),
    path('solicitudes-publicas/<int:pk>/finalizar/', finalizar_solicitud_publica, name='solicitud-firma-publica-finalizar'),
    path('solicitudes-publicas/<int:pk>/payphone/', crear_pago_payphone_firma_publico, name='payphone-firma-crear-publico'),
    path('solicitudes-publicas/<int:pk>/payphone/cajita/', crear_cajita_payphone_firma_publico, name='payphone-firma-cajita-publico'),
    path('payphone/firma/callback/', payphone_firma_callback_publico, name='payphone-firma-callback-publico'),
    path('payphone/firma/retorno/', payphone_firma_retorno_publico, name='payphone-firma-retorno-publico'),
    path('payphone/firma/cancelado/', payphone_firma_cancelado_publico, name='payphone-firma-cancelado-publico'),
]
