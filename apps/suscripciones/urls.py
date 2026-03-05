from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# Aquí se registrarán los viewsets cuando se implementen

urlpatterns = [
    path('', include(router.urls)),
]
