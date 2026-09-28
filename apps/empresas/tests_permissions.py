from django.test import TestCase
from django.test.client import RequestFactory

from apps.empresas.models import Empresa
from apps.usuarios.models import EmpresaMembresia, Usuario
from .urls import IsCompanyAdmin


class CompanyStructurePermissionTests(TestCase):
    def setUp(self):
        self.a = Empresa.objects.create(
            ruc='1790000000401', razon_social='Permisos A', nombre_comercial='A',
            ambiente=Empresa.AmbienteChoices.PRUEBAS, direccion_matriz='A',
            telefono='0990000401', email='perm-a@example.com',
        )
        self.b = Empresa.objects.create(
            ruc='1790000000402', razon_social='Permisos B', nombre_comercial='B',
            ambiente=Empresa.AmbienteChoices.PRUEBAS, direccion_matriz='B',
            telefono='0990000402', email='perm-b@example.com',
        )
        self.user = Usuario.objects.create_user(
            email='admin-permisos@example.com', password='test123',
            first_name='Admin', last_name='Permisos', empresa=self.a,
            rol='ADMIN_EMPRESA',
        )

    def test_legacy_admin_is_limited_to_own_company(self):
        request = RequestFactory().get('/api/empresas/establecimientos/')
        request.user = self.user
        request.tenant = self.a
        self.assertTrue(IsCompanyAdmin().has_permission(request, None))

        request.tenant = self.b
        self.assertFalse(IsCompanyAdmin().has_permission(request, None))

    def test_admin_membership_can_manage_only_active_membership(self):
        EmpresaMembresia.objects.create(
            usuario=self.user, empresa=self.b,
            rol_empresa=EmpresaMembresia.RolEmpresaChoices.ADMIN_EMPRESA,
        )
        request = RequestFactory().get('/api/empresas/establecimientos/')
        request.user = self.user
        request.tenant = self.b
        self.assertTrue(IsCompanyAdmin().has_permission(request, None))

