from datetime import timedelta
from decimal import Decimal

from django.utils import timezone


MOVIMIENTO_POR_FORMA_PAGO = {
    'EFECTIVO': 'DEPOSITO',
    'TARJETA_DEBITO': 'DEPOSITO',
    'TARJETA_CREDITO': 'DEPOSITO',
    'TRANSFERENCIA': 'TRANSFERENCIA_ENTRADA',
    'CHEQUE': 'DEPOSITO',
}


def registrar_finanzas_venta(venta):
    """
    Registra los efectos financieros de una venta:
    - pagos de contado -> MovimientoBancario vinculado al PagoVenta.
    - pagos a credito -> CuentaPorCobrar.
    Es idempotente: no duplica movimientos ya vinculados ni cuentas generadas.
    """
    registrar_movimientos_bancarios_venta(venta)
    crear_cartera_credito_venta(venta)


def registrar_movimientos_bancarios_venta(venta):
    from apps.bancos.models import MovimientoBancario

    for pago in venta.pagos.select_related('cuenta_bancaria', 'movimiento_bancario').all():
        if pago.forma_pago == 'CREDITO' or pago.movimiento_bancario_id:
            continue
        if not pago.cuenta_bancaria_id:
            continue
        cuenta = pago.cuenta_bancaria
        if cuenta.empresa_id != venta.empresa_id:
            raise ValueError('La cuenta bancaria no pertenece a la empresa de la venta.')
        if not cuenta.activa:
            raise ValueError('La cuenta bancaria seleccionada está inactiva.')

        movimiento = MovimientoBancario.objects.create(
            cuenta=cuenta,
            fecha=timezone.localdate(pago.fecha_pago or venta.fecha_venta),
            tipo=MOVIMIENTO_POR_FORMA_PAGO.get(pago.forma_pago, 'DEPOSITO'),
            descripcion=f'Cobro venta {venta.numero_venta}',
            referencia=pago.referencia or venta.numero_venta,
            monto=pago.monto,
            conciliado=False,
            beneficiario=getattr(venta.cliente, 'razon_social', '') or '',
            notas=f'Generado automáticamente desde pago de venta {venta.numero_venta}.',
        )
        pago.movimiento_bancario = movimiento
        pago.save(update_fields=['movimiento_bancario'])


def crear_cartera_credito_venta(venta):
    pagos = list(venta.pagos.all())
    monto_credito = sum(
        (pago.monto for pago in pagos if pago.forma_pago == 'CREDITO'),
        Decimal('0.00'),
    )
    if venta.tipo_venta == 'CREDITO' and monto_credito <= 0:
        monto_credito = venta.total
    if monto_credito <= 0:
        return None

    from apps.cartera.models import CuentaPorCobrar

    numero_cuenta = f'VENTA-{venta.numero_venta}'
    fecha_emision = timezone.localdate(venta.fecha_venta)
    fecha_vencimiento = fecha_emision + timedelta(days=30)
    cuenta = CuentaPorCobrar.objects.filter(
        empresa=venta.empresa,
        numero_cuenta=numero_cuenta,
    ).first()
    if cuenta:
        if venta.factura_id and cuenta.factura_id != venta.factura_id:
            cuenta.factura = venta.factura
            cuenta.save(update_fields=['factura'])
        return cuenta

    return CuentaPorCobrar.objects.create(
        empresa=venta.empresa,
        numero_cuenta=numero_cuenta,
        cliente=venta.cliente,
        factura=venta.factura,
        fecha_emision=fecha_emision,
        fecha_vencimiento=fecha_vencimiento,
        monto_total=monto_credito,
        saldo=monto_credito,
        notas=f'Generada automáticamente desde la venta {venta.numero_venta}.',
    )
