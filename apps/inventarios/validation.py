"""Validaciones puras del contrato de movimientos de inventario."""

from decimal import Decimal


ENTRADA_TYPES = {
    'ENTRADA_COMPRA',
    'AJUSTE_ENTRADA',
    'TRANSFERENCIA_ENTRADA',
    'DEVOLUCION_ENTRADA',
}

SALIDA_TYPES = {
    'SALIDA_VENTA',
    'AJUSTE_SALIDA',
    'TRANSFERENCIA_SALIDA',
    'DEVOLUCION_SALIDA',
}


def movement_sign_error(tipo_movimiento, cantidad):
    """Devuelve el error de signo/cero o ``None`` si el movimiento es válido.

    El contrato usa cantidades positivas para entradas y negativas para
    salidas. Mantener esta regla fuera del serializer permite probarla sin
    conexión a la base y reutilizarla en importaciones o POS.
    """
    if cantidad is None:
        return None
    cantidad = Decimal(str(cantidad))
    if cantidad == 0:
        return 'El movimiento no puede tener cantidad cero.'
    if tipo_movimiento in ENTRADA_TYPES and cantidad < 0:
        return 'Las entradas deben tener cantidad positiva.'
    if tipo_movimiento in SALIDA_TYPES and cantidad > 0:
        return 'Las salidas deben tener cantidad negativa.'
    return None
