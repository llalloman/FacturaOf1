from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanSuscripcionViewSet, SuscripcionViewSet

router = DefaultRouter()
router.register(r'planes', PlanSuscripcionViewSet, basename='planes')
router.register(r'suscripciones', SuscripcionViewSet, basename='suscripciones')

urlpatterns = [
    path('', include(router.urls)),
]
