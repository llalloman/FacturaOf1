"""
Signals para actualizar inventario automáticamente con las ventas
CON TRANSACCIONALIDAD Y LOCKS
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import Venta, DetalleVenta
from apps.inventarios.models import MovimientoInventario, StockProducto
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Venta)
def actualizar_inventario_venta(sender, instance, created, **kwargs):
    """
    Actualiza el inventario cuando se completa una venta
    USA TRANSACCIÓN ATÓMICA Y LOCKS para evitar race conditions
    """
    if instance.estado == 'COMPLETADA':
        # Verificar si ya se crearon movimientos para esta venta
        movimientos_existentes = MovimientoInventario.objects.filter(
            documento_referencia=f'Venta {instance.numero_venta}'
        ).exists()
        
        if not movimientos_existentes:
            try:
                with transaction.atomic():
                    bodega = instance.caja.bodega
                    
                    for detalle in instance.detalles.all():
                        # Lock del stock para evitar condiciones de carrera
                        stock, created_stock = StockProducto.objects.select_for_update().get_or_create(
                            producto=detalle.producto,
                            bodega=bodega,
                            defaults={'cantidad': 0}
                        )
                        
                        # Validar stock suficiente
                        if stock.cantidad < detalle.cantidad:
                            logger.warning(
                                f'Stock insuficiente para venta {instance.numero_venta}: '
                                f'{detalle.producto.nombre} - Disponible: {stock.cantidad}, '
                                f'Requerido: {detalle.cantidad}'
                            )
                            # Permitir venta en negativo pero registrar
                        
                        # Crear movimiento de salida
                        MovimientoInventario.objects.create(
                            empresa=instance.empresa,
                            bodega=bodega,
                            producto=detalle.producto,
                            tipo_movimiento='SALIDA_VENTA',
                            cantidad=-detalle.cantidad,
                            costo_unitario=detalle.costo_unitario,
                            documento_referencia=f'Venta {instance.numero_venta}',
                            venta_id=str(instance.numero_venta),
                            usuario=instance.usuario
                        )
                        
            except Exception as e:
                logger.error(f'Error actualizando inventario para venta {instance.numero_venta}: {str(e)}')


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
                stock, created_stock = StockProducto.objects.select_for_update().get_or_create(
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
                
        except Exception as e:
            logger.error(f'Error actualizando stock para movimiento: {str(e)}')
