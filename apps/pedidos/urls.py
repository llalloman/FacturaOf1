from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ZonaViewSet, MesaViewSet, PedidoViewSet, DetallePedidoViewSet

router = DefaultRouter()
router.register(r'zonas', ZonaViewSet, basename='zona')
router.register(r'mesas', MesaViewSet, basename='mesa')
router.register(r'pedidos', PedidoViewSet, basename='pedido')
router.register(r'items', DetallePedidoViewSet, basename='detalle-pedido')

urlpatterns = [
    path('', include(router.urls)),
]
