from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FirmadorCertificadoViewSet, FirmadorDocumentoViewSet, firmar_documento, perfil_firmador


router = DefaultRouter()
router.register(r'documentos', FirmadorDocumentoViewSet, basename='firmador-documentos')
router.register(r'certificados', FirmadorCertificadoViewSet, basename='firmador-certificados')

urlpatterns = [
    path('perfil/', perfil_firmador, name='firmador-perfil'),
    path('firmar/', firmar_documento, name='firmador-firmar'),
]

urlpatterns += router.urls
