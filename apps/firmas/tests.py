from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from .models import ConsentimientoFirmaElectronica, FirmaCuponElectronico, FirmaPrecioElectronica, FirmaPromocionElectronica
from .pricing import percentage_price, resolve_signature_price, split_tax
from .serializers import SolicitudFirmaElectronicaPublicSerializer
from .views import crear_solicitud_publica


class SignaturePricingTests(TestCase):
    def setUp(self):
        self.price, _ = FirmaPrecioElectronica.objects.update_or_create(
            validity='1_ANIO',
            defaults={
                'regular_price': Decimal('115.00'),
                'tax_rate': Decimal('15.00'),
                'active': True,
            },
        )
        self.today = timezone.localdate()

    def test_percentage_is_applied_to_base_and_tax_is_recalculated(self):
        self.assertEqual(split_tax(Decimal('115.00'), Decimal('15.00')), (Decimal('100.00'), Decimal('15.00')))
        self.assertEqual(percentage_price(Decimal('115.00'), Decimal('15.00'), Decimal('10.00')), Decimal('103.50'))

    def test_coupon_wins_when_it_has_the_lower_final_price(self):
        FirmaPromocionElectronica.objects.create(
            price=self.price,
            name='Promo 5%',
            discount_type='PERCENTAGE',
            discount_value=Decimal('5.00'),
            promotional_price=Decimal('109.25'),
            start_date=self.today,
            end_date=self.today,
        )
        coupon = FirmaCuponElectronico.objects.create(
            code='firma10',
            name='Cupón 10%',
            discount_type='PERCENTAGE',
            discount_value=Decimal('10.00'),
            start_date=self.today,
            end_date=self.today,
        )

        quote = resolve_signature_price('1_ANIO', 'FIRMA10', '0102030405')

        self.assertEqual(quote['final_price'], Decimal('103.50'))
        self.assertEqual(quote['coupon'], coupon)
        self.assertIsNone(quote['promotion'])

    def test_active_promotion_wins_when_coupon_is_not_better(self):
        promotion = FirmaPromocionElectronica.objects.create(
            price=self.price,
            name='Promo fuerte',
            discount_type='FINAL_PRICE',
            discount_value=Decimal('90.00'),
            promotional_price=Decimal('90.00'),
            start_date=self.today,
            end_date=self.today,
        )
        FirmaCuponElectronico.objects.create(
            code='MENOS5',
            name='Menos cinco',
            discount_type='FIXED_AMOUNT',
            discount_value=Decimal('5.00'),
            start_date=self.today,
            end_date=self.today,
        )

        quote = resolve_signature_price('1_ANIO', 'MENOS5', '0102030405')

        self.assertEqual(quote['final_price'], Decimal('90.00'))
        self.assertEqual(quote['promotion'], promotion)
        self.assertIsNone(quote['coupon'])
        self.assertIsNotNone(quote['coupon_entered'])

    def test_coupon_rejects_a_non_applicable_validity(self):
        other_price, _ = FirmaPrecioElectronica.objects.update_or_create(
            validity='2_ANIOS', defaults={'regular_price': Decimal('200.00'), 'tax_rate': Decimal('15.00'), 'active': True},
        )
        coupon = FirmaCuponElectronico.objects.create(
            code='SOLO2', name='Solo dos años', discount_type='PERCENTAGE', discount_value=Decimal('10.00'),
            start_date=self.today, end_date=self.today + timedelta(days=1),
        )
        coupon.prices.add(other_price)

        with self.assertRaises(ValidationError):
            resolve_signature_price('1_ANIO', 'SOLO2', '0102030405')

    def test_public_request_records_coupon_usage_and_price_snapshot(self):
        coupon = FirmaCuponElectronico.objects.create(
            code='PUBLICO10', name='Público diez', discount_type='PERCENTAGE', discount_value=Decimal('10.00'),
            start_date=self.today, end_date=self.today,
        )
        request = APIRequestFactory().post('/api/firmas/solicitudes-publicas/', {})
        request.user = AnonymousUser()
        serializer = SolicitudFirmaElectronicaPublicSerializer(data={
            'request_type': 'PERSONA_NATURAL', 'identification_type': 'CEDULA',
            'first_name': 'Ana', 'last_name': 'Prueba', 'identification': '0102030405',
            'fingerprint_code': 'V1234V1234', 'birth_date': '1990-01-01',
            'nationality': 'ECUATORIANA', 'gender': 'MUJER', 'email': 'ana@example.com',
            'phone': '0999999999', 'province': 'Pichincha', 'city': 'Quito',
            'address': 'Dirección de prueba', 'validity': '1_ANIO', 'container_type': 'ARCHIVO',
            'wants_erp': False, 'interested_plan': 'SOLO_FIRMA', 'coupon_code': coupon.code,
            'accepted_terms': True, 'accepted_privacy': True,
        }, context={'request': request})
        self.assertTrue(serializer.is_valid(), serializer.errors)

        signature_request = serializer.save()

        self.assertEqual(signature_request.sale_price, Decimal('103.50'))
        self.assertEqual(signature_request.subtotal_without_tax, Decimal('90.00'))
        self.assertEqual(signature_request.tax_amount, Decimal('13.50'))
        self.assertEqual(signature_request.coupon_use.coupon, coupon)

    def test_public_request_requires_explicit_legal_acceptance(self):
        request = APIRequestFactory().post('/api/firmas/solicitudes-publicas/', {})
        request.user = AnonymousUser()
        serializer = SolicitudFirmaElectronicaPublicSerializer(data={
            'request_type': 'PERSONA_NATURAL', 'identification_type': 'CEDULA',
            'first_name': 'Ana', 'last_name': 'Prueba', 'identification': '0102030405',
            'fingerprint_code': 'V1234V1234', 'birth_date': '1990-01-01',
            'nationality': 'ECUATORIANA', 'gender': 'MUJER', 'email': 'ana@example.com',
            'phone': '0999999999', 'province': 'Pichincha', 'city': 'Quito',
            'address': 'Direccion de prueba', 'validity': '1_ANIO', 'container_type': 'ARCHIVO',
            'wants_erp': False, 'interested_plan': 'SOLO_FIRMA',
            'accepted_terms': False, 'accepted_privacy': True,
        }, context={'request': request})

        self.assertFalse(serializer.is_valid())
        self.assertIn('accepted_terms', serializer.errors)

    def test_public_endpoint_records_legal_consent_evidence(self):
        factory = APIRequestFactory()
        request = factory.post('/api/firmas/solicitudes-publicas/', {
            'request_type': 'PERSONA_NATURAL', 'identification_type': 'CEDULA',
            'first_name': 'Ana', 'last_name': 'Prueba', 'identification': '0102030405',
            'fingerprint_code': 'V1234V1234', 'birth_date': '1990-01-01',
            'nationality': 'ECUATORIANA', 'gender': 'MUJER', 'email': 'ana@example.com',
            'phone': '0999999999', 'province': 'Pichincha', 'city': 'Quito',
            'address': 'Direccion de prueba', 'validity': '1_ANIO', 'container_type': 'ARCHIVO',
            'wants_erp': False, 'interested_plan': 'SOLO_FIRMA',
            'accepted_terms': True, 'accepted_privacy': True,
            'terms_version': 'firma-test', 'privacy_version': 'privacidad-test',
        }, format='json', HTTP_USER_AGENT='FacturaOF1 test agent', REMOTE_ADDR='127.0.0.9')

        response = crear_solicitud_publica(request)

        self.assertEqual(response.status_code, 201)
        consent = ConsentimientoFirmaElectronica.objects.get(request_id=response.data['id'])
        self.assertTrue(consent.accepted_terms)
        self.assertTrue(consent.accepted_privacy)
        self.assertEqual(consent.terms_version, 'firma-test')
        self.assertEqual(consent.privacy_version, 'privacidad-test')
        self.assertEqual(consent.user_agent, 'FacturaOF1 test agent')
