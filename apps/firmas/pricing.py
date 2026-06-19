from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone
from rest_framework import serializers

from .models import FirmaCuponElectronico, FirmaPrecioElectronica


MONEY = Decimal('0.01')


def money(value):
    return Decimal(value or 0).quantize(MONEY, rounding=ROUND_HALF_UP)


def split_tax(final_price, tax_rate):
    final_price = money(final_price)
    tax_rate = Decimal(tax_rate or 0)
    factor = Decimal('1.00') + (tax_rate / Decimal('100.00'))
    subtotal = money(final_price / factor) if factor else final_price
    return subtotal, money(final_price - subtotal)


def percentage_price(regular_price, tax_rate, percentage):
    subtotal, _ = split_tax(regular_price, tax_rate)
    discounted_subtotal = money(subtotal * (Decimal('1.00') - Decimal(percentage) / Decimal('100.00')))
    tax = money(discounted_subtotal * Decimal(tax_rate or 0) / Decimal('100.00'))
    return money(discounted_subtotal + tax)


def promotion_price(price, discount_type, discount_value):
    if discount_type == 'PERCENTAGE':
        return percentage_price(price.regular_price, price.tax_rate, discount_value)
    return money(discount_value)


def customer_key(identification='', email='', phone=''):
    return str(identification or email or phone or '').strip().upper()


def get_valid_coupon(code, price, customer='', lock=False):
    normalized = str(code or '').strip().upper()
    if not normalized:
        return None

    today = timezone.localdate()
    queryset = FirmaCuponElectronico.objects
    if lock:
        queryset = queryset.select_for_update()
    try:
        coupon = queryset.get(code=normalized)
    except FirmaCuponElectronico.DoesNotExist as exc:
        raise serializers.ValidationError({'coupon_code': 'El cupón ingresado no existe.'}) from exc

    if not coupon.active or not (coupon.start_date <= today <= coupon.end_date):
        raise serializers.ValidationError({'coupon_code': 'El cupón no está vigente.'})
    if coupon.minimum_amount and price.regular_price < coupon.minimum_amount:
        raise serializers.ValidationError({'coupon_code': 'El precio seleccionado no alcanza el monto mínimo del cupón.'})
    if coupon.prices.exists() and not coupon.prices.filter(pk=price.pk).exists():
        raise serializers.ValidationError({'coupon_code': 'El cupón no aplica para la vigencia seleccionada.'})
    if coupon.max_total_uses is not None and coupon.uses.count() >= coupon.max_total_uses:
        raise serializers.ValidationError({'coupon_code': 'El cupón alcanzó su límite de usos.'})
    if customer and coupon.uses.filter(customer_key=customer).count() >= coupon.max_uses_per_customer:
        raise serializers.ValidationError({'coupon_code': 'Este cupón ya alcanzó el límite de usos para el solicitante.'})
    return coupon


def coupon_price(coupon, price):
    if coupon.discount_type == FirmaCuponElectronico.DiscountType.PERCENTAGE:
        return percentage_price(price.regular_price, price.tax_rate, coupon.discount_value)
    return money(max(Decimal('0.01'), price.regular_price - coupon.discount_value))


def resolve_signature_price(validity, coupon_code='', customer='', lock_coupon=False):
    try:
        price = FirmaPrecioElectronica.objects.get(validity=validity, active=True)
    except FirmaPrecioElectronica.DoesNotExist as exc:
        raise serializers.ValidationError({'validity': 'No existe un precio activo para la vigencia seleccionada.'}) from exc

    regular_price = money(price.regular_price)
    promotion = price.active_promotion()
    final_price = money(promotion.promotional_price) if promotion else regular_price
    coupon = get_valid_coupon(coupon_code, price, customer, lock=lock_coupon)
    coupon_candidate = coupon_price(coupon, price) if coupon else None
    applied_coupon = coupon if coupon_candidate is not None and coupon_candidate < final_price else None
    applied_promotion = None if applied_coupon else promotion
    if applied_coupon:
        final_price = coupon_candidate

    subtotal, tax = split_tax(final_price, price.tax_rate)
    return {
        'price': price,
        'promotion': applied_promotion,
        'coupon': applied_coupon,
        'coupon_entered': coupon,
        'regular_price': regular_price,
        'final_price': final_price,
        'discount_amount': money(regular_price - final_price),
        'coupon_discount_amount': money(regular_price - final_price) if applied_coupon else Decimal('0.00'),
        'tax_rate': price.tax_rate,
        'subtotal_without_tax': subtotal,
        'tax_amount': tax,
    }
