import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.productos.models import Producto
from apps.empresas.models import Empresa

empresa = Empresa.objects.first()
prods = Producto.objects.filter(empresa=empresa).order_by('codigo_principal').values_list('codigo_principal', 'nombre', 'precio')
for codigo, nombre, precio in prods:
    print(f"{codigo:20s}  {nombre:45s}  ${precio}")
print(f"\nTotal: {prods.count()}")
