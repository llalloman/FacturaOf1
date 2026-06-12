from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanSuscripcionViewSet, SuscripcionViewSet, ModuloSistemaViewSet, SeccionModuloViewSet, catalogo_modulos, mis_modulos

router = DefaultRouter()
router.register(r'planes', PlanSuscripcionViewSet, basename='planes')
router.register(r'suscripciones', SuscripcionViewSet, basename='suscripciones')
router.register(r'modulos', ModuloSistemaViewSet, basename='modulos-sistema')
router.register(r'modulos-secciones', SeccionModuloViewSet, basename='modulos-secciones')

urlpatterns = [
    path('', include(router.urls)),
    path('modulos-catalogo/', catalogo_modulos, name='modulos-catalogo'),
    path('mis-modulos/', mis_modulos, name='mis-modulos'),
]
