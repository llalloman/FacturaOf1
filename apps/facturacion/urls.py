from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    FacturaViewSet,
    RetencionViewSet,
    GuiaRemisionViewSet,
    NotaDebitoViewSet,
    NotaCreditoViewSet,
    SecuencialViewSet,
)

router = DefaultRouter()
router.register(r'facturas', FacturaViewSet, basename='factura')
router.register(r'retenciones', RetencionViewSet, basename='retencion')
router.register(r'guias-remision', GuiaRemisionViewSet, basename='guia-remision')
router.register(r'notas-debito', NotaDebitoViewSet, basename='nota-debito')
router.register(r'notas-credito', NotaCreditoViewSet, basename='nota-credito')
router.register(r'secuenciales', SecuencialViewSet, basename='secuencial')

urlpatterns = [
    path('', include(router.urls)),
]

