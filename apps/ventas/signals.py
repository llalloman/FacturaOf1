"""
Signals para actualizar inventario automáticamente con las ventas
CON TRANSACCIONALIDAD Y LOCKS
"""
from django.db.models.signals import post_save, post_delete
from django.db.models import Sum
from django.dispatch import receiver
from django.db import transaction
from .models import Venta, DetalleVenta
from apps.inventarios.models import LoteInventario, MovimientoInventario, StockProducto
import logging

logger = logging.getLogger(__name__)


def sincronizar_stock_total_producto(producto):
    total = producto.stock_bodegas.aggregate(total=Sum('cantidad'))['total'] or 0
    producto.stock_actual = total
    producto.save(update_fields=['stock_actual'])


def sincronizar_saldo_lote(lote_id, delta):
    if not lote_id:
        return
    lote = LoteInventario.objects.select_for_update().filter(id=lote_id).first()
    if not lote:
        return
    lote.cantidad_disponible += delta
    if lote.cantidad_disponible < 0:
        lote.cantidad_disponible = 0
    lote.actualizar_estado()
    lote.save(update_fields=['cantidad_disponible', 'estado'])


@receiver(post_save, sender=Venta)
def actualizar_inventario_venta(sender, instance, created, **kwargs):
    """
    Actualiza el inventario cuando se completa una venta
    USA TRANSACCIÓN ATÓMICA Y LOCKS para evitar race conditions
    """
    if instance.estado == 'COMPLETADA':
        try:
            from .inventory import registrar_inventario_venta
            registrar_inventario_venta(instance)
        except Exception:
            logger.exception('Error actualizando inventario para venta %s', instance.numero_venta)


@receiver(post_save, sender=MovimientoInventario)
def actualizar_stock_movimiento(sender, instance, created, **kwargs):
    """
    Actualiza el stock cuando se crea un movimiento de inventario
    USA TRANSACCIÓN ATÓMICA Y LOCKS
    """
    if created:
        try:
            with transaction.atomic():
                # Lock del stock para evitar condiciones de carrera
                stock, _ = StockProducto.objects.select_for_update().get_or_create(
                    bodega=instance.bodega,
                    producto=instance.producto,
                    defaults={'cantidad': 0}
                )
                
                # Actualizar cantidad
                stock.cantidad += instance.cantidad
                
                # Advertir si queda negativo
                if stock.cantidad < 0:
                    logger.warning(
                        f'Stock negativo: {instance.producto.nombre} '
                        f'en {instance.bodega.nombre} = {stock.cantidad}'
                    )
                
                stock.save()
                sincronizar_saldo_lote(instance.lote_id, instance.cantidad)
                sincronizar_stock_total_producto(instance.producto)
                
        except Exception:
            logger.exception('Error actualizando stock para movimiento %s', instance.id)


@receiver(post_delete, sender=MovimientoInventario)
def revertir_stock_movimiento_eliminado(sender, instance, **kwargs):
    """Revierte el saldo físico cuando se elimina un movimiento."""
    try:
        with transaction.atomic():
            stock = StockProducto.objects.select_for_update().filter(
                bodega=instance.bodega,
                producto=instance.producto,
            ).first()
            if stock:
                stock.cantidad -= instance.cantidad
                stock.save(update_fields=['cantidad'])
            sincronizar_saldo_lote(instance.lote_id, -instance.cantidad)
            sincronizar_stock_total_producto(instance.producto)
    except Exception:
        logger.exception('Error revirtiendo stock de movimiento eliminado %s', instance.id)
