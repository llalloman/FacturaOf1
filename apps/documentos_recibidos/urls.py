from rest_framework.routers import DefaultRouter

from .views import DocumentoRecibidoSRIViewSet


router = DefaultRouter()
router.register(r'', DocumentoRecibidoSRIViewSet, basename='documento-recibido-sri')

urlpatterns = router.urls
