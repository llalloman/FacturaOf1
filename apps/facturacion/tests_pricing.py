import unittest
from decimal import Decimal

from apps.facturacion.pricing import calculate_line
from apps.facturacion.constants import RUC_PROVEEDOR_FACTURACION, ruc_proveedor_facturacion


class PricingUnitTests(unittest.TestCase):
    def test_discount_is_applied_once_to_gross_line(self):
        result = calculate_line('2', '100.00', '10.00', '15')

        self.assertEqual(result['precio_total_sin_impuesto'], Decimal('190.00'))
        self.assertEqual(result['valor_impuesto'], Decimal('28.50'))
        self.assertEqual(result['total'], Decimal('218.50'))

    def test_net_value_is_not_used_as_gross_price_with_discount_again(self):
        result = calculate_line('1', '90.00', '10.00', '15')

        # Si la UI enviara 90 como neto y el descuento 10, el contrato fiscal
        # correcto es 80; el cliente debe enviar 100 + 10 para representar 90.
        self.assertEqual(result['precio_total_sin_impuesto'], Decimal('80.00'))
        self.assertEqual(result['total'], Decimal('92.00'))

    def test_zero_rate_keeps_tax_zero(self):
        result = calculate_line('3', '12.345', '0', '0')

        self.assertEqual(result['precio_total_sin_impuesto'], Decimal('37.04'))
        self.assertEqual(result['valor_impuesto'], Decimal('0.00'))

    def test_provider_ruc_uses_of1_default_for_any_company(self):
        empresa = type('Empresa', (), {'ruc_proveedor_facturacion_electronica': ''})()

        self.assertEqual(ruc_proveedor_facturacion(empresa), RUC_PROVEEDOR_FACTURACION)

    def test_provider_ruc_respects_explicit_company_configuration(self):
        empresa = type('Empresa', (), {
            'ruc_proveedor_facturacion_electronica': '0999999999001',
        })()

        self.assertEqual(ruc_proveedor_facturacion(empresa), '0999999999001')


if __name__ == '__main__':
    unittest.main()
