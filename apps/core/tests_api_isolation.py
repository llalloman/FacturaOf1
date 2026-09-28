"""Pruebas de aislamiento usando ViewSets reales, no solo helpers unitarios."""

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.clientes.models import Cliente
from apps.clientes.urls import ClienteViewSet
from apps.empresas.models import Empresa
from apps.usuarios.models import Usuario


class TenantApiIsolationTests(TestCase):
    def setUp(self):
        self.empresa_a = Empresa.objects.create(
            ruc='1790000000301', razon_social='Empresa A', nombre_comercial='A',
            ambiente=Empresa.AmbienteChoices.PRUEBAS, direccion_matriz='A',
            telefono='0990000301', email='a@example.com',
        )
        self.empresa_b = Empresa.objects.create(
            ruc='1790000000302', razon_social='Empresa B', nombre_comercial='B',
            ambiente=Empresa.AmbienteChoices.PRUEBAS, direccion_matriz='B',
            telefono='0990000302', email='b@example.com',
        )
        self.platform = Usuario.objects.create_user(
            email='platform-isolation@example.com', password='test123',
            first_name='Platform', last_name='Isolation', rol='SUPER_ADMIN',
        )
        self.client_a = Cliente.objects.create(
            empresa=self.empresa_a,
            tipo_identificacion=Cliente.TipoIdentificacionChoices.CEDULA,
            identificacion='0102030301', razon_social='Cliente A',
        )
        self.client_b = Cliente.objects.create(
            empresa=self.empresa_b,
            tipo_identificacion=Cliente.TipoIdentificacionChoices.CEDULA,
            identificacion='0102030302', razon_social='Cliente B',
        )
        self.factory = APIRequestFactory()

    def request(self, method, path, data=None):
        raw = getattr(self.factory, method)(path, data=data or {}, format='json')
        force_authenticate(raw, user=self.platform)
        raw.tenant = self.empresa_a
        return raw

    def test_list_and_export_are_scoped_to_active_company(self):
        list_response = ClienteViewSet.as_view({'get': 'list'})(
            self.request('get', '/api/clientes/')
        )
        self.assertEqual(list_response.status_code, 200)
        rows = list_response.data.get('results', list_response.data)
        self.assertEqual({row['id'] for row in rows}, {self.client_a.id})

        export_response = ClienteViewSet.as_view({'get': 'export_csv'})(
            self.request('get', '/api/clientes/export-csv/')
        )
        self.assertEqual(export_response.status_code, 200)
        csv_text = export_response.content.decode('utf-8-sig')
        self.assertIn('Cliente A', csv_text)
        self.assertNotIn('Cliente B', csv_text)

    def test_retrieve_and_update_reject_ids_from_another_company(self):
        retrieve_response = ClienteViewSet.as_view({'get': 'retrieve'})(
            self.request('get', f'/api/clientes/{self.client_b.id}/'),
            pk=self.client_b.id,
        )
        self.assertEqual(retrieve_response.status_code, 404)

        update_response = ClienteViewSet.as_view({'patch': 'partial_update'})(
            self.request('patch', f'/api/clientes/{self.client_b.id}/', {'razon_social': 'No tocar'}),
            pk=self.client_b.id,
        )
        self.assertEqual(update_response.status_code, 404)
        self.client_b.refresh_from_db()
        self.assertEqual(self.client_b.razon_social, 'Cliente B')
