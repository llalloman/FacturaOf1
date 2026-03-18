from django.urls import path
from . import views

urlpatterns = [
    # ── Lectura en tiempo real (sin persistir) ────────────────────────────
    path('form104/', views.form104, name='declaracion-form104'),
    path('form103/', views.form103, name='declaracion-form103'),
    path('ats/',     views.ats,     name='declaracion-ats'),

    # ── Calendario de obligaciones ────────────────────────────────────────
    path('calendario/',  views.calendario,            name='declaracion-calendario'),
    path('proximas/',    views.proximas_obligaciones, name='declaracion-proximas'),

    # ── CRUD de declaraciones persistentes ────────────────────────────────
    path('',                      views.listar_declaraciones, name='declaracion-list'),
    path('calcular/',             views.calcular_y_guardar,   name='declaracion-calcular'),
    path('<int:pk>/',             views.detalle_declaracion,  name='declaracion-detalle'),
    path('<int:pk>/presentar/',   views.marcar_presentada,    name='declaracion-presentar'),
]
