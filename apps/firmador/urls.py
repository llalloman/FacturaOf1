from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    FirmadorCertificadoViewSet,
    FirmadorAdminWorkspaceViewSet,
    FirmadorDocumentoViewSet,
    descargar_documento_publico,
    firmar_documento,
    perfil_firmador,
    validar_documento_publico,
    validar_documentos_pdf,
)


router = DefaultRouter()
router.register(r'documentos', FirmadorDocumentoViewSet, basename='firmador-documentos')
router.register(r'certificados', FirmadorCertificadoViewSet, basename='firmador-certificados')
router.register(r'admin/workspaces', FirmadorAdminWorkspaceViewSet, basename='firmador-admin-workspaces')

urlpatterns = [
    path('perfil/', perfil_firmador, name='firmador-perfil'),
    path('firmar/', firmar_documento, name='firmador-firmar'),
    path('validar/', validar_documentos_pdf, name='firmador-validar-pdfs'),
    path('validar/<int:pk>/', validar_documento_publico, name='firmador-validar-publico'),
    path('validar/<int:pk>/descargar/', descargar_documento_publico, name='firmador-descargar-publico'),
]

urlpatterns += router.urls
