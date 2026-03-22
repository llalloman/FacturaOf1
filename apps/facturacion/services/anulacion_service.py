from decimal import Decimal

from django.db import transaction
from django.utils import timezone


def _append_observacion_venta(venta, texto):
    observaciones = (venta.observaciones or '').strip()
    if texto in observaciones:
        return
    venta.observaciones = f"{observaciones}\n{texto}".strip() if observaciones else texto
    venta.save(update_fields=['observaciones'])


def _crear_egreso_caja_si_no_existe(venta, pago, factura, nota_credito, usuario):
    from apps.ventas.models import MovimientoCaja

    apertura = venta.apertura_caja
    concepto = f"Reverso anulación factura {factura.numero_factura} - {pago.forma_pago}"
    descripcion = (
        f"Venta {venta.numero_venta}. "
        f"Factura {factura.numero_factura} anulada por NC {nota_credito.comprobante.numero_comprobante}."
    )

    movimiento, creado = MovimientoCaja.objects.get_or_create(
        apertura_caja=apertura,
        tipo=MovimientoCaja.TipoMovimientoChoices.EGRESO,
        monto=pago.monto,
        concepto=concepto,
        descripcion=descripcion,
        defaults={'usuario': usuario},
    )
    return movimiento, creado


def _crear_ajuste_cartera_si_no_existe(cuenta, factura, nota_credito):
    from apps.cartera.models import MovimientoCuentaPorCobrar

    saldo_actual = Decimal(str(cuenta.saldo or '0.00'))
    if saldo_actual <= Decimal('0.00'):
        return None, False

    concepto = f"Anulación factura {factura.numero_factura}"
    referencia = nota_credito.comprobante.numero_comprobante
    notas = (
        f"Ajuste automático por nota de crédito autorizada "
        f"{nota_credito.comprobante.numero_comprobante}."
    )

    movimiento, creado = MovimientoCuentaPorCobrar.objects.get_or_create(
        cuenta=cuenta,
        tipo_movimiento=MovimientoCuentaPorCobrar.TipoMovimientoChoices.CREDITO,
        motivo=MovimientoCuentaPorCobrar.MotivoChoices.ANULACION_FACTURA,
        referencia=referencia,
        defaults={
            'fecha_movimiento': timezone.now().date(),
            'monto': saldo_actual,
            'concepto': concepto,
            'notas': notas,
        },
    )
    return movimiento, creado


@transaction.atomic
def aplicar_anulacion_factura_autorizada(factura, nota_credito, usuario=None):
    """
    Finaliza la anulación contable/operativa de una factura cuando la NC queda AUTORIZADA.
    Es idempotente: puede llamarse varias veces sin duplicar egresos ni ajustes de cartera.
    """
    from apps.facturacion.models import ComprobanteElectronico

    comp = factura.comprobante
    venta = getattr(factura, 'venta', None)
    cuenta = getattr(factura, 'cuenta_por_cobrar', None)

    resumen = {
        'factura_anulada': False,
        'egresos_caja_creados': 0,
        'monto_egresado': Decimal('0.00'),
        'ajuste_cartera_creado': False,
        'monto_ajuste_cartera': Decimal('0.00'),
    }

    if comp.estado != ComprobanteElectronico.EstadoChoices.ANULADO:
        comp.estado = ComprobanteElectronico.EstadoChoices.ANULADO
        comp.save(update_fields=['estado'])
        resumen['factura_anulada'] = True

    if venta:
        pagos_reversables = venta.pagos.exclude(forma_pago='CREDITO')
        usuario_mov = usuario or venta.usuario
        for pago in pagos_reversables:
            _, creado = _crear_egreso_caja_si_no_existe(venta, pago, factura, nota_credito, usuario_mov)
            if creado:
                resumen['egresos_caja_creados'] += 1
                resumen['monto_egresado'] += pago.monto

        _append_observacion_venta(
            venta,
            (
                f"Factura {factura.numero_factura} anulada por nota de crédito "
                f"{nota_credito.comprobante.numero_comprobante}."
            ),
        )

    if cuenta:
        movimiento, creado = _crear_ajuste_cartera_si_no_existe(cuenta, factura, nota_credito)
        if movimiento and creado:
            resumen['ajuste_cartera_creado'] = True
            resumen['monto_ajuste_cartera'] = movimiento.monto

    return resumen
