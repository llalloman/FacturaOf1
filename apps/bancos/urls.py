from rest_framework.routers import DefaultRouter
from .views import CuentaBancariaViewSet, MovimientoBancarioViewSet, CierreTesoreriaViewSet

router = DefaultRouter()
router.register('cuentas',     CuentaBancariaViewSet,     basename='cuenta-bancaria')
router.register('movimientos', MovimientoBancarioViewSet, basename='movimiento-bancario')
router.register('cierres-tesoreria', CierreTesoreriaViewSet, basename='cierre-tesoreria')

urlpatterns = router.urls
