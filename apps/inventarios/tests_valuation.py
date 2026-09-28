import unittest
from decimal import Decimal

from apps.inventarios.valuation import project_stock
from apps.inventarios.validation import movement_sign_error


class InventoryValuationTests(unittest.TestCase):
    def test_first_receipt_sets_average_cost(self):
        quantity, cost = project_stock('0', '0', '10', '5.25')
        self.assertEqual(quantity, Decimal('10'))
        self.assertEqual(cost, Decimal('5.250000'))

    def test_receipts_use_weighted_average(self):
        quantity, cost = project_stock('10', '5.00', '5', '8.00')
        self.assertEqual(quantity, Decimal('15'))
        self.assertEqual(cost, Decimal('6.000000'))

    def test_sale_does_not_change_average_cost(self):
        quantity, cost = project_stock('15', '6.00', '-3', '6.00')
        self.assertEqual(quantity, Decimal('12'))
        self.assertEqual(cost, Decimal('6.000000'))

    def test_receipt_after_negative_stock_resets_cost_from_new_entry(self):
        quantity, cost = project_stock('-2', '6.00', '5', '9.00')
        self.assertEqual(quantity, Decimal('3'))
        self.assertEqual(cost, Decimal('9.000000'))


class InventoryMovementContractTests(unittest.TestCase):
    def test_positive_receipt_is_valid(self):
        self.assertIsNone(movement_sign_error('ENTRADA_COMPRA', '10'))

    def test_negative_sale_is_valid(self):
        self.assertIsNone(movement_sign_error('SALIDA_VENTA', '-2'))

    def test_zero_is_rejected_for_any_movement(self):
        self.assertIn('cero', movement_sign_error('ENTRADA_COMPRA', '0'))

    def test_entry_cannot_have_negative_quantity(self):
        self.assertIn('positiva', movement_sign_error('DEVOLUCION_ENTRADA', '-1'))

    def test_exit_cannot_have_positive_quantity(self):
        self.assertIn('negativa', movement_sign_error('DEVOLUCION_SALIDA', '1'))
