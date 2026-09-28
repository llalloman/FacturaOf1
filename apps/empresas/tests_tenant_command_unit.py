import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django

django.setup()

from django.core.management import CommandError
from django.test import SimpleTestCase, override_settings

from apps.empresas.management.commands.audit_of1_tenant import Command
from apps.empresas.models import Empresa
from apps.empresas.urls import EmpresaSerializer


class AuditOf1TenantSafetyTests(SimpleTestCase):
    def test_company_ruc_is_required_and_is_not_inferred_from_provider_ruc(self):
        with self.assertRaises(CommandError):
            Command().handle(
                ruc='',
                nombre='OF1 Solutions',
                apply=False,
                bootstrap_erp=False,
                user_email='',
                direccion='',
                telefono='',
                email='',
            )

    def test_empresa_serializer_never_returns_certificate_secrets(self):
        self.assertTrue(EmpresaSerializer().fields['certificado_digital'].write_only)
        self.assertTrue(EmpresaSerializer().fields['password_certificado'].write_only)
        self.assertFalse(EmpresaSerializer().fields['tiene_certificado'].write_only)

    def test_certificate_password_helper_stores_ciphertext(self):
        empresa = Empresa()
        empresa.set_password_certificado('clave-de-prueba')
        self.assertNotEqual(empresa.password_certificado, 'clave-de-prueba')
        self.assertEqual(empresa.get_password_certificado(), 'clave-de-prueba')

    @override_settings(DEBUG=False, SRI_AMBIENTE='PRUEBAS')
    def test_apply_is_rejected_when_debug_is_disabled(self):
        with self.assertRaises(CommandError):
            Command().handle(
                ruc='1793231594001',
                nombre='OF1 Solutions',
                apply=True,
                direccion='',
                telefono='',
                email='',
            )

    @override_settings(DEBUG=True, SRI_AMBIENTE='PRODUCCION')
    def test_apply_is_rejected_in_production_ambiente(self):
        with self.assertRaises(CommandError):
            Command().handle(
                ruc='1793231594001',
                nombre='OF1 Solutions',
                apply=True,
                direccion='',
                telefono='',
                email='',
            )
