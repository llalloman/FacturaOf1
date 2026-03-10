from django.urls import path
from . import views

urlpatterns = [
    path('form104/', views.form104, name='declaracion-form104'),
    path('form103/', views.form103, name='declaracion-form103'),
    path('ats/',     views.ats,     name='declaracion-ats'),
]
