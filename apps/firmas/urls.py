from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DocumentoSolicitudFirmaViewSet, SolicitudFirmaElectronicaViewSet, crear_demo_publica, crear_solicitud_publica

router = DefaultRouter()
router.register(r'solicitudes', SolicitudFirmaElectronicaViewSet, basename='solicitudes-firma')
router.register(r'documentos', DocumentoSolicitudFirmaViewSet, basename='documentos-firma')

urlpatterns = [
    path('', include(router.urls)),
    path('demos-publicas/', crear_demo_publica, name='solicitud-demo-publica'),
    path('solicitudes-publicas/', crear_solicitud_publica, name='solicitud-firma-publica'),
]
