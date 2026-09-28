import unittest

from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.tenant import active_empresa, tenant_queryset
from apps.core.tenant import ActiveCompanyWriteMixin


class _Queryset:
    def __init__(self):
        self.filtered = None
        self.was_none = False

    def filter(self, **kwargs):
        self.filtered = kwargs
        return self

    def none(self):
        self.was_none = True
        return self


class _AccessQuery:
    def __init__(self, items):
        self.items = items

    def filter(self, **kwargs):
        filtered = [item for item in self.items if all(getattr(item, key, None) == value for key, value in kwargs.items())]
        return _AccessQuery(filtered)

    def exists(self):
        return bool(self.items)

    def __iter__(self):
        return iter(self.items)


class _User:
    is_authenticated = True
    is_superuser = False
    rol = 'VENDEDOR'


class TenantScopeUnitTests(unittest.TestCase):
    def test_active_context_takes_precedence_over_legacy_user_company(self):
        legacy = object()
        selected = object()
        user = _User()
        user.empresa = legacy
        request = type('Request', (), {'tenant': selected, 'user': user})()

        self.assertIs(active_empresa(request), selected)

    def test_regular_user_with_selected_context_is_limited_to_that_company(self):
        selected = object()
        request = type('Request', (), {'tenant': selected, 'user': _User()})()
        queryset = _Queryset()

        tenant_queryset(request, queryset)

        self.assertIs(queryset.filtered['empresa'], selected)
        self.assertFalse(queryset.was_none)

    def test_scoped_platform_with_selected_context_is_not_consolidated(self):
        selected = object()
        user = _User()
        user.accesos_plataforma = _AccessQuery([type('Access', (), {
            'activa': True, 'rol': 'AUDITOR', 'alcances': ['auditoria'],
        })()])
        request = type('Request', (), {'tenant': selected, 'user': user})()
        queryset = _Queryset()

        tenant_queryset(request, queryset)

        self.assertIs(queryset.filtered['empresa'], selected)
        self.assertFalse(queryset.was_none)

    def test_platform_without_context_can_query_consolidated_data(self):
        user = _User()
        user.rol = 'SUPER_ADMIN'
        request = type('Request', (), {'tenant': None, 'user': user})()
        queryset = _Queryset()

        tenant_queryset(request, queryset)

        self.assertIsNone(queryset.filtered)
        self.assertFalse(queryset.was_none)

    def test_global_platform_with_legacy_company_is_still_unscoped_without_context(self):
        user = _User()
        user.rol = 'SUPER_ADMIN'
        user.empresa = object()
        request = type('Request', (), {'tenant': None, 'user': user})()

        self.assertIsNone(active_empresa(request))

    def test_scoped_platform_role_cannot_query_all_companies_without_context(self):
        user = _User()
        user.accesos_plataforma = _AccessQuery([type('Access', (), {
            'activa': True, 'rol': 'AUDITOR', 'alcances': ['auditoria'],
        })()])
        request = type('Request', (), {'tenant': None, 'user': user})()
        queryset = _Queryset()

        tenant_queryset(request, queryset)

        self.assertTrue(queryset.was_none)

    def test_regular_user_without_context_gets_empty_queryset(self):
        request = type('Request', (), {'tenant': None, 'user': _User()})()
        queryset = _Queryset()

        tenant_queryset(request, queryset)

        self.assertTrue(queryset.was_none)

    def test_write_mixin_resolves_direct_company_relation(self):
        company = type('Empresa', (), {'id': 20})()
        record = type('Record', (), {'empresa': company})()
        mixin = ActiveCompanyWriteMixin()
        mixin.tenant_relation = 'empresa'
        request = type('Request', (), {'tenant': company, 'user': _User()})()
        mixin.request = request

        self.assertEqual(mixin._instance_empresa_id(record), 20)

    def test_write_mixin_resolves_related_company(self):
        company = type('Empresa', (), {'id': 20})()
        account = type('Cuenta', (), {'empresa_id': 20})()
        record = type('Payment', (), {'cuenta': account})()
        mixin = ActiveCompanyWriteMixin()
        mixin.tenant_relation = 'cuenta'

        self.assertEqual(mixin._instance_empresa_id(record), 20)

    def test_write_mixin_rejects_update_without_explicit_active_company(self):
        company = type('Empresa', (), {'id': 20})()
        record = type('Record', (), {'empresa': company})()
        mixin = ActiveCompanyWriteMixin()
        mixin.tenant_relation = 'empresa'
        mixin.request = type('Request', (), {'tenant': None, 'user': _User()})()

        with self.assertRaises(ValidationError):
            mixin._require_instance_active_empresa(record)

    def test_write_mixin_rejects_update_from_another_company(self):
        selected = type('Empresa', (), {'id': 20})()
        other = type('Empresa', (), {'id': 21})()
        record = type('Record', (), {'empresa': other})()
        mixin = ActiveCompanyWriteMixin()
        mixin.tenant_relation = 'empresa'
        mixin.request = type('Request', (), {'tenant': selected, 'user': _User()})()

        with self.assertRaises(PermissionDenied):
            mixin._require_instance_active_empresa(record)

    def test_write_mixin_accepts_update_from_active_company(self):
        company = type('Empresa', (), {'id': 20})()
        record = type('Record', (), {'empresa': company})()
        mixin = ActiveCompanyWriteMixin()
        mixin.tenant_relation = 'empresa'
        mixin.request = type('Request', (), {'tenant': company, 'user': _User()})()

        self.assertIs(mixin._require_instance_active_empresa(record), company)
