from decimal import Decimal

from django.db import transaction

from apps.inventarios.models import MovimientoInventario, StockProducto


def validar_stock_venta(caja, detalles_data):
    """Valida stock disponible para productos inventariables."""
    bodega = caja.bodega
    errores = []

    for detalle in detalles_data:
        producto = detalle.get('producto')
        cantidad = Decimal(str(detalle.get('cantidad') or 0))

        if not producto or not getattr(producto, 'maneja_inventario', False):
            continue

        stock = StockProducto.objects.filter(
            producto=producto,
            bodega=bodega,
        ).first()
        disponible = stock.cantidad if stock else Decimal('0.00')

        if disponible < cantidad:
            errores.append(
                f'{producto.nombre}: disponible {disponible}, requerido {cantidad}'
            )

    if errores:
        raise ValueError('Stock insuficiente en bodega: ' + '; '.join(errores))


@transaction.atomic
def registrar_movimientos_venta(venta, usuario=None):
    """Genera movimientos de inventario para una venta completada."""
    if venta.estado != venta.EstadoChoices.COMPLETADA:
        return 0

    referencia = f'Venta {venta.numero_venta}'
    if MovimientoInventario.objects.filter(documento_referencia=referencia).exists():
        return 0

    bodega = venta.caja.bodega
    creados = 0

    for detalle in venta.detalles.select_related('producto').all():
        producto = detalle.producto
        if not producto.maneja_inventario:
            continue

        stock, _ = StockProducto.objects.select_for_update().get_or_create(
            producto=producto,
            bodega=bodega,
            defaults={'cantidad': Decimal('0.00'), 'costo_promedio': Decimal('0.00')},
        )
        if stock.cantidad < detalle.cantidad:
            raise ValueError(
                f'Stock insuficiente para {producto.nombre}. '
                f'Disponible: {stock.cantidad}, requerido: {detalle.cantidad}'
            )

        MovimientoInventario.objects.create(
            empresa=venta.empresa,
            bodega=bodega,
            producto=producto,
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            cantidad=-detalle.cantidad,
            costo_unitario=detalle.costo_unitario,
            documento_referencia=referencia,
            venta_id=str(venta.numero_venta),
            usuario=usuario or venta.usuario,
            observaciones=f'Salida por venta {venta.numero_venta}',
        )
        creados += 1

    return creados
