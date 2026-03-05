from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BodegaViewSet, StockProductoViewSet, MovimientoInventarioViewSet,
    TransferenciaInventarioViewSet
)

router = DefaultRouter()
router.register(r'bodegas', BodegaViewSet, basename='bodega')
router.register(r'stock', StockProductoViewSet, basename='stock')
router.register(r'movimientos', MovimientoInventarioViewSet, basename='movimiento')
router.register(r'transferencias', TransferenciaInventarioViewSet, basename='transferencia')

urlpatterns = [
    path('', include(router.urls)),
]
