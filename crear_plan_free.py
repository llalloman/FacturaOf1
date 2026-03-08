#!/usr/bin/env python
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.suscripciones.models import PlanSuscripcion

obj, created = PlanSuscripcion.objects.get_or_create(
    codigo='FREE',
    defaults=dict(
        nombre='Gratuito',
        tipo='FREE',
        periodo='ANUAL',
        precio=0,
        facturas_mensuales=50,  # shown as "50 docs / año" in UI
        usuarios_permitidos=1,
        empresas_permitidas=1,
        soporte_prioritario=False,
        api_access=False,
        reportes_avanzados=False,
        descripcion='50 documentos electrónicos al año. POS, inventario y más disponibles durante 30 días de prueba.',
        activo=True,
    )
)
print('Creado' if created else 'Ya existe', '-', obj.nombre, '- $', obj.precio)
for p in PlanSuscripcion.objects.filter(activo=True).order_by('precio'):
    print(f'  {p.codigo:25} ${p.precio}/{"año" if p.periodo == "ANUAL" else "mes"}  tipo:{p.tipo}')
