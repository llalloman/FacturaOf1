from decimal import Decimal, ROUND_HALF_UP


COST_SCALE = Decimal('0.000001')


def project_stock(cantidad_actual, costo_actual, delta, costo_movimiento):
    """Proyecta cantidad y costo promedio ponderado de una entrada/salida."""
    cantidad_actual = Decimal(str(cantidad_actual or 0))
    costo_actual = Decimal(str(costo_actual or 0))
    delta = Decimal(str(delta or 0))
    costo_movimiento = Decimal(str(costo_movimiento or 0))
    nueva_cantidad = cantidad_actual + delta

    if delta > 0:
        if cantidad_actual > 0:
            nuevo_costo = (
                (cantidad_actual * costo_actual) + (delta * costo_movimiento)
            ) / nueva_cantidad
        else:
            nuevo_costo = costo_movimiento
        costo_resultado = nuevo_costo.quantize(COST_SCALE, rounding=ROUND_HALF_UP)
    else:
        costo_resultado = costo_actual.quantize(COST_SCALE, rounding=ROUND_HALF_UP)

    return nueva_cantidad, costo_resultado
