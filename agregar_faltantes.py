import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from apps.productos.models import Producto
from apps.empresas.models import Empresa

empresa = Empresa.objects.first()

items = [
    ('CERV-PIL-3X', 'Combo Pilsener x3',      9.00,  2.85, 'BIEN',     True),
    ('CERV-CLU-3X', 'Combo Club x3',          10.00,  3.20, 'BIEN',    True),
    ('CERV-COR-6X', 'Combo Corona x6',        20.00, 10.50, 'BIEN',    True),
    ('CERV-HEI-3X', 'Combo Heineken x3',      10.00,  5.40, 'BIEN',    True),
    ('CERV-STE-5X', 'Combo Stella Artois x5', 20.00,  9.50, 'BIEN',    True),
    ('COC-MIM',     'Mimosa',                  6.00,  2.00, 'SERVICIO', False),
]

for codigo, nombre, precio, costo, tipo, inv in items:
    obj, created = Producto.objects.update_or_create(
        empresa=empresa,
        codigo_principal=codigo,
        defaults=dict(
            nombre=nombre,
            tipo=tipo,
            precio=Decimal(str(precio)),
            costo=Decimal(str(costo)),
            aplica_iva=True,
            porcentaje_iva='4',
            maneja_inventario=inv,
            activo=True,
        )
    )
    flag = "CREADO" if created else "YA EXISTIA"
    print(f"  [{flag}] {codigo} - {nombre}  ${precio}")

print(f"\nTotal productos: {Producto.objects.count()}")
