from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProveedorViewSet, OrdenCompraViewSet, RecepcionCompraViewSet,
    CuentaPorPagarViewSet, PagoProveedorViewSet
)

router = DefaultRouter()
router.register(r'proveedores', ProveedorViewSet, basename='proveedor')
router.register(r'ordenes', OrdenCompraViewSet, basename='orden-compra')
router.register(r'recepciones', RecepcionCompraViewSet, basename='recepcion-compra')
router.register(r'cuentas-por-pagar', CuentaPorPagarViewSet, basename='cuenta-por-pagar')
router.register(r'pagos', PagoProveedorViewSet, basename='pago-proveedor')

urlpatterns = [
    path('', include(router.urls)),
]
