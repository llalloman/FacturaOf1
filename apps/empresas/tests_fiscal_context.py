from django.test import TestCase
from .models import Empresa, Establecimiento
from .urls import EstablecimientoSerializer, PuntoEmisionSerializer


class FiscalContextSerializerTests(TestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1790000000011',
            razon_social='Empresa Fiscal',
            direccion_matriz='Dirección',
            telefono='0990000000',
            email='fiscal@example.com',
        )
        self.establecimiento = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo='001',
            nombre='Matriz',
            direccion='Dirección matriz',
        )

    def test_establishment_code_requires_three_digits(self):
        serializer = EstablecimientoSerializer(data={
            'codigo': '1',
            'nombre': 'Inválido',
            'direccion': 'Dirección',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('codigo', serializer.errors)

    def test_emission_point_code_requires_three_digits(self):
        serializer = PuntoEmisionSerializer(data={
            'establecimiento': self.establecimiento.id,
            'codigo': 'AB1',
            'nombre': 'Inválido',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('codigo', serializer.errors)
