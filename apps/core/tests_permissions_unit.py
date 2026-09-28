import unittest

from apps.core.permissions import (
    HasModuleAccess,
    IsCompanyAdminOrPlatform,
    IsTenantUser,
    is_global_platform_user,
    is_platform_user,
    user_has_module_access,
)


class _Access:
    def __init__(self, rol, alcances, activa=True):
        self.rol = rol
        self.alcances = alcances
        self.activa = activa


class _AccessQuery:
    def __init__(self, accesses):
        self.accesses = accesses

    def filter(self, **kwargs):
        return _AccessQuery([
            item for item in self.accesses
            if all(getattr(item, key, None) == value for key, value in kwargs.items())
        ])

    def exists(self):
        return bool(self.accesses)

    def first(self):
        return self.accesses[0] if self.accesses else None

    def __iter__(self):
        return iter(self.accesses)


class _User:
    is_authenticated = True
    is_superuser = False
    rol = 'AUDITOR'

    def __init__(self, accesses):
        self.accesos_plataforma = _AccessQuery(accesses)


class PlatformPermissionUnitTests(unittest.TestCase):
    def test_capability_is_required_for_scoped_platform_role(self):
        user = _User([_Access('AUDITOR', ['auditoria'])])
        self.assertTrue(is_platform_user(user))
        self.assertTrue(is_platform_user(user, 'auditoria'))
        self.assertFalse(is_platform_user(user, 'empresas'))

    def test_inactive_access_is_not_platform_access(self):
        user = _User([_Access('ADMIN_GLOBAL', [], activa=False)])
        self.assertFalse(is_platform_user(user))

    def test_legacy_super_admin_remains_compatible(self):
        user = _User([])
        user.rol = 'SUPER_ADMIN'
        self.assertTrue(is_platform_user(user, 'any-capability'))

    def test_scoped_auditor_does_not_bypass_company_modules(self):
        user = _User([_Access('AUDITOR', ['auditoria'])])
        self.assertFalse(user_has_module_access(user, 'ventas'))

    def test_scoped_platform_access_is_not_global(self):
        user = _User([_Access(rol='AUDITOR', alcances=['auditoria_global'])])
        self.assertFalse(is_global_platform_user(user))

    def test_admin_global_access_is_global(self):
        user = _User([_Access(rol='ADMIN_GLOBAL', alcances=[])])
        self.assertTrue(is_global_platform_user(user))

    def test_global_platform_access_can_bypass_company_modules(self):
        user = _User([_Access('ADMIN_GLOBAL', [])])
        self.assertTrue(user_has_module_access(user, 'ventas'))

    def test_company_admin_permission_uses_selected_company(self):
        empresa = type('Empresa', (), {'id': 20})()
        user = _User([])
        user.membresias = _AccessQuery([type('Membership', (), {
            'empresa': empresa,
            'activa': True,
            'rol_empresa': 'ADMIN_EMPRESA',
        })()])
        request = type('Request', (), {'user': user, 'tenant': empresa})()

        self.assertTrue(IsCompanyAdminOrPlatform().has_permission(request, None))

    def test_company_admin_permission_rejects_membership_for_other_company(self):
        selected = type('Empresa', (), {'id': 20})()
        other = type('Empresa', (), {'id': 21})()
        user = _User([])
        user.membresias = _AccessQuery([type('Membership', (), {
            'empresa': other,
            'activa': True,
            'rol_empresa': 'ADMIN_EMPRESA',
        })()])
        request = type('Request', (), {'user': user, 'tenant': selected})()

        self.assertFalse(IsCompanyAdminOrPlatform().has_permission(request, None))

    def test_tenant_permission_does_not_require_company_for_platform_identity(self):
        user = _User([_Access('AUDITOR', ['auditoria'])])
        request = type('Request', (), {'user': user, 'tenant': None})()

        self.assertTrue(IsTenantUser().has_permission(request, None))

    def test_object_permission_rejects_related_record_from_other_company(self):
        selected = type('Empresa', (), {'id': 20})()
        request = type('Request', (), {'tenant': selected, 'user': _User([])})()
        comprobante = type('Comprobante', (), {'empresa_id': 21})()
        factura = type('Factura', (), {'empresa_id': None, 'comprobante': comprobante})()

        self.assertFalse(HasModuleAccess().has_object_permission(request, None, factura))

    def test_object_permission_accepts_record_from_selected_company(self):
        selected = type('Empresa', (), {'id': 20})()
        request = type('Request', (), {'tenant': selected, 'user': _User([])})()
        producto = type('Producto', (), {'empresa_id': 20})()

        self.assertTrue(HasModuleAccess().has_object_permission(request, None, producto))

    def test_object_permission_keeps_global_consolidated_mode_without_context(self):
        request = type('Request', (), {'tenant': None, 'user': _User([])})()
        other_company_record = type('Record', (), {'empresa_id': 21})()

        self.assertTrue(HasModuleAccess().has_object_permission(request, None, other_company_record))

    def test_object_permission_ignores_missing_reverse_relations(self):
        selected = type('Empresa', (), {'id': 20})()
        request = type('Request', (), {'tenant': selected, 'user': _User([])})()

        class Record:
            empresa_id = None

            @property
            def comprobante(self):
                raise RuntimeError('relation does not exist')

        self.assertTrue(HasModuleAccess().has_object_permission(request, None, Record()))


if __name__ == '__main__':
    unittest.main()
