"""
Script para crear el catálogo de productos del bar After Licors.
Ejecutar con: python manage.py shell < crear_productos_bar.py
O directamente: python crear_productos_bar.py (requiere Django configurado)
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from apps.productos.models import Producto
from apps.empresas.models import Empresa

empresa = Empresa.objects.filter(ruc='1752758720001').first()
if not empresa:
    print("ERROR: No se encontró ninguna empresa.")
    exit(1)

print(f"Creando productos para: {empresa.razon_social}")

# Utilidad: crea o actualiza un producto
created_count = 0
updated_count = 0

def producto(codigo, nombre, precio, costo, tipo='BIEN', maneja_inv=True,
             descripcion='', iva='4'):
    global created_count, updated_count
    precio = Decimal(str(precio))
    costo  = Decimal(str(costo))
    obj, created = Producto.objects.update_or_create(
        empresa=empresa,
        codigo_principal=codigo,
        defaults=dict(
            nombre=nombre,
            descripcion=descripcion,
            tipo=tipo,
            precio=precio,
            costo=costo,
            aplica_iva=True,
            porcentaje_iva=iva,    # '4' = 15 % Ecuador
            maneja_inventario=maneja_inv,
            activo=True,
        )
    )
    flag = "CREADO" if created else "ACTUALIZADO"
    if created:
        created_count += 1
    else:
        updated_count += 1
    print(f"  [{flag}] {codigo} – {nombre}  ${precio}")

# ─────────────────────────────────────────────────────────────────────────────
# CERVEZAS
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CERVEZAS ──")
producto('CERV-PIL-IND', 'Pilsener Individual',        3.50,  0.90, maneja_inv=True)
producto('CERV-PIL-JIR', 'Pilsener Jirafa (Torre)',   17.00,  5.50, maneja_inv=True)
producto('CERV-CLU-IND', 'Club Individual',            4.00,  1.00, maneja_inv=True)
producto('CERV-COR-IND', 'Corona Individual',          4.00,  1.80, maneja_inv=True)
producto('CERV-HEI-IND', 'Heineken Individual',        4.00,  1.85, maneja_inv=True)
producto('CERV-STE-IND', 'Stella Artois Individual',   4.50,  2.00, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# WHISKY (botellas)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── WHISKY ──")
producto('WHIS-OTR',  'Whisky Old Times Rojo',         30.00, 15.00, maneja_inv=True)
producto('WHIS-SOM',  'Whisky Sometimes Special',      40.00, 20.00, maneja_inv=True)
producto('WHIS-GRA',  'Whisky Grants',                 35.00, 17.00, maneja_inv=True)
producto('WHIS-JWR',  'Whisky Johnnie Walker Red',     60.00, 30.00, maneja_inv=True)
producto('WHIS-JMO',  'Whisky John Morris',            30.00, 14.00, maneja_inv=True)
producto('WHIS-JM1L', 'Whisky John Morris 1L',         45.00, 20.00, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# RON
# ─────────────────────────────────────────────────────────────────────────────
print("\n── RON ──")
producto('RON-ABU',  'Ron Abuelo',        35.00, 17.00, maneja_inv=True)
producto('RON-SMP',  'San Miguel Plata',  35.00, 17.00, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# TEQUILA
# ─────────────────────────────────────────────────────────────────────────────
print("\n── TEQUILA ──")
producto('TEQ-AZT5', 'Tequila Azteca 500ml',   35.00, 15.00, maneja_inv=True)
producto('TEQ-AZT8', 'Tequila Azteca 800ml',   50.00, 22.00, maneja_inv=True)
producto('TEQ-CHA',  'Tequila Charro Blanco',   35.00, 15.00, maneja_inv=True)
producto('TEQ-GMA',  'Tequila Gran Malo',        45.00, 20.00, maneja_inv=True)
producto('TEQ-ESP',  'Tequila Espuela',          45.00, 20.00, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# LICORES
# ─────────────────────────────────────────────────────────────────────────────
print("\n── LICORES ──")
producto('LIC-JAG',  'Jagermeister',      45.00, 22.00, maneja_inv=True)
producto('LIC-FLH',  'Flying Hirsch',     50.00, 25.00, maneja_inv=True)
producto('LIC-CMA',  'Caña Manabita',     15.00,  6.00, maneja_inv=True)
producto('LIC-NOR',  'Norteño',           15.00,  6.00, maneja_inv=True)
producto('LIC-ANT',  'Antioqueño',        35.00, 16.00, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# MICHELADAS (servicio, sin inventario propio)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── MICHELADAS ──")
producto('MICH-CLA',  'Michelada Clásica',    3.50, 1.20, tipo='SERVICIO', maneja_inv=False)
producto('MICH-MAR',  'Michelada Maracuyá',   5.00, 1.60, tipo='SERVICIO', maneja_inv=False)
producto('MICH-MAN',  'Michelada Mango',      5.00, 1.60, tipo='SERVICIO', maneja_inv=False)
producto('MICH-TAM',  'Michelada Tamarindo',  5.00, 1.60, tipo='SERVICIO', maneja_inv=False)
producto('MICH-CHI',  'Michelada Chilena',    5.00, 1.60, tipo='SERVICIO', maneja_inv=False)
producto('MICH-MEX',  'Michelada Mexicana',   5.00, 1.60, tipo='SERVICIO', maneja_inv=False)

# ─────────────────────────────────────────────────────────────────────────────
# COCTELES
# ─────────────────────────────────────────────────────────────────────────────
print("\n── COCTELES ──")
producto('COC-MJT',  'Mojito',                   6.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-MJA',  'Mojito After',             7.00,  2.10, tipo='SERVICIO', maneja_inv=False)
producto('COC-MJF',  'Mojito Fresa',             7.00,  2.10, tipo='SERVICIO', maneja_inv=False)
producto('COC-MRG',  'Margarita',                7.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-MRA',  'Margarita After',          7.00,  2.10, tipo='SERVICIO', maneja_inv=False)
producto('COC-PSO',  'Pisco Sour',              8.50,  2.50, tipo='SERVICIO', maneja_inv=False)
producto('COC-TSR',  'Tequila Sunrise',          7.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-PAD',  'Padrino',                  9.00,  2.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-APM',  'Apple Martini',            6.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-CAN',  'Cantadito',                7.00,  2.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-EXM',  'Expresso Martini',         7.00,  2.50, tipo='SERVICIO', maneja_inv=False)
producto('COC-PPC',  'Piña Colada',              7.00,  2.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-COS',  'Cosmopolitan',             6.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-NEG',  'Negroni',                  8.00,  2.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-GNT',  'Gin Tonic',                6.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-LIT',  'Long Island Ice Tea',      8.00,  3.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-MMU',  'Moscow Mule',              8.00,  2.20, tipo='SERVICIO', maneja_inv=False)
producto('COC-PAL',  'Paloma',                   6.00,  1.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-DAI',  'Daiquiri Clásico',         7.00,  2.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-MAN',  'Manhattan',                9.00,  3.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-LAG',  'Laguna After',             8.00,  2.50, tipo='SERVICIO', maneja_inv=False)
producto('COC-OLF',  'Old Fashioned',           12.00,  4.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-SA8',  'Sala 8',                   8.00,  2.50, tipo='SERVICIO', maneja_inv=False)
producto('COC-PPR',  'Placer Prohibido (Orgasmo)', 10.00, 3.00, tipo='SERVICIO', maneja_inv=False)
producto('COC-BSF',  'Beso de Fresa (Vodka)',     9.00,  2.80, tipo='SERVICIO', maneja_inv=False)
producto('COC-SAN',  'Sangria',                   5.00,  1.50, tipo='SERVICIO', maneja_inv=False)

# ─────────────────────────────────────────────────────────────────────────────
# SHOTS
# ─────────────────────────────────────────────────────────────────────────────
print("\n── SHOTS ──")
producto('SHO-TEQ',  'Shot Tequila',              3.50,  0.80, tipo='SERVICIO', maneja_inv=False)
producto('SHO-3RY',  'Shot Tabla 3 en Raya (Vodka) x3', 18.00, 4.50, tipo='SERVICIO', maneja_inv=False)
producto('SHO-VOD',  'Shot Vodka',                2.00,  0.50, tipo='SERVICIO', maneja_inv=False)
producto('SHO-WHI',  'Shot Whisky',               3.50,  1.00, tipo='SERVICIO', maneja_inv=False)

# ─────────────────────────────────────────────────────────────────────────────
# PECERAS
# ─────────────────────────────────────────────────────────────────────────────
print("\n── PECERAS ──")
producto('PEC-VOD',  'Pecera Vodka',     15.00, 4.50, tipo='SERVICIO', maneja_inv=False)
producto('PEC-TEQ',  'Pecera Tequila',   15.00, 4.50, tipo='SERVICIO', maneja_inv=False)
producto('PEC-SWI',  'Pecera Swich',      6.00, 2.00, tipo='SERVICIO', maneja_inv=False)

# ─────────────────────────────────────────────────────────────────────────────
# BEBIDAS SIN ALCOHOL
# ─────────────────────────────────────────────────────────────────────────────
print("\n── BEBIDAS SIN ALCOHOL ──")
producto('BNA-LCZ',  'Limonada Cerezada',  3.00, 1.00, tipo='SERVICIO', maneja_inv=False)
producto('BNA-RBL',  'Red Bull',           5.00, 2.50, maneja_inv=True)
producto('BNA-V22',  'V220',               1.50, 0.80, maneja_inv=True)
producto('BNA-ACG',  'Agua con Gas',       1.50, 0.60, maneja_inv=True)
producto('BNA-ASG',  'Agua sin Gas',       1.25, 0.50, maneja_inv=True)
producto('BNA-GAS',  'Gaseosa',            2.00, 0.80, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# CIGARRILLOS
# ─────────────────────────────────────────────────────────────────────────────
print("\n── CIGARRILLOS ──")
producto('CIG-MBR',  'Marlboro Rojo',           0.75, 0.45, maneja_inv=True)
producto('CIG-MDC',  'Marlboro Doble Cápsula',  0.75, 0.45, maneja_inv=True)
producto('CIG-LAR',  'Lark',                    0.75, 0.40, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# SNACKS
# ─────────────────────────────────────────────────────────────────────────────
print("\n── SNACKS ──")
producto('SNA-NAC',  'Nachos con Queso',  3.50, 1.50, tipo='SERVICIO', maneja_inv=False)
producto('SNA-DOR',  'Dorilokos',         3.50, 1.80, maneja_inv=True)
producto('SNA-CHU',  'Chupetes',          0.50, 0.20, maneja_inv=True)
producto('SNA-CHI',  'Chicles',           0.25, 0.10, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
# PIPAS
# ─────────────────────────────────────────────────────────────────────────────
print("\n── PIPAS ──")
producto('PIP-001',  'Pipa',  5.00, 2.50, maneja_inv=True)

# ─────────────────────────────────────────────────────────────────────────────
print(f"\n✅ Proceso completado: {created_count} creados, {updated_count} actualizados.")
