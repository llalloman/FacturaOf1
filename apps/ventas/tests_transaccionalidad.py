"""
Tests de transaccionalidad y concurrencia
"""
import threading
from types import SimpleNamespace
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase, TransactionTestCase
from django.db import transaction, connections
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from apps.empresas.models import Empresa, Establecimiento, PuntoEmision
from apps.productos.models import Producto
from apps.clientes.models import Cliente
from apps.inventarios.models import Bodega, StockProducto, MovimientoInventario, TransferenciaInventario, DetalleTransferencia
from apps.ventas.models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta

User = get_user_model()


class TestTransaccionalidadVentas(TransactionTestCase):
    """Tests de transaccionalidad en ventas"""
    
    def setUp(self):
        # Crear datos de prueba
        self.empresa = Empresa.objects.create(
            ruc='1234567890001',
            razon_social='Empresa Test',
            nombre_comercial='Test',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Direccion de prueba',
            telefono='0990000000',
            email='test@example.com',
        )
        
        self.usuario = User.objects.create_user(
            email='test@example.com',
            password='test123',
            first_name='Test',
            last_name='User',
            empresa=self.empresa,
            rol='VENDEDOR'
        )
        
        self.bodega = Bodega.objects.create(
            empresa=self.empresa,
            nombre='Bodega Test',
            codigo='BOD001',
            activa=True
        )
        
        self.caja = Caja.objects.create(
            empresa=self.empresa,
            bodega=self.bodega,
            nombre='Caja 1',
            codigo='CAJ001',
            activa=True
        )
        
        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_principal='PROD001',
            nombre='Producto Test',
            precio=Decimal('10.00'),
            costo=Decimal('5.00'),
            activo=True
        )
        
        self.cliente = Cliente.objects.create(
            empresa=self.empresa,
            tipo_identificacion=Cliente.TipoIdentificacionChoices.CONSUMIDOR_FINAL,
            identificacion='9999999999999',
            razon_social='CONSUMIDOR FINAL'
        )
        
        # Stock inicial
        self.stock = StockProducto.objects.create(
            bodega=self.bodega,
            producto=self.producto,
            cantidad=100,
            costo_promedio=Decimal('5.00'),
        )
    
    def test_venta_rollback_en_error(self):
        """Test: Si falla crear detalles, la venta debe revertirse"""
        from django.db import transaction
        
        with self.assertRaises(Exception):
            with transaction.atomic():
                venta = Venta.objects.create(
                    caja=self.caja,
                    usuario=self.usuario,
                    cliente=self.cliente,
                    numero_venta='TEST001',
                    subtotal=Decimal('10.00'),
                    iva=Decimal('1.20'),
                    total=Decimal('11.20'),
                    estado='COMPLETADA'
                )
                
                # Simular error después de crear venta
                raise Exception('Error simulado')
        
        # Verificar que no se creó la venta
        assert Venta.objects.count() == 0
    
    def test_ventas_concurrentes_mismo_producto(self):
        """Test: Ventas concurrentes no deben crear stock negativo"""
        errores = []
        
        def crear_venta(cantidad):
            try:
                with transaction.atomic():
                    # Lock del stock
                    stock = StockProducto.objects.select_for_update().get(
                        bodega=self.bodega,
                        producto=self.producto
                    )
                    
                    if stock.cantidad < cantidad:
                        raise ValueError('Stock insuficiente')
                    
                    # Crear venta...
                    stock.cantidad -= cantidad
                    stock.save()
            except Exception as e:
                errores.append(str(e))
            finally:
                connections.close_all()
        
        # 10 threads intentando vender 15 unidades cada uno (150 total)
        # Solo deberían pasar 6 (6 * 15 = 90, quedarían 10)
        threads = []
        for i in range(10):
            t = threading.Thread(target=crear_venta, args=(15,))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        # Verificar que el stock final sea válido (>= 0)
        stock_final = StockProducto.objects.get(
            bodega=self.bodega,
            producto=self.producto
        )
        assert stock_final.cantidad >= 0
        assert len(errores) > 0  # Al menos algunos deben haber fallado


class TestTransaccionalidadTransferencias(TransactionTestCase):
    """Tests de transaccionalidad en transferencias"""
    
    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1234567890001',
            razon_social='Empresa Test',
            nombre_comercial='Test',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Direccion de transferencia',
            telefono='0990000001',
            email='transfer@example.com',
        )
        
        self.usuario = User.objects.create_user(
            email='transfer@example.com',
            password='test123',
            first_name='Test',
            last_name='Transfer',
            empresa=self.empresa
        )
        
        self.bodega_origen = Bodega.objects.create(
            empresa=self.empresa,
            nombre='Bodega Origen',
            codigo='BOD001',
            activa=True
        )
        
        self.bodega_destino = Bodega.objects.create(
            empresa=self.empresa,
            nombre='Bodega Destino',
            codigo='BOD002',
            activa=True
        )
        
        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_principal='PROD001',
            nombre='Producto Test',
            precio=Decimal('10.00'),
            activo=True
        )
        
        # Stock inicial en origen
        self.stock_origen = StockProducto.objects.create(
            bodega=self.bodega_origen,
            producto=self.producto,
            cantidad=100,
            costo_promedio=Decimal('5.00'),
        )
    
    def test_transferencia_stock_insuficiente(self):
        """Test: Transferencia debe fallar si no hay stock suficiente"""
        transferencia = TransferenciaInventario.objects.create(
            empresa=self.empresa,
            numero_transferencia='TR-TEST-001',
            bodega_origen=self.bodega_origen,
            bodega_destino=self.bodega_destino,
            usuario_envia=self.usuario,
            estado='PENDIENTE'
        )
        
        DetalleTransferencia.objects.create(
            transferencia=transferencia,
            producto=self.producto,
            cantidad_enviada=150
        )
        
        # Intentar aprobar debe fallar
        from apps.inventarios.views import TransferenciaInventarioViewSet
        from rest_framework.test import APIRequestFactory
        from rest_framework.request import Request
        
        factory = APIRequestFactory()
        request = factory.post('/aprobar/')
        request.user = self.usuario
        request.tenant = self.empresa
        
        viewset = TransferenciaInventarioViewSet()
        viewset.request = Request(request)
        
        response = viewset.aprobar(request, pk=transferencia.id)
        
        # Debe fallar con error 400
        assert response.status_code == 400
        assert 'insuficiente' in str(response.data).lower()
        
        # Stock no debe cambiar
        stock_final = StockProducto.objects.get(
            bodega=self.bodega_origen,
            producto=self.producto
        )
        assert stock_final.cantidad == 100


class TestValidacionesConcurrencia(TestCase):
    """Tests de validaciones y edge cases"""

    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1234567890002',
            razon_social='Empresa Concurrencia',
            nombre_comercial='Concurrencia',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Direccion concurrencia',
            telefono='0990000002',
            email='concurrencia@example.com',
        )
        self.usuario = User.objects.create_user(
            email='concurrencia@example.com',
            password='test123',
            empresa=self.empresa,
            rol='ADMIN_EMPRESA',
        )
        self.bodega = Bodega.objects.create(
            empresa=self.empresa, nombre='Bodega', codigo='BOD-C', activa=True,
        )
        self.caja = Caja.objects.create(
            empresa=self.empresa, bodega=self.bodega,
            nombre='Caja', codigo='CAJ-C', activa=True,
        )
        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_principal='PROD-C',
            nombre='Producto concurrencia',
            precio=Decimal('10.00'),
            costo=Decimal('5.00'),
            tipo='BIEN',
            maneja_inventario=True,
            activo=True,
        )
        self.cliente = Cliente.objects.create(
            empresa=self.empresa,
            tipo_identificacion=Cliente.TipoIdentificacionChoices.CONSUMIDOR_FINAL,
            identificacion='9999999999998',
            razon_social='CONSUMIDOR FINAL',
        )
    
    def test_movimiento_duplicado(self):
        """Test: No debe crear movimientos duplicados para la misma venta"""
        apertura = AperturaCaja.objects.create(caja=self.caja, usuario=self.usuario)
        venta = Venta.objects.create(
            empresa=self.empresa,
            caja=self.caja,
            apertura_caja=apertura,
            usuario=self.usuario,
            cliente=self.cliente,
            numero_venta='DUP-001',
            subtotal=Decimal('10.00'),
            subtotal_0=Decimal('0.00'),
            total=Decimal('10.00'),
            estado='COMPLETADA',
        )
        DetalleVenta.objects.create(
            venta=venta,
            producto=self.producto,
            bodega=self.bodega,
            cantidad=Decimal('2.00'),
            precio_unitario=Decimal('10.00'),
            subtotal=Decimal('20.00'),
            total=Decimal('20.00'),
            costo_unitario=Decimal('5.00'),
        )
        from apps.ventas.inventory import registrar_inventario_venta
        registrar_inventario_venta(venta)
        registrar_inventario_venta(venta)
        self.assertEqual(
            MovimientoInventario.objects.filter(
                empresa=self.empresa,
                venta_id=venta.numero_venta,
                tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            ).count(),
            1,
        )
    
    def test_apertura_caja_concurrente(self):
        """Test: No debe abrir la misma caja dos veces"""
        from apps.ventas.serializers import AperturaCajaSerializer
        request = SimpleNamespace(user=self.usuario, tenant=self.empresa)
        primera = AperturaCajaSerializer(
            data={'caja': self.caja.id, 'monto_apertura': '0.00'},
            context={'request': request},
        )
        self.assertTrue(primera.is_valid(), primera.errors)
        primera.save()

        segunda = AperturaCajaSerializer(
            data={'caja': self.caja.id, 'monto_apertura': '0.00'},
            context={'request': request},
        )
        self.assertTrue(segunda.is_valid(), segunda.errors)
        with self.assertRaises(ValidationError):
            segunda.save()


class TestPOSOfflineSync(TestTransaccionalidadVentas):
    """Contrato de sincronización POS: reintentos seguros y rechazos trazables."""

    def setUp(self):
        super().setUp()
        self.producto.maneja_inventario = True
        self.producto.save(update_fields=['maneja_inventario'])

    def _payload(self, *, uuid_value=None, empresa_id=None, cantidad='2.00'):
        # El producto de la clase base usa IVA 15%: 2 x 10 = 20 + 3 IVA.
        return {
            'uuid': uuid_value or 'f4b2b2f0-1d17-4b50-8dd4-5c0c7f1a0001',
            'numero_venta': 'POS-OFF-001',
            'empresa_id': empresa_id or self.empresa.id,
            'caja_id': self.caja.id,
            'usuario_id': self.usuario.id,
            'cliente_id': self.cliente.id,
            'bodega_id': self.bodega.id,
            'fecha_venta': '2026-09-24T15:00:00Z',
            'subtotal': '20.00',
            'descuento': '0.00',
            'iva': '3.00',
            'total': '23.00',
            'detalles': [{
                'producto_id': self.producto.id,
                'cantidad': cantidad,
                'precio_unitario': '10.00',
                'descuento': '0.00',
                'subtotal': '20.00',
                'iva': '3.00',
                'total': '23.00',
            }],
            'pagos': [{
                'forma_pago': 'EFECTIVO',
                'monto': '23.00',
            }],
        }

    def _request(self, tenant=None):
        return SimpleNamespace(
            user=self.usuario,
            tenant=tenant or self.empresa,
        )

    def _open_cash(self):
        return AperturaCaja.objects.create(
            caja=self.caja,
            usuario=self.usuario,
            estado=AperturaCaja.EstadoChoices.ABIERTA,
            monto_apertura=Decimal('0.00'),
        )

    def test_offline_sync_creates_and_duplicate_retry_is_read_only(self):
        self._open_cash()
        payload = self._payload()

        from apps.ventas.serializers import VentaSyncSerializer

        first = VentaSyncSerializer(data=payload, context={'request': self._request()})
        self.assertTrue(first.is_valid(), first.errors)
        venta = first.save()
        self.assertTrue(venta._sync_created)
        self.assertEqual(Venta.objects.filter(uuid=payload['uuid']).count(), 1)
        self.assertEqual(
            MovimientoInventario.objects.filter(
                venta_id=venta.numero_venta,
                tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            ).count(),
            1,
        )

        retry = VentaSyncSerializer(data=payload, context={'request': self._request()})
        self.assertTrue(retry.is_valid(), retry.errors)
        same = retry.save()
        self.assertFalse(same._sync_created)
        self.assertEqual(Venta.objects.filter(uuid=payload['uuid']).count(), 1)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('98.00'))

    def test_offline_sync_rejects_same_uuid_with_different_total(self):
        self._open_cash()
        from apps.ventas.serializers import VentaSyncSerializer

        payload = self._payload()
        first = VentaSyncSerializer(data=payload, context={'request': self._request()})
        self.assertTrue(first.is_valid(), first.errors)
        first.save()

        conflict = dict(payload)
        conflict['total'] = '24.00'
        second = VentaSyncSerializer(data=conflict, context={'request': self._request()})
        self.assertTrue(second.is_valid(), second.errors)
        with self.assertRaises(ValidationError):
            second.save()
        self.assertEqual(Venta.objects.filter(uuid=payload['uuid']).count(), 1)

    def test_offline_sync_rejects_closed_cash_and_cross_company_context(self):
        from apps.ventas.serializers import VentaSyncSerializer

        closed = VentaSyncSerializer(data=self._payload(), context={'request': self._request()})
        self.assertFalse(closed.is_valid())
        self.assertIn('caja_id', closed.errors)

        otra = Empresa.objects.create(
            ruc='1234567890008', razon_social='Otra empresa', nombre_comercial='Otra',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Otra dirección', telefono='0990000008', email='otra@example.com',
        )
        cross = VentaSyncSerializer(
            data=self._payload(empresa_id=otra.id),
            context={'request': self._request()},
        )
        self.assertFalse(cross.is_valid())
        self.assertIn('empresa_id', cross.errors)

    def test_offline_sync_rejects_insufficient_stock_without_side_effects(self):
        self._open_cash()
        self.empresa.inventario_permite_stock_negativo = False
        self.empresa.save(update_fields=['inventario_permite_stock_negativo'])
        from apps.ventas.serializers import VentaSyncSerializer

        payload = self._payload(cantidad='101.00')
        payload['subtotal'] = '1010.00'
        payload['iva'] = '151.50'
        payload['total'] = '1161.50'
        payload['detalles'][0].update({
            'cantidad': '101.00', 'subtotal': '1010.00',
            'iva': '151.50', 'total': '1161.50',
        })
        payload['pagos'][0]['monto'] = '1161.50'
        serializer = VentaSyncSerializer(data=payload, context={'request': self._request()})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(ValueError):
            serializer.save()
        self.assertFalse(Venta.objects.filter(uuid=payload['uuid']).exists())
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, Decimal('100.00'))

    @patch('apps.facturacion.services.factura_service.procesar_factura_sri', side_effect=TimeoutError('SRI timeout'))
    @patch('apps.facturacion.services.factura_service.crear_factura_desde_venta')
    def test_offline_sync_preserves_invoice_intent_when_sri_times_out(self, crear_factura, procesar_sri):
        self._open_cash()
        from apps.ventas.serializers import VentaSyncSerializer

        payload = self._payload(uuid_value='f4b2b2f0-1d17-4b50-8dd4-5c0c7f1a0002')
        payload['genera_factura'] = True
        factura_mock = SimpleNamespace()
        crear_factura.return_value = factura_mock
        procesar_sri.side_effect = TimeoutError('SRI timeout')

        serializer = VentaSyncSerializer(data=payload, context={'request': self._request()})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        venta = serializer.save()

        self.assertTrue(venta.genera_factura)
        self.assertTrue(Venta.objects.filter(uuid=payload['uuid'], genera_factura=True).exists())
        crear_factura.assert_called_once()
        procesar_sri.assert_called_once_with(factura_mock)
