from django.utils import timezone


MOVIMIENTO_POR_FORMA_PAGO = {
    'EFECTIVO': 'DEPOSITO',
    'TARJETA_DEBITO': 'DEPOSITO',
    'TARJETA_CREDITO': 'DEPOSITO',
    'TRANSFERENCIA': 'TRANSFERENCIA_ENTRADA',
    'CHEQUE': 'DEPOSITO',
    'OTRO': 'DEPOSITO',
}


def registrar_movimiento_bancario_pago_cliente(pago):
    """
    Registra la entrada bancaria de un cobro de cartera.
    Es idempotente: si el pago ya tiene movimiento vinculado, no duplica.
    """
    if pago.movimiento_bancario_id:
        return pago.movimiento_bancario
    if not pago.cuenta_bancaria_id:
        return None

    cuenta_bancaria = pago.cuenta_bancaria
    cuenta_cobrar = pago.cuenta
    if cuenta_bancaria.empresa_id != cuenta_cobrar.empresa_id:
        raise ValueError('La cuenta bancaria no pertenece a la empresa de la cuenta por cobrar.')
    if not cuenta_bancaria.activa:
        raise ValueError('La cuenta bancaria seleccionada esta inactiva.')

    from apps.bancos.models import MovimientoBancario

    movimiento = MovimientoBancario.objects.create(
        cuenta=cuenta_bancaria,
        fecha=timezone.localdate(pago.fecha_pago),
        tipo=MOVIMIENTO_POR_FORMA_PAGO.get(pago.forma_pago, 'DEPOSITO'),
        descripcion=f'Cobro cartera {cuenta_cobrar.numero_cuenta or cuenta_cobrar.id}',
        referencia=pago.referencia or cuenta_cobrar.numero_cuenta or f'CXC-{cuenta_cobrar.id}',
        monto=pago.monto,
        conciliado=False,
        beneficiario=getattr(cuenta_cobrar.cliente, 'razon_social', '') or '',
        notas=f'Generado automaticamente desde cobro de cartera {cuenta_cobrar.numero_cuenta or cuenta_cobrar.id}.',
    )
    pago.movimiento_bancario = movimiento
    pago.save(update_fields=['movimiento_bancario'])
    return movimiento
