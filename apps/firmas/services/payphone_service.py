import uuid
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.conf import settings
from django.urls import reverse

from apps.firmas.models import FirmaPagoElectronico


class PayPhoneConfigurationError(Exception):
    pass


class PayPhoneProviderError(Exception):
    pass


def _money_to_cents(value):
    amount = Decimal(value or 0).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
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


def crear_pago_payphone_firma(solicitud, request):
    token = _setting('PAYPHONE_TOKEN')
    store_id = _setting('PAYPHONE_STORE_ID')
    prepare_url = _setting('PAYPHONE_PREPARE_URL')
    timeout = int(_setting('PAYPHONE_TIMEOUT_SECONDS', 20))
    currency = _setting('PAYPHONE_CURRENCY', 'USD')

    if not token:
        raise PayPhoneConfigurationError('Configura PAYPHONE_TOKEN en el entorno del backend.')
    if not store_id:
        raise PayPhoneConfigurationError('Configura PAYPHONE_STORE_ID en el entorno del backend.')
    if not prepare_url:
        raise PayPhoneConfigurationError('Configura PAYPHONE_PREPARE_URL con el endpoint de creación de pago de PayPhone.')
    if not solicitud.sale_price or solicitud.sale_price <= 0:
        raise PayPhoneConfigurationError('La solicitud no tiene un valor de venta válido para cobrar.')

    client_transaction_id = f'FIRMA-{solicitud.request_number}-{uuid.uuid4().hex[:10]}'.replace(' ', '')
    amount = _money_to_cents(solicitud.sale_price)
    tax = _money_to_cents(solicitud.tax_amount)
    amount_with_tax = _money_to_cents(solicitud.subtotal_without_tax) if tax else 0
    amount_without_tax = amount if not tax else 0

    payment = FirmaPagoElectronico.objects.create(
        request=solicitud,
        provider=FirmaPagoElectronico.Provider.PAYPHONE,
        status=FirmaPagoElectronico.Estado.PENDING,
        amount=solicitud.sale_price,
        currency=currency,
        client_transaction_id=client_transaction_id,
    )

    response_path = reverse('payphone-firma-retorno-publico')
    cancel_path = reverse('payphone-firma-cancelado-publico')
    callback_path = reverse('payphone-firma-callback-publico')

    payload = {
        'amount': amount,
        'amountWithTax': amount_with_tax,
        'amountWithoutTax': amount_without_tax,
        'tax': tax,
        'service': 0,
        'tip': 0,
        'currency': currency,
        'clientTransactionId': client_transaction_id,
        'storeId': store_id,
        'reference': solicitud.request_number,
        'description': f'Firma electrónica {solicitud.get_validity_display()} - {solicitud.request_number}',
        'responseUrl': _absolute_url(request, response_path),
        'cancellationUrl': _absolute_url(request, cancel_path),
        'callbackUrl': _absolute_url(request, callback_path),
    }
    payment.raw_request = payload
    payment.save(update_fields=['raw_request', 'updated_at'])

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
