from rest_framework.routers import DefaultRouter
from .views import EmpleadoViewSet, RolPagoViewSet

router = DefaultRouter()
router.register('empleados', EmpleadoViewSet,  basename='empleado')
router.register('roles',     RolPagoViewSet,   basename='rol-pago')

urlpatterns = router.urls
