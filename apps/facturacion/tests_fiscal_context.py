from django.test import TestCase

from apps.empresas.models import Empresa, Establecimiento, PuntoEmision
from .services.fiscal_context import resolve_fiscal_context


class FiscalContextResolutionTests(TestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1790000000022',
            razon_social='Empresa Emisora',
            direccion_matriz='Matriz',
            telefono='0990000000',
            email='emisora@example.com',
            establecimiento_codigo='001',
            punto_emision_codigo='002',
        )
        self.establecimiento = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo='001',
            nombre='Sucursal Norte',
            direccion='Dirección Norte',
        )
        self.punto = PuntoEmision.objects.create(
            establecimiento=self.establecimiento,
            codigo='002',
            nombre='Caja 002',
        )

    def test_explicit_context_belongs_to_company(self):
        context = resolve_fiscal_context(
            self.empresa,
            establecimiento_id=self.establecimiento.id,
            punto_emision_id=self.punto.id,
        )

        self.assertEqual(context.establecimiento_codigo, '001')
        self.assertEqual(context.punto_emision_codigo, '002')
        self.assertEqual(context.establecimiento.direccion, 'Dirección Norte')

    def test_legacy_context_resolves_existing_default_pair(self):
        context = resolve_fiscal_context(self.empresa)

        self.assertEqual(context.establecimiento, self.establecimiento)
        self.assertEqual(context.punto_emision, self.punto)
