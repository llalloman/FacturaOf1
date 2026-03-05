from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CajaViewSet, AperturaCajaViewSet, VentaViewSet, MovimientoCajaViewSet

router = DefaultRouter()
router.register(r'cajas', CajaViewSet, basename='caja')
router.register(r'aperturas', AperturaCajaViewSet, basename='apertura')
router.register(r'ventas', VentaViewSet, basename='venta')
router.register(r'movimientos-caja', MovimientoCajaViewSet, basename='movimiento-caja')

urlpatterns = [
    path('', include(router.urls)),
]
