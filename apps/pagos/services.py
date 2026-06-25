import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.pagos.models import PagoConfiguracion, PagoOnline

logger = logging.getLogger(__name__)


class PagoOnlineApplicationError(Exception):
    pass


def money(value):
    return Decimal(value or 0).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calcular_recargo_tarjeta(base_amount, fee_percent=None, fee_tax_rate=None):
    base = money(base_amount)
    percent = Decimal(str(fee_percent if fee_percent is not None else getattr(settings, 'PAYPHONE_CARD_FEE_PERCENT', '5'))) / Decimal('100')
    tax_rate = Decimal(str(fee_tax_rate if fee_tax_rate is not None else getattr(settings, 'PAYPHONE_CARD_FEE_TAX_RATE', '15'))) / Decimal('100')
    fee = money(base * percent)
    fee_tax = money(fee * tax_rate)
    return fee, fee_tax, money(base + fee + fee_tax)


def _sanitize_provider_payload(payload):
    data = dict(payload or {})
    data.pop('token', None)
    return data


def _default_empresa():
    empresa_id = str(getattr(settings, 'PAYMENTS_DEFAULT_COMPANY_ID', '') or '').strip()
    if not empresa_id:
        return None
    from apps.empresas.models import Empresa

    return Empresa.objects.filter(pk=empresa_id).first()


def empresa_para_solicitud_firma(solicitud):
    if getattr(solicitud, 'company_id', None):
        return solicitud.company
    customer = getattr(solicitud, 'customer', None)
    if customer and getattr(customer, 'empresa_id', None):
        return customer.empresa
    return _default_empresa()


def obtener_configuracion(empresa):
    if not empresa:
        raise PagoOnlineApplicationError('No se encontró empresa destino para aplicar el pago.')
    config = PagoConfiguracion.objects.filter(empresa=empresa, activo=True).select_related(
        'empresa',
        'cuenta_payphone',
        'caja_ventas',
        'usuario_ventas',
    ).first()
    if not config:
        raise PagoOnlineApplicationError('No existe configuración de pagos online para la empresa destino.')
    return config


def _tipo_identificacion_cliente(solicitud):
    if solicitud.identification_type == 'RUC':
        return '04'
    if solicitud.identification_type == 'PASAPORTE':
        return '06'
    return '05'


def obtener_o_crear_cliente_firma(empresa, solicitud):
    from apps.clientes.models import Cliente

    razon_social = solicitud.business_name or solicitud.full_name or solicitud.identification
    defaults = {
        'tipo_identificacion': _tipo_identificacion_cliente(solicitud),
        'razon_social': razon_social[:300],
        'email': solicitud.email or '',
        'telefono': solicitud.phone or '',
        'celular': solicitud.phone or '',
        'direccion': solicitud.address or '',
        'activo': True,
    }
    cliente, created = Cliente.objects.get_or_create(
        empresa=empresa,
        identificacion=solicitud.identification,
        defaults=defaults,
    )
    updates = []
    for field, value in defaults.items():
        if value and getattr(cliente, field) != value:
            setattr(cliente, field, value)
            updates.append(field)
    if updates:
        updates.append('fecha_modificacion')
        cliente.save(update_fields=updates)
    if not getattr(solicitud, 'customer_id', None):
        solicitud.customer = cliente
        solicitud.save(update_fields=['customer', 'updated_at'])
    return cliente


def _get_or_create_service_product(empresa, code, name, price, aplica_iva=True):
    from apps.productos.models import Producto

    producto, created = Producto.objects.get_or_create(
        empresa=empresa,
        codigo_principal=code,
        defaults={
            'tipo': Producto.TipoChoices.SERVICIO,
            'nombre': name,
            'descripcion': name,
            'precio': money(price),
            'costo': Decimal('0.00'),
            'aplica_iva': aplica_iva,
            'porcentaje_iva': '4' if aplica_iva else '0',
            'maneja_inventario': False,
            'stock_actual': Decimal('0.00'),
            'stock_minimo': Decimal('0.00'),
            'activo': True,
        },
    )
    changed = False
    if producto.tipo != Producto.TipoChoices.SERVICIO:
        producto.tipo = Producto.TipoChoices.SERVICIO
        changed = True
    if producto.maneja_inventario:
        producto.maneja_inventario = False
        changed = True
    if not producto.activo:
        producto.activo = True
        changed = True
    if changed:
        producto.save(update_fields=['tipo', 'maneja_inventario', 'activo', 'fecha_modificacion'])
    return producto


def producto_firma(config, solicitud):
    price_catalog = getattr(solicitud, 'price_catalog', None)
    if price_catalog and getattr(price_catalog, 'producto_erp_id', None):
        producto = price_catalog.producto_erp
        if producto.empresa_id != config.empresa_id:
            raise PagoOnlineApplicationError('El producto ERP de la vigencia de firma no pertenece a la empresa destino.')
        if not producto.activo:
            raise PagoOnlineApplicationError('El producto ERP de la vigencia de firma está inactivo.')
        return producto
    raise PagoOnlineApplicationError(
        'Configura el producto ERP en el precio/vigencia de firma antes de aplicar el pago.'
    )

def _apertura_caja(config):
    from apps.ventas.models import AperturaCaja

    if not config.caja_ventas_id:
        raise PagoOnlineApplicationError('Configura la caja para registrar ventas online.')
    if not config.usuario_ventas_id:
        raise PagoOnlineApplicationError('Configura el usuario para registrar ventas online.')
    if config.caja_ventas.empresa_id != config.empresa_id:
        raise PagoOnlineApplicationError('La caja configurada no pertenece a la empresa del pago.')
    apertura = AperturaCaja.objects.filter(caja=config.caja_ventas, estado=AperturaCaja.EstadoChoices.ABIERTA).first()
    if apertura:
        return apertura
    return AperturaCaja.objects.create(
        caja=config.caja_ventas,
        usuario=config.usuario_ventas,
        estado=AperturaCaja.EstadoChoices.ABIERTA,
        monto_apertura=Decimal('0.00'),
        observaciones='Apertura automática para pagos online.',
    )


def _linea(producto, cantidad, subtotal, iva, total):
    return {
        'producto': producto,
        'cantidad': Decimal(str(cantidad)),
        'precio_unitario': Decimal(str(subtotal)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP),
        'descuento': Decimal('0.00'),
        'subtotal': money(subtotal),
        'iva': money(iva),
        'total': money(total),
        'costo_unitario': Decimal('0.000000'),
        'bodega': None,
    }


def _subtotales_por_iva(lineas):
    subtotal_0 = subtotal_12 = subtotal_15 = Decimal('0.00')
    for linea in lineas:
        producto = linea['producto']
        subtotal = money(linea['subtotal'])
        if getattr(producto, 'porcentaje_iva', '') == '4':
            subtotal_15 += subtotal
        elif getattr(producto, 'porcentaje_iva', '') in ('2',):
            subtotal_12 += subtotal
        else:
            subtotal_0 += subtotal
    return money(subtotal_0), money(subtotal_12), money(subtotal_15)


@transaction.atomic
def aplicar_pago_firma_a_ventas(pago_online, firma_payment):
    from apps.ventas.models import DetalleVenta, PagoVenta, Venta
    from apps.ventas.finance import confirmar_pago_venta, registrar_finanzas_venta

    if pago_online.applied_at and pago_online.venta_id:
        return pago_online

    solicitud = firma_payment.request
    empresa = pago_online.empresa or empresa_para_solicitud_firma(solicitud)
    if empresa and pago_online.empresa_id != empresa.id:
        pago_online.empresa = empresa
        pago_online.save(update_fields=['empresa', 'updated_at'])
    config = obtener_configuracion(empresa)
    if not config.auto_generar_venta_firmas:
        raise PagoOnlineApplicationError('La generación automática de ventas para firmas está desactivada.')
    if not config.cuenta_payphone_id:
        raise PagoOnlineApplicationError('Configura la cuenta bancaria PayPhone para registrar el cobro.')
    if config.cuenta_payphone.empresa_id != config.empresa_id:
        raise PagoOnlineApplicationError('La cuenta PayPhone configurada no pertenece a la empresa del pago.')
    if not config.cuenta_payphone.activa:
        raise PagoOnlineApplicationError('La cuenta PayPhone configurada está inactiva.')

    cliente = obtener_o_crear_cliente_firma(config.empresa, solicitud)
    apertura = _apertura_caja(config)
    firma_product = producto_firma(config, solicitud)
    lineas = [
        _linea(
            firma_product,
            Decimal('1.00'),
            solicitud.subtotal_without_tax or firma_payment.base_amount,
            solicitud.tax_amount or Decimal('0.00'),
            firma_payment.base_amount,
        )
    ]

    subtotal = money(sum((linea['subtotal'] for linea in lineas), Decimal('0.00')))
    iva = money(sum((linea['iva'] for linea in lineas), Decimal('0.00')))
    total = money(sum((linea['total'] for linea in lineas), Decimal('0.00')))
    subtotal_0, subtotal_12, subtotal_15 = _subtotales_por_iva(lineas)

    venta = Venta.objects.create(
        empresa=config.empresa,
        numero_venta=f"V-{uuid.uuid4().hex[:8].upper()}",
        caja=config.caja_ventas,
        apertura_caja=apertura,
        usuario=config.usuario_ventas,
        cliente=cliente,
        tipo_venta=Venta.TipoVentaChoices.MOSTRADOR,
        estado=Venta.EstadoChoices.COMPLETADA,
        subtotal=subtotal,
        descuento=Decimal('0.00'),
        subtotal_0=subtotal_0,
        subtotal_12=subtotal_12,
        subtotal_15=subtotal_15,
        iva=iva,
        total=total,
        genera_factura=False,
        observaciones=(
            f'Venta generada por pago online de firma {solicitud.request_number}. '
            f'Recargo PayPhone registrado en PagoOnline: ${pago_online.processing_fee} + IVA ${pago_online.processing_fee_tax}.'
        ),
        fecha_venta=firma_payment.paid_at or pago_online.confirmed_at or timezone.now(),
    )
    for linea in lineas:
        DetalleVenta.objects.create(venta=venta, **linea)

    pago_venta = PagoVenta.objects.create(
        venta=venta,
        forma_pago=PagoVenta.FormaPagoChoices.TARJETA_CREDITO,
        cuenta_bancaria=config.cuenta_payphone,
        monto=pago_online.total_amount,
        referencia=pago_online.client_transaction_id,
        estado_pago=PagoVenta.EstadoPagoChoices.PENDIENTE,
        fecha_pago=firma_payment.paid_at or pago_online.confirmed_at or timezone.now(),
    )
    registrar_finanzas_venta(venta)
    movimiento = confirmar_pago_venta(
        pago_venta,
        cuenta=config.cuenta_payphone,
        fecha_pago=firma_payment.paid_at or pago_online.confirmed_at or timezone.now(),
        referencia=pago_online.client_transaction_id,
        usuario=config.usuario_ventas,
    )
    pago_online.mark_applied(venta=venta, pago_venta=pago_venta, movimiento=movimiento)
    return pago_online


def registrar_pago_firma_payphone(firma_payment):
    solicitud = firma_payment.request
    empresa = empresa_para_solicitud_firma(solicitud)
    estado = PagoOnline.Estado.APPROVED if firma_payment.status == 'PAID' else PagoOnline.Estado.PENDING
    if firma_payment.status == 'FAILED':
        estado = PagoOnline.Estado.FAILED
    elif firma_payment.status == 'CANCELLED':
        estado = PagoOnline.Estado.CANCELLED

    pago_online, _created = PagoOnline.objects.update_or_create(
        client_transaction_id=firma_payment.client_transaction_id,
        defaults={
            'empresa': empresa,
            'origen': PagoOnline.Origen.FIRMA,
            'origen_id': str(solicitud.id),
            'provider': PagoOnline.Provider.PAYPHONE,
            'metodo': PagoOnline.Metodo.PAYPHONE,
            'estado': estado,
            'currency': firma_payment.currency,
            'base_amount': firma_payment.base_amount,
            'processing_fee': firma_payment.processing_fee,
            'processing_fee_tax': firma_payment.processing_fee_tax,
            'total_amount': firma_payment.amount,
            'provider_transaction_id': firma_payment.provider_transaction_id or '',
            'authorization_code': firma_payment.authorization_code or '',
            'raw_request': _sanitize_provider_payload(firma_payment.raw_request),
            'raw_response': firma_payment.raw_response or {},
            'error_message': firma_payment.error_message or '',
            'confirmed_at': firma_payment.paid_at,
            'metadata': {
                'request_number': solicitud.request_number,
                'request_model': 'firmas.SolicitudFirmaElectronica',
                'payment_model': 'firmas.FirmaPagoElectronico',
                'payment_id': firma_payment.id,
            },
        },
    )
    if firma_payment.status == 'PAID' and not pago_online.applied_at:
        try:
            aplicar_pago_firma_a_ventas(pago_online, firma_payment)
        except Exception as exc:
            logger.exception('No se pudo aplicar pago online de firma a ventas. pago_online_id=%s', pago_online.id)
            pago_online.mark_application_error(exc)
    return pago_online


def registrar_pago_suscripcion_aprobado(pago_suscripcion, *, client_transaction_id, provider='PAYPHONE', raw_response=None):
    suscripcion = pago_suscripcion.suscripcion
    empresa = suscripcion.empresa
    pago_online, _created = PagoOnline.objects.update_or_create(
        client_transaction_id=client_transaction_id,
        defaults={
            'empresa': empresa,
            'origen': PagoOnline.Origen.SUSCRIPCION,
            'origen_id': str(suscripcion.id),
            'provider': provider,
            'metodo': PagoOnline.Metodo.PAYPHONE,
            'estado': PagoOnline.Estado.APPROVED,
            'currency': 'USD',
            'base_amount': pago_suscripcion.monto,
            'total_amount': pago_suscripcion.monto,
            'pago_suscripcion': pago_suscripcion,
            'raw_response': raw_response or {},
            'confirmed_at': timezone.now(),
            'metadata': {
                'subscription_id': suscripcion.id,
                'subscription_payment_id': pago_suscripcion.id,
            },
        },
    )
    if pago_suscripcion.estado != 'APROBADO':
        pago_suscripcion.metodo = 'TARJETA'
        pago_suscripcion.referencia = client_transaction_id
        pago_suscripcion.aprobar()
    return pago_online
