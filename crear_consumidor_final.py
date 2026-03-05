import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.clientes.models import Cliente
from apps.empresas.models import Empresa

empresa = Empresa.objects.first()

obj, created = Cliente.objects.update_or_create(
    empresa=empresa,
    identificacion='9999999999999',
    defaults=dict(
        tipo_identificacion='07',
        razon_social='Consumidor Final',
        nombre_comercial='Consumidor Final',
        activo=True,
    )
)
print(f"{'CREADO' if created else 'YA EXISTE'}: {obj.razon_social} | ID: {obj.identificacion} | Tipo: {obj.tipo_identificacion}")
