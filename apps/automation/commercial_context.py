from django.utils import timezone

from apps.firmas.models import FirmaCuponElectronico
from apps.firmas.pricing import resolve_signature_price
from rest_framework import serializers


SERVICE_INFO = {
    'company': 'OF1 Solutions',
    'country': 'Ecuador',
    'services': [
        {'code': 'signature', 'name': 'Firma electrónica', 'description': 'Emisión de certificados de firma electrónica para personas y empresas.'},
        {'code': 'erp', 'name': 'FacturaOF1 ERP', 'description': 'Sistema de gestión empresarial para ventas, inventario, clientes y procesos administrativos.'},
        {'code': 'invoicing', 'name': 'Facturación electrónica', 'description': 'Emisión y gestión de comprobantes electrónicos para Ecuador.'},
        {'code': 'custom_software', 'name': 'Desarrollo de software', 'description': 'Desarrollo de sistemas e integraciones según las necesidades del negocio.'},
        {'code': 'automation_ai', 'name': 'Automatización e inteligencia artificial', 'description': 'Automatización de procesos, asistentes y chatbots para atención.'},
        {'code': 'support', 'name': 'Soporte', 'description': 'Atención y asistencia para los productos y servicios de OF1 Solutions.'},
    ],
    'links': {
        'website': 'https://of1solutions.com/',
        'signature_request': 'https://facturaof1.of1solutions.com/solicitar-firma-electronica',
    },
}


def _coupon_remaining(coupon):
    if coupon.max_total_uses is None:
        return None
    return max(coupon.max_total_uses - coupon.uses.count(), 0)


def build_commercial_context():
    today = timezone.localdate()
    plans = []
    for price in FirmaPrecioElectronica.objects.filter(active=True).order_by('order', 'regular_price'):
        promotion = price.active_promotion()
        plans.append({
            'code': price.validity,
            'name': price.get_validity_display(),
            'regular_price': str(price.regular_price),
            'current_price': str(price.current_price),
            'currency': 'USD',
            'price_includes_tax': True,
            'tax_rate': str(price.tax_rate),
            'promotion': ({
                'name': promotion.name,
                'price': str(promotion.promotional_price),
                'starts': promotion.start_date.isoformat(),
                'ends': promotion.end_date.isoformat(),
            } if promotion else None),
        })

    coupons = []
    current_coupons = FirmaCuponElectronico.objects.filter(
        active=True, public_to_ai=True, start_date__lte=today, end_date__gte=today,
    ).prefetch_related('prices').order_by('code')
    for coupon in current_coupons:
        remaining = _coupon_remaining(coupon)
        if remaining == 0:
            continue
        coupons.append({
            'code': coupon.code,
            'name': coupon.name,
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.discount_value),
            'valid_from': coupon.start_date.isoformat(),
            'valid_until': coupon.end_date.isoformat(),
            'minimum_amount': str(coupon.minimum_amount),
            'remaining_total_uses': remaining,
            'plan_codes': list(coupon.prices.values_list('validity', flat=True)),
        })
    return {
        'source_of_truth': 'FacturaOF1',
        'generated_at': timezone.now().isoformat(),
        'channel': 'whatsapp',
        'service_info': SERVICE_INFO,
        'signature_catalog': plans,
        'public_coupons': coupons,
    }


def validate_public_coupon(code, plan_code, customer=''):
    normalized = str(code or '').strip().upper()
    coupon = FirmaCuponElectronico.objects.filter(code=normalized, public_to_ai=True).first()
    if not coupon:
        raise serializers.ValidationError({'code': 'Cupón no válido para esta consulta.'})
    quote = resolve_signature_price(plan_code, normalized, customer)
    if quote['coupon_entered'].pk != coupon.pk:
        raise serializers.ValidationError({'code': 'Cupón no válido para esta consulta.'})
    return quote
