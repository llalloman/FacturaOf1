from rest_framework.routers import DefaultRouter

from apps.pagos.views import PagoConfiguracionViewSet, PagoOnlineViewSet

router = DefaultRouter()
router.register('configuracion', PagoConfiguracionViewSet, basename='pago-configuracion')
router.register('online', PagoOnlineViewSet, basename='pago-online')

urlpatterns = router.urls
