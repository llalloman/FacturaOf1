from django.db import transaction
from django.utils import timezone

from apps.inventarios.models import LoteInventario, MovimientoInventario


def _movimiento_ya_registrado(venta, producto, referencia):
    return MovimientoInventario.objects.filter(
        empresa=venta.empresa,
        producto=producto,
        tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
        documento_referencia=referencia,
    ).exists()


def _normalizar_movimientos_legacy(venta, producto, referencia):
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
        return True
    return False


def _consumir_lotes_fefo(venta, detalle, bodega, referencia):
    hoy = timezone.now().date()
    lotes = list(
        LoteInventario.objects.select_for_update().filter(
            empresa=venta.empresa,
            producto=detalle.producto,
            bodega=bodega,
            activo=True,
            cantidad_disponible__gt=0,
        ).exclude(
            fecha_caducidad__lt=hoy,
        ).order_by('fecha_caducidad', 'fecha_creacion')
    )

    restante = detalle.cantidad
    creados = []
    for lote in lotes:
        if restante <= 0:
            break
        tomar = min(restante, lote.cantidad_disponible)
        if tomar <= 0:
            continue
        movimiento = MovimientoInventario.objects.create(
            empresa=venta.empresa,
            producto=detalle.producto,
            bodega=bodega,
            lote=lote,
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            cantidad=-tomar,
            costo_unitario=lote.costo_unitario or detalle.costo_unitario,
            venta_id=str(venta.numero_venta),
            usuario=venta.usuario,
            documento_referencia=referencia,
            observaciones=f'Salida FEFO por venta (lote {lote.numero_lote})',
        )
        creados.append(movimiento)
        restante -= tomar

    if restante > 0:
        raise ValueError(
            f'No hay stock FEFO suficiente para {detalle.producto.nombre} en {bodega.nombre}. '
            f'Faltan {restante} unidades.'
        )
    return creados


def _procesar_detalle_venta(venta, detalle):
    producto = detalle.producto
    if producto.tipo != 'BIEN' or not producto.maneja_inventario:
        if detalle.bodega_id:
            detalle.bodega = None
            detalle.save(update_fields=['bodega'])
        return []

    bodega = detalle.bodega or venta.caja.bodega
    if bodega.empresa_id != venta.empresa_id:
        raise ValueError('La bodega de salida no pertenece a la empresa de la venta.')
    if detalle.bodega_id != bodega.id:
        detalle.bodega = bodega
        detalle.save(update_fields=['bodega'])

    referencia = f'Venta {venta.numero_venta} detalle {detalle.id}'
    if _movimiento_ya_registrado(venta, producto, referencia):
        return []
    if _normalizar_movimientos_legacy(venta, producto, referencia):
        return []

    if producto.controla_caducidad:
        return _consumir_lotes_fefo(venta, detalle, bodega, referencia)

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
    return [movimiento] if created else []


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
        creados.extend(_procesar_detalle_venta(venta, detalle))
    return creados
