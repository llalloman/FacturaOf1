from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal
import logging

from .models import (
    DetalleOrdenCompra, DetalleRecepcion, PagoProveedor
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=DetalleOrdenCompra)
def actualizar_totales_orden(sender, instance, created, **kwargs):
    """
    Actualizar totales de la orden cuando se crea/actualiza un detalle
    """
    if not created:
        # Recalcular totales del detalle
        instance.calcular_totales()
        instance.save()
    
    # Actualizar totales de la orden
    orden = instance.orden_compra
    orden.calcular_totales()
    orden.save()


@receiver(post_delete, sender=DetalleOrdenCompra)
def actualizar_totales_orden_delete(sender, instance, **kwargs):
    """
    Actualizar totales de la orden cuando se elimina un detalle
    """
    try:
        orden = instance.orden_compra
        orden.calcular_totales()
        orden.save()
    except Exception as e:
        logger.error(f"Error actualizando totales de orden: {e}")


@receiver(post_save, sender=DetalleRecepcion)
def actualizar_inventario_recepcion(sender, instance, created, **kwargs):
    """
    Actualizar inventario cuando se confirma una recepción
    Solo si la recepción está en estado RECIBIDA
    """
    from apps.inventarios.models import MovimientoInventario, StockProducto
    
    recepcion = instance.recepcion
    
    # Solo procesar si la recepción está confirmada
    if recepcion.estado != 'RECIBIDA':
        return
    
    # Evitar duplicados verificando si ya existe el movimiento
    movimiento_existe = MovimientoInventario.objects.filter(
        empresa=recepcion.empresa,
        producto=instance.detalle_orden.producto,
        bodega=recepcion.bodega,
        tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.ENTRADA_COMPRA,
        referencia=f"Recepción {recepcion.numero_recepcion} - Detalle {instance.id}"
    ).exists()
    
    if movimiento_existe:
        logger.warning(
            f"Ya existe movimiento de inventario para recepción "
            f"{recepcion.numero_recepcion} detalle {instance.id}"
        )
        return
    
    # Este signal solo se dispara después de confirmar,
    # el movimiento se crea en la vista confirmar()
    logger.info(
        f"Recepción {recepcion.numero_recepcion} confirmada: "
        f"{instance.cantidad_recibida} unidades de {instance.detalle_orden.producto}"
    )


@receiver(post_save, sender=PagoProveedor)
def actualizar_cuenta_por_pagar(sender, instance, created, **kwargs):
    """
    Actualizar cuenta por pagar cuando se registra un pago
    """
    if not created:
        return
    
    with transaction.atomic():
        cuenta = instance.cuenta_por_pagar
        
        # Sumar todos los pagos de esta cuenta
        total_pagado = sum(
            p.monto for p in cuenta.pagos.all()
        )
        
        cuenta.monto_pagado = total_pagado
        cuenta.actualizar_estado_pago()
        cuenta.save()
        
        logger.info(
            f"Pago registrado: {instance.numero_pago} - "
            f"Monto: {instance.monto} - "
            f"Cuenta: {cuenta.numero_cuenta} - "
            f"Nuevo saldo: {cuenta.saldo}"
        )


@receiver(post_delete, sender=PagoProveedor)
def revertir_pago_proveedor(sender, instance, **kwargs):
    """
    Revertir pago en la cuenta cuando se elimina
    """
    with transaction.atomic():
        movimiento = getattr(instance, 'movimiento_bancario', None)
        if movimiento:
            movimiento.delete()

        cuenta = instance.cuenta_por_pagar
        cuenta.monto_pagado -= instance.monto
        
        if cuenta.monto_pagado < 0:
            cuenta.monto_pagado = Decimal('0.00')
        
        cuenta.actualizar_estado_pago()
        cuenta.save()
        
        logger.warning(
            f"Pago eliminado: {instance.numero_pago} - "
            f"Monto: {instance.monto} - "
            f"Cuenta: {cuenta.numero_cuenta}"
        )
