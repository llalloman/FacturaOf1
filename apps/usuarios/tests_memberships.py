from django.test import TestCase
from django.test.client import RequestFactory

from apps.empresas.middleware import TenantMiddleware
from apps.empresas.models import Empresa
from apps.core.permissions import IsCompanyAdminOrPlatform, is_platform_user, user_has_module_access
from .models import AccesoPlataforma, EmpresaMembresia, Usuario


class EmpresaMembresiaTests(TestCase):
    def setUp(self):
        self.empresa_a = Empresa.objects.create(
            ruc='1790000000001',
            razon_social='Empresa A',
            direccion_matriz='Dirección A',
            telefono='0990000000',
            email='a@example.com',
        )
        self.empresa_b = Empresa.objects.create(
            ruc='1790000000002',
            razon_social='Empresa B',
            direccion_matriz='Dirección B',
            telefono='0990000001',
            email='b@example.com',
        )
        self.usuario = Usuario.objects.create_user(
            email='operador@example.com',
            password='Password123!',
            empresa=self.empresa_a,
            rol=Usuario.RolChoices.VENDEDOR,
        )

    def test_membership_grants_access_to_second_company(self):
        EmpresaMembresia.objects.create(
            usuario=self.usuario,
            empresa=self.empresa_b,
            rol_empresa=EmpresaMembresia.RolEmpresaChoices.CONSULTOR,
        )

        self.assertTrue(self.usuario.tiene_acceso_empresa(self.empresa_a))
        self.assertTrue(self.usuario.tiene_acceso_empresa(self.empresa_b))

    def test_header_for_non_member_is_rejected_by_tenant_middleware(self):
        request = RequestFactory().get(
            '/api/productos/',
            HTTP_X_EMPRESA_ID=str(self.empresa_b.id),
        )
        request.user = self.usuario
        middleware = TenantMiddleware(lambda _request: None)

        middleware.process_request(request)

        self.assertIsNone(request.tenant)
        self.assertTrue(request.tenant_context_error)

    def test_legacy_company_remains_valid_during_migration(self):
        request = RequestFactory().get(
            '/api/productos/',
            HTTP_X_EMPRESA_ID=str(self.empresa_a.id),
        )
        request.user = self.usuario
        middleware = TenantMiddleware(lambda _request: None)

        middleware.process_request(request)

        self.assertEqual(request.tenant.id, self.empresa_a.id)
        self.assertFalse(request.tenant_context_error)

    def test_membership_module_scope_limits_subscription_access(self):
        EmpresaMembresia.objects.create(
            usuario=self.usuario,
            empresa=self.empresa_b,
            rol_empresa=EmpresaMembresia.RolEmpresaChoices.CONSULTOR,
            modulos=['reportes'],
        )
        self.assertTrue(user_has_module_access(self.usuario, 'reportes', self.empresa_b))
        self.assertFalse(user_has_module_access(self.usuario, 'bancos', self.empresa_b))

    def test_company_admin_permission_uses_active_membership_role(self):
        EmpresaMembresia.objects.create(
            usuario=self.usuario,
            empresa=self.empresa_b,
            rol_empresa=EmpresaMembresia.RolEmpresaChoices.ADMIN_EMPRESA,
        )
        request = RequestFactory().get('/api/bancos/cierres-tesoreria/')
        request.user = self.usuario
        request.tenant = self.empresa_b
        self.assertTrue(IsCompanyAdminOrPlatform().has_permission(request, None))

    def test_platform_access_is_separate_from_company_role(self):
        self.assertFalse(is_platform_user(self.usuario))
        AccesoPlataforma.objects.create(
            usuario=self.usuario,
            rol=AccesoPlataforma.RolChoices.AUDITOR,
            alcances=['auditoria'],
        )
        self.assertTrue(is_platform_user(self.usuario))
        self.assertTrue(is_platform_user(self.usuario, 'auditoria'))
        self.assertFalse(is_platform_user(self.usuario, 'suscripciones'))

    def test_platform_auditor_does_not_gain_company_admin_operations(self):
        AccesoPlataforma.objects.create(
            usuario=self.usuario,
            rol=AccesoPlataforma.RolChoices.AUDITOR,
            alcances=['auditoria'],
        )
        request = RequestFactory().get('/api/bancos/cierres-tesoreria/')
        request.user = self.usuario
        request.tenant = self.empresa_a
        self.assertFalse(IsCompanyAdminOrPlatform().has_permission(request, None))
