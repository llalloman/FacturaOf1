from rest_framework.routers import DefaultRouter
from .views import CuentaBancariaViewSet, MovimientoBancarioViewSet

router = DefaultRouter()
router.register('cuentas',     CuentaBancariaViewSet,     basename='cuenta-bancaria')
router.register('movimientos', MovimientoBancarioViewSet, basename='movimiento-bancario')

urlpatterns = router.urls
