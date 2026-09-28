"""Reglas monetarias compartidas por facturación.

La API recibe el precio unitario bruto y el descuento monetario de la línea.
La base imponible es siempre: cantidad * precio unitario - descuento.
El módulo es deliberadamente independiente de Django para poder probarlo sin
conectarse a una base de datos de producción.
"""

from decimal import Decimal, ROUND_HALF_UP


CENT = Decimal('0.01')
MICRO = Decimal('0.000001')


def money(value):
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


def unit_price(value):
    return Decimal(str(value or 0)).quantize(MICRO, rounding=ROUND_HALF_UP)


def calculate_line(cantidad, precio_unitario, descuento=0, tarifa=0):
    """Calcula una línea desde valores brutos, devolviendo importes fiscales."""
    cantidad = Decimal(str(cantidad or 0))
    precio_unitario = unit_price(precio_unitario)
    descuento = money(descuento)
    tarifa = Decimal(str(tarifa or 0)).quantize(CENT, rounding=ROUND_HALF_UP)
    base = (cantidad * precio_unitario - descuento).quantize(CENT, rounding=ROUND_HALF_UP)
    impuesto = (base * tarifa / Decimal('100.00')).quantize(CENT, rounding=ROUND_HALF_UP)
    return {
        'precio_unitario': precio_unitario,
        'descuento': descuento,
        'precio_total_sin_impuesto': base,
        'valor_impuesto': impuesto,
        'total': (base + impuesto).quantize(CENT, rounding=ROUND_HALF_UP),
    }
