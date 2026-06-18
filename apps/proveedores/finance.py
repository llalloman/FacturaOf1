def registrar_movimiento_bancario_pago_proveedor(pago):
    """
    Registra el egreso bancario de un pago a proveedor.
    Es idempotente: si el pago ya tiene movimiento vinculado, no duplica.
    """
    if pago.movimiento_bancario_id or pago.forma_pago == 'NOTA_CREDITO':
        return None
    if not pago.cuenta_bancaria_id:
        return None

    cuenta = pago.cuenta_bancaria
    if cuenta.empresa_id != pago.empresa_id:
        raise ValueError('La cuenta bancaria no pertenece a la empresa del pago.')
    if not cuenta.activa:
        raise ValueError('La cuenta bancaria seleccionada está inactiva.')

    from apps.bancos.models import MovimientoBancario

    movimiento = MovimientoBancario.objects.create(
        cuenta=cuenta,
        fecha=pago.fecha_pago,
        tipo='PAGO',
        descripcion=f'Pago proveedor {pago.numero_pago}',
        referencia=pago.numero_documento or pago.numero_pago,
        monto=pago.monto,
        conciliado=False,
        beneficiario=getattr(pago.proveedor, 'razon_social', '') or '',
        notas=f'Generado automáticamente desde pago a proveedor {pago.numero_pago}.',
    )
    pago.movimiento_bancario = movimiento
    pago.save(update_fields=['movimiento_bancario'])
    return movimiento
