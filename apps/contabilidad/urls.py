from rest_framework.routers import DefaultRouter
from .views import CuentaContableViewSet, AsientoContableViewSet

router = DefaultRouter()
router.register('cuentas',   CuentaContableViewSet,  basename='cuenta-contable')
router.register('asientos',  AsientoContableViewSet, basename='asiento-contable')

urlpatterns = router.urls
