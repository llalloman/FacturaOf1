"""Flujo integrado de firma: solicitud, cobro, venta y administración."""

from decimal import Decimal
from types import SimpleNamespace

from django.test import TransactionTestCase

from apps.bancos.models import CuentaBancaria, MovimientoBancario
from apps.empresas.models import Empresa
from apps.inventarios.models import Bodega
from apps.pagos.models import PagoConfiguracion, PagoOnline
from apps.productos.models import Producto
from apps.usuarios.models import Usuario
from apps.ventas.models import Caja, Venta

from .models import FirmaPagoElectronico, FirmaPrecioElectronica, SolicitudFirmaElectronica
from .views import SolicitudFirmaElectronicaViewSet
from apps.pagos.services import registrar_pago_firma_transferencia


class SignatureOrderFlowIntegrationTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1790000000201',
            razon_social='OF1 Solutions Pruebas',
            nombre_comercial='OF1 Solutions',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Matriz OF1',
            telefono='0990000201',
            email='of1-pruebas@example.com',
        )
        self.operador = Usuario.objects.create_user(
            email='operador-firmas@example.com',
            password='test123',
            first_name='Operador',
            last_name='Firmas',
            empresa=self.empresa,
            rol='ADMIN_EMPRESA',
        )
        self.platform = Usuario.objects.create_user(
            email='platform-firmas@example.com',
            password='test123',
            first_name='Platform',
            last_name='Admin',
            rol='SUPER_ADMIN',
        )
        self.bodega = Bodega.objects.create(
            empresa=self.empresa, codigo='BOD-FIR', nombre='Bodega firmas', activa=True,
        )
        self.caja = Caja.objects.create(
            empresa=self.empresa, bodega=self.bodega,
            codigo='CAJ-FIR', nombre='Caja firmas', activa=True,
        )
        self.cuenta = CuentaBancaria.objects.create(
            empresa=self.empresa,
            banco='Banco de Pruebas',
            numero_cuenta='0000000201',
            tipo=CuentaBancaria.TipoChoices.CORRIENTE,
            activa=True,
        )
        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_principal='FIRMA-1A',
            nombre='Firma electrónica 1 año',
            tipo=Producto.TipoChoices.SERVICIO,
            precio=Decimal('115.00'),
            costo=Decimal('20.00'),
            aplica_iva=True,
            porcentaje_iva='4',
            maneja_inventario=False,
            activo=True,
        )
        self.precio, _ = FirmaPrecioElectronica.objects.update_or_create(
            validity=SolicitudFirmaElectronica.Vigencia.UN_ANIO,
            defaults={
                'regular_price': Decimal('115.00'),
                'tax_rate': Decimal('15.00'),
                'producto_erp': self.producto,
                'active': True,
            },
        )
        PagoConfiguracion.objects.create(
            empresa=self.empresa,
            cuenta_payphone=self.cuenta,
            caja_ventas=self.caja,
            usuario_ventas=self.operador,
            auto_generar_venta_firmas=True,
            activo=True,
        )
        self.solicitud = SolicitudFirmaElectronica.objects.create(
            company=self.empresa,
            request_type=SolicitudFirmaElectronica.TipoSolicitud.PERSONA_NATURAL,
            identification_type=SolicitudFirmaElectronica.TipoIdentificacion.CEDULA,
            first_name='Ana',
            last_name='Cliente',
            identification='0102030405',
            fingerprint_code='V1234V1234',
            birth_date='1990-01-01',
            nationality='ECUATORIANA',
            gender='MUJER',
            email='ana-firma@example.com',
            phone='0999999901',
            province='Pichincha',
            city='Quito',
            parish='Centro',
            address='Dirección firma',
            validity=SolicitudFirmaElectronica.Vigencia.UN_ANIO,
            container_type=SolicitudFirmaElectronica.Contenedor.ARCHIVO,
            interested_plan=SolicitudFirmaElectronica.PlanInteres.SOLO_FIRMA,
            source=SolicitudFirmaElectronica.Origen.LANDING,
            provider=SolicitudFirmaElectronica.Proveedor.UANATACA,
            price_catalog=self.precio,
            regular_price=Decimal('115.00'),
            subtotal_without_tax=Decimal('100.00'),
            tax_amount=Decimal('15.00'),
            sale_price=Decimal('115.00'),
        )

    def test_public_order_payment_creates_one_sale_and_is_idempotent(self):
        first_payment, first_online = registrar_pago_firma_transferencia(
            self.solicitud,
            cuenta_bancaria=self.cuenta,
            amount=Decimal('115.00'),
            referencia='TR-FIRMA-001',
            usuario=self.operador,
        )

        self.assertEqual(first_payment.status, FirmaPagoElectronico.Estado.PAID)
        self.assertEqual(Venta.objects.filter(empresa=self.empresa).count(), 1)
        self.assertEqual(PagoOnline.objects.filter(empresa=self.empresa).count(), 1)
        first_online.refresh_from_db()
        self.assertIsNotNone(first_online.applied_at)
        self.assertEqual(
            MovimientoBancario.objects.filter(cuenta=self.cuenta, monto=Decimal('115.00')).count(),
            1,
        )

        second_payment, second_online = registrar_pago_firma_transferencia(
            self.solicitud,
            cuenta_bancaria=self.cuenta,
            amount=Decimal('115.00'),
            referencia='TR-FIRMA-001',
            usuario=self.operador,
        )
        self.assertEqual(second_payment.id, first_payment.id)
        self.assertEqual(second_online.id, first_online.id)
        self.assertEqual(Venta.objects.filter(empresa=self.empresa).count(), 1)
        self.assertEqual(PagoOnline.objects.filter(empresa=self.empresa).count(), 1)
        self.assertEqual(
            MovimientoBancario.objects.filter(cuenta=self.cuenta, monto=Decimal('115.00')).count(),
            1,
        )

    def test_platform_administration_can_list_the_company_request(self):
        request = SimpleNamespace(user=self.platform, tenant=None)
        viewset = SolicitudFirmaElectronicaViewSet()
        viewset.request = request

        queryset = viewset.get_queryset()
        self.assertTrue(queryset.filter(pk=self.solicitud.id).exists())
