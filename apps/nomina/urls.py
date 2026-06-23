from rest_framework.routers import DefaultRouter
from .views import (
    ConceptoEmpleadoNominaViewSet,
    DetalleRolPagoViewSet,
    EmpleadoViewSet,
    ParametroNominaViewSet,
    RolPagoViewSet,
    RubroNominaViewSet,
)

router = DefaultRouter()
router.register('empleados', EmpleadoViewSet, basename='empleado')
router.register('roles', RolPagoViewSet, basename='rol-pago')
router.register('detalles', DetalleRolPagoViewSet, basename='detalle-rol-pago')
router.register('rubros', RubroNominaViewSet, basename='rubro-nomina')
router.register('conceptos-empleado', ConceptoEmpleadoNominaViewSet, basename='concepto-empleado-nomina')
router.register('parametros', ParametroNominaViewSet, basename='parametro-nomina')

urlpatterns = router.urls
