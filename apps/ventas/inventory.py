from django.db import transaction

from apps.inventarios.models import MovimientoInventario


@transaction.atomic
def registrar_inventario_venta(venta, detalle_ids=None):
    """Crea las salidas pendientes de una venta sin duplicar movimientos."""
    if venta.estado != 'COMPLETADA':
        return []

    creados = []
    detalles = venta.detalles.select_related('producto', 'bodega').all()
    if detalle_ids is not None:
        detalles = detalles.filter(id__in=detalle_ids)
    for detalle in detalles:
        producto = detalle.producto
        if producto.tipo != 'BIEN' or not producto.maneja_inventario:
            if detalle.bodega_id:
                detalle.bodega = None
                detalle.save(update_fields=['bodega'])
            continue

        bodega = detalle.bodega or venta.caja.bodega
        if bodega.empresa_id != venta.empresa_id:
            raise ValueError('La bodega de salida no pertenece a la empresa de la venta.')
        if detalle.bodega_id != bodega.id:
            detalle.bodega = bodega
            detalle.save(update_fields=['bodega'])

        referencia = f'Venta {venta.numero_venta} detalle {detalle.id}'
        existente = MovimientoInventario.objects.filter(
            empresa=venta.empresa,
            producto=producto,
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            documento_referencia=referencia,
        ).first()
        if existente:
            continue

        movimientos_legacy = MovimientoInventario.objects.filter(
            empresa=venta.empresa,
            producto=producto,
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            venta_id=str(venta.numero_venta),
        )
        if movimientos_legacy.count() == 1:
            legado = movimientos_legacy.first()
            legado.documento_referencia = referencia
            legado.save(update_fields=['documento_referencia'])
            continue

        movimiento, created = MovimientoInventario.objects.get_or_create(
            empresa=venta.empresa,
            producto=producto,
            bodega=bodega,
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            documento_referencia=referencia,
            defaults={
                'cantidad': -detalle.cantidad,
                'costo_unitario': detalle.costo_unitario,
                'venta_id': str(venta.numero_venta),
                'usuario': venta.usuario,
                'observaciones': 'Salida automática por venta',
            },
        )
        if created:
            creados.append(movimiento)
    return creados
