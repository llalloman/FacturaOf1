import uuid
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from apps.firmas.models import FirmaPagoElectronico


class PayPhoneConfigurationError(Exception):
    pass


class PayPhoneProviderError(Exception):
    pass


def _money(value):
    return Decimal(value or 0).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _money_to_cents(value):
    amount = _money(value)
    return int(amount * 100)


def _setting(name, default=''):
    return getattr(settings, name, default) or default


def _absolute_url(request, path):
    public_base = _setting('PUBLIC_BASE_URL', '').rstrip('/')
    if public_base:
        return f'{public_base}{path}'
    return request.build_absolute_uri(path)


def _extract_payment_url(data):
    if not isinstance(data, dict):
        return ''
    for key in ('payWithCard', 'paymentUrl', 'payUrl', 'redirectUrl', 'url'):
        value = data.get(key)
        if isinstance(value, str) and value.startswith(('http://', 'https://')):
            return value
    nested = data.get('data')
    if isinstance(nested, dict):
        return _extract_payment_url(nested)
    return ''


def _identification_type(value):
    if value == 'RUC':
        return 2
    if value == 'PASAPORTE':
        return 3
    return 1


def _phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    if not digits:
        return ''
    if digits.startswith('593'):
        return f'+{digits}'
    if digits.startswith('0') and len(digits) == 10:
        return f'+593{digits[1:]}'
    if len(digits) == 9:
        return f'+593{digits}'
    return f'+{digits}' if not str(value).startswith('+') else str(value)


def _calculate_processing_fee(base_amount):
    base = _money(base_amount)
    percent = Decimal(str(_setting('PAYPHONE_CARD_FEE_PERCENT', '5'))) / Decimal('100')
    tax_rate = Decimal(str(_setting('PAYPHONE_CARD_FEE_TAX_RATE', '15'))) / Decimal('100')
    fee = _money(base * percent)
    fee_tax = _money(fee * tax_rate)
    return fee, fee_tax, _money(base + fee + fee_tax)


def _payphone_settings():
    token = _setting('PAYPHONE_TOKEN')
    store_id = _setting('PAYPHONE_STORE_ID')
    timeout = int(_setting('PAYPHONE_TIMEOUT_SECONDS', 20))
    currency = _setting('PAYPHONE_CURRENCY', 'USD')
    if not token:
        raise PayPhoneConfigurationError('Configura PAYPHONE_TOKEN en el entorno del backend.')
    if not store_id:
        raise PayPhoneConfigurationError('Configura PAYPHONE_STORE_ID en el entorno del backend.')
    return token, store_id, timeout, currency


def crear_pago_payphone_firma(solicitud, request):
    """Flujo legacy de link por redirección. Se mantiene por compatibilidad."""
    token, store_id, timeout, currency = _payphone_settings()
    prepare_url = _setting('PAYPHONE_PREPARE_URL')

    if not prepare_url:
        raise PayPhoneConfigurationError('Configura PAYPHONE_PREPARE_URL con el endpoint de creación de pago de PayPhone.')
    if not solicitud.sale_price or solicitud.sale_price <= 0:
        raise PayPhoneConfigurationError('La solicitud no tiene un valor de venta válido para cobrar.')

    payment = crear_pago_payphone_firma_box(solicitud, request)
    payload = dict(payment.raw_request)
    payload.pop('token', None)

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    try:
        response = requests.post(prepare_url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        payment.status = FirmaPagoElectronico.Estado.FAILED
        payment.error_message = str(exc)
        payment.save(update_fields=['status', 'error_message', 'updated_at'])
        raise PayPhoneProviderError(f'No se pudo conectar con PayPhone: {exc}') from exc

    try:
        data = response.json()
    except ValueError:
        data = {'raw': response.text}

    payment.raw_response = data
    if not response.ok:
        payment.status = FirmaPagoElectronico.Estado.FAILED
        payment.error_message = data.get('message') if isinstance(data, dict) else response.text
        payment.save(update_fields=['status', 'raw_response', 'error_message', 'updated_at'])
        raise PayPhoneProviderError(payment.error_message or f'PayPhone respondió HTTP {response.status_code}.')

    payment_url = _extract_payment_url(data)
    provider_transaction_id = ''
    if isinstance(data, dict):
        provider_transaction_id = str(data.get('transactionId') or data.get('id') or data.get('paymentId') or '')

    payment.status = FirmaPagoElectronico.Estado.REDIRECTED if payment_url else FirmaPagoElectronico.Estado.PENDING
    payment.payment_url = payment_url
    payment.provider_transaction_id = provider_transaction_id
    payment.save(update_fields=['status', 'payment_url', 'provider_transaction_id', 'raw_response', 'updated_at'])

    if not payment_url:
        raise PayPhoneProviderError('PayPhone no devolvió una URL de pago reconocible. Revisa el endpoint/configuración del comercio.')

    return payment


def crear_pago_payphone_firma_box(solicitud, request):
    token, store_id, _timeout, currency = _payphone_settings()
    if not solicitud.sale_price or solicitud.sale_price <= 0:
        raise PayPhoneConfigurationError('La solicitud no tiene un valor de venta válido para cobrar.')

    client_transaction_id = f'FIRMA-{solicitud.request_number}-{uuid.uuid4().hex[:8]}'.replace(' ', '')[:50]
    base_amount = _money(solicitud.sale_price)
    fee, fee_tax, total = _calculate_processing_fee(base_amount)
    total_tax = _money((solicitud.tax_amount or 0) + fee_tax)
    total_taxable_base = _money((solicitud.subtotal_without_tax or 0) + fee)

    payload = {
        'token': token,
        'clientTransactionId': client_transaction_id,
        'amount': _money_to_cents(total),
        'amountWithTax': _money_to_cents(total_taxable_base),
        'tax': _money_to_cents(total_tax),
        'amountWithoutTax': 0,
        'service': 0,
        'tip': 0,
        'currency': currency,
        'storeId': store_id,
        'reference': f'Firma electrónica {solicitud.request_number}',
        'lang': 'es',
        'defaultMethod': 'card',
        'timeZone': -5,
        'optionalParameter': solicitud.request_number,
        'email': solicitud.email,
        'phoneNumber': _phone(solicitud.phone),
        'documentId': solicitud.identification,
        'identificationType': _identification_type(solicitud.identification_type),
    }
    response_path = reverse('payphone-firma-retorno-publico')
    cancel_path = reverse('payphone-firma-cancelado-publico')
    payload['responseUrl'] = _absolute_url(request, response_path)
    payload['cancellationUrl'] = _absolute_url(request, cancel_path)

    payment = FirmaPagoElectronico.objects.create(
        request=solicitud,
        provider=FirmaPagoElectronico.Provider.PAYPHONE,
        status=FirmaPagoElectronico.Estado.PENDING,
        amount=total,
        base_amount=base_amount,
        processing_fee=fee,
        processing_fee_tax=fee_tax,
        currency=currency,
        client_transaction_id=client_transaction_id,
        raw_request=payload,
    )
    return payment


def confirmar_pago_payphone_firma(provider_transaction_id, client_transaction_id):
    token, _store_id, timeout, _currency = _payphone_settings()
    confirm_url = _setting('PAYPHONE_CONFIRM_URL', 'https://paymentbox.payphonetodoesposible.com/api/confirm')
    payment = FirmaPagoElectronico.objects.select_related('request').get(
        client_transaction_id=client_transaction_id,
        provider=FirmaPagoElectronico.Provider.PAYPHONE,
    )
    payload = {
        'id': int(provider_transaction_id),
        'clientTxId': client_transaction_id,
    }
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    try:
        response = requests.post(confirm_url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        payment.error_message = str(exc)
        payment.save(update_fields=['error_message', 'updated_at'])
        raise PayPhoneProviderError(f'No se pudo confirmar el pago en PayPhone: {exc}') from exc

    try:
        data = response.json()
    except ValueError:
        data = {'raw': response.text}

    payment.raw_response = data
    payment.provider_transaction_id = str(provider_transaction_id)
    if not response.ok:
        payment.status = FirmaPagoElectronico.Estado.FAILED
        payment.error_message = data.get('message') if isinstance(data, dict) else response.text
        payment.save(update_fields=['status', 'provider_transaction_id', 'raw_response', 'error_message', 'updated_at'])
        raise PayPhoneProviderError(payment.error_message or f'PayPhone respondió HTTP {response.status_code}.')

    status_value = str(
        data.get('status') or data.get('transactionStatus') or data.get('state') or data.get('statusCode') or ''
    ).upper()
    auth_code = str(data.get('authorizationCode') or data.get('authorization') or data.get('authCode') or '')
    if status_value in {'APPROVED', 'PAID', 'SUCCESS', 'OK', '1', '3'} or data.get('statusCode') == 3:
        payment.status = FirmaPagoElectronico.Estado.PAID
        payment.paid_at = timezone.now()
        payment.error_message = ''
    elif status_value in {'CANCELLED', 'CANCELED', 'VOID', '2'}:
        payment.status = FirmaPagoElectronico.Estado.CANCELLED
    else:
        payment.status = FirmaPagoElectronico.Estado.FAILED
        payment.error_message = data.get('message') or data.get('error') or 'PayPhone no aprobó la transacción.'
    payment.authorization_code = auth_code
    payment.save(update_fields=['status', 'provider_transaction_id', 'authorization_code', 'raw_response', 'error_message', 'paid_at', 'updated_at'])
    return payment
