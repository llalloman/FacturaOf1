"""Escenarios integrados del flujo de inventario.

Se mantienen separados de los contratos puros para que puedan ejecutarse con
PostgreSQL de staging y demostrar la interacción entre kardex y proyecciones.
"""

from decimal import Decimal
from types import SimpleNamespace

from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from apps.empresas.models import Empresa
from apps.productos.models import Producto
from apps.clientes.models import Cliente
from apps.usuarios.models import Usuario

from .models import (
    Bodega,
    DetalleTransferencia,
    LoteInventario,
    MovimientoInventario,
    StockProducto,
    TransferenciaInventario,
)
from apps.ventas.models import AperturaCaja, Caja, DetalleVenta, Venta
from apps.ventas.inventory import registrar_inventario_venta
from .serializers import MovimientoInventarioSerializer
from .views import TransferenciaInventarioViewSet


class InventoryFlowIntegrationTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1790000000101',
            razon_social='Inventario Integrado S.A.',
            nombre_comercial='Inventario Integrado',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Matriz inventario',
            telefono='0990000101',
            email='inventario@example.com',
            inventario_permite_stock_negativo=False,
        )
        self.usuario = Usuario.objects.create_user(
            email='inventario@example.com',
            password='test123',
            first_name='Operador',
            last_name='Inventario',
            empresa=self.empresa,
            rol='ADMIN_EMPRESA',
        )
        self.origen = Bodega.objects.create(
            empresa=self.empresa, codigo='BOD-ORI', nombre='Origen', activa=True,
        )
        self.destino = Bodega.objects.create(
            empresa=self.empresa, codigo='BOD-DES', nombre='Destino', activa=True,
        )
        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_principal='INV-001',
            nombre='Producto integrado',
            precio=Decimal('10.00'),
            costo=Decimal('5.00'),
            tipo='BIEN',
            maneja_inventario=True,
            activo=True,
        )
        self.stock_origen = StockProducto.objects.create(
            producto=self.producto,
            bodega=self.origen,
            cantidad=Decimal('10.00'),
            costo_promedio=Decimal('5.000000'),
        )

    def request(self, tenant=None):
        return SimpleNamespace(user=self.usuario, tenant=tenant or self.empresa)

    def movement(self, **overrides):
        data = {
            'producto': self.producto.id,
            'bodega': self.origen.id,
            'tipo_movimiento': MovimientoInventario.TipoMovimientoChoices.ENTRADA_COMPRA,
            'cantidad': '4.00',
            'costo_unitario': '6.000000',
            'documento_referencia': 'COMPRA-001',
            'idempotency_key': 'inventory-receipt-001',
        }
        data.update(overrides)
        serializer = MovimientoInventarioSerializer(
            data=data,
            context={'request': self.request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer

    def test_receipt_updates_kardex_projection_and_reconciliation(self):
        self.movement().save()
        self.stock_origen.refresh_from_db()

        self.assertEqual(self.stock_origen.cantidad, Decimal('14.00'))
        self.assertEqual(
            MovimientoInventario.objects.filter(
                producto=self.producto,
                bodega=self.origen,
            ).count(),
            1,
        )

    def test_retry_is_idempotent_and_return_preserves_sign_contract(self):
        self.movement().save()
        retry = self.movement()
        retry.save()
        self.assertEqual(
            MovimientoInventario.objects.filter(idempotency_key='inventory-receipt-001').count(),
            1,
        )

        returned = self.movement(
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.DEVOLUCION_ENTRADA,
            cantidad='2.00',
            costo_unitario='6.000000',
            documento_referencia='DEV-001',
            idempotency_key='inventory-return-001',
        )
        returned.save()
        self.assertEqual(MovimientoInventario.objects.count(), 2)
        stock = StockProducto.objects.get(producto=self.producto, bodega=self.origen)
        self.assertEqual(stock.cantidad, Decimal('16.00'))

    def test_transfer_dispatch_receive_is_idempotent_and_separates_effects(self):
        transferencia = TransferenciaInventario.objects.create(
            empresa=self.empresa,
            numero_transferencia='TR-INT-001',
            bodega_origen=self.origen,
            bodega_destino=self.destino,
            usuario_envia=self.usuario,
            estado=TransferenciaInventario.EstadoChoices.PENDIENTE,
        )
        DetalleTransferencia.objects.create(
            transferencia=transferencia,
            producto=self.producto,
            cantidad_enviada=Decimal('3.00'),
        )

        factory = APIRequestFactory()
        raw = factory.post('/aprobar/', {})
        raw.user = self.usuario
        raw.tenant = self.empresa
        viewset = TransferenciaInventarioViewSet()
        viewset.request = raw
        viewset.format_kwarg = None

        response = viewset.aprobar(raw, pk=transferencia.id)
        self.assertEqual(response.status_code, 200, response.data)
        transferencia.refresh_from_db()
        self.assertEqual(transferencia.estado, TransferenciaInventario.EstadoChoices.EN_TRANSITO)
        self.assertEqual(
            MovimientoInventario.objects.filter(
                documento_referencia=f'Transferencia #{transferencia.id} - salida',
            ).count(),
            1,
        )
        stock_origen = StockProducto.objects.get(producto=self.producto, bodega=self.origen)
        self.assertEqual(stock_origen.cantidad, Decimal('7.00'))
        self.assertEqual(
            StockProducto.objects.filter(producto=self.producto, bodega=self.destino).first(),
            None,
        )

        receive_response = viewset.recibir(raw, pk=transferencia.id)
        self.assertEqual(receive_response.status_code, 200)
        retry_response = viewset.recibir(raw, pk=transferencia.id)
        self.assertEqual(retry_response.status_code, 200)
        self.assertEqual(
            MovimientoInventario.objects.filter(
                documento_referencia=f'Transferencia #{transferencia.id} - entrada',
            ).count(),
            1,
        )
        stock_destino = StockProducto.objects.get(producto=self.producto, bodega=self.destino)
        self.assertEqual(stock_destino.cantidad, Decimal('3.00'))

    def test_insufficient_stock_and_cross_company_references_are_rejected(self):
        salida = self.movement(
            tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.SALIDA_VENTA,
            cantidad='-11.00',
            costo_unitario='5.000000',
            documento_referencia='VENTA-INSUFICIENTE',
            idempotency_key='inventory-sale-insufficient',
        )
        with self.assertRaises(ValidationError):
            salida.save()
        self.assertFalse(
            MovimientoInventario.objects.filter(idempotency_key='inventory-sale-insufficient').exists()
        )

        otra = Empresa.objects.create(
            ruc='1790000000102',
            razon_social='Otra empresa',
            nombre_comercial='Otra',
            ambiente=Empresa.AmbienteChoices.PRUEBAS,
            direccion_matriz='Otra matriz',
            telefono='0990000102',
            email='otra-inventario@example.com',
        )
        otra_bodega = Bodega.objects.create(empresa=otra, codigo='OTR', nombre='Otra')
        cross = MovimientoInventarioSerializer(
            data={
                'producto': self.producto.id,
                'bodega': otra_bodega.id,
                'tipo_movimiento': 'ENTRADA_COMPRA',
                'cantidad': '1.00',
                'costo_unitario': '5.00',
            },
            context={'request': self.request()},
        )
        self.assertFalse(cross.is_valid())
        self.assertIn('bodega', cross.errors)

    def test_expired_lots_are_skipped_by_fefo(self):
        perecible = Producto.objects.create(
            empresa=self.empresa,
            codigo_principal='INV-EXP',
            nombre='Producto perecible',
            precio=Decimal('8.00'),
            costo=Decimal('3.00'),
            tipo='BIEN',
            maneja_inventario=True,
            controla_caducidad=True,
            exige_lote=True,
            activo=True,
        )
        from datetime import date, timedelta

        vencido = LoteInventario.objects.create(
            empresa=self.empresa,
            producto=perecible,
            bodega=self.origen,
            numero_lote='LOT-EXP',
            fecha_caducidad=date.today() - timedelta(days=1),
            cantidad_disponible=Decimal('4.00'),
            costo_unitario=Decimal('3.00'),
        )
        vigente = LoteInventario.objects.create(
            empresa=self.empresa,
            producto=perecible,
            bodega=self.origen,
            numero_lote='LOT-OK',
            fecha_caducidad=date.today() + timedelta(days=30),
            cantidad_disponible=Decimal('5.00'),
            costo_unitario=Decimal('3.50'),
        )
        StockProducto.objects.create(
            producto=perecible,
            bodega=self.origen,
            cantidad=Decimal('9.00'),
            costo_promedio=Decimal('3.277778'),
        )
        caja = Caja.objects.create(
            empresa=self.empresa,
            bodega=self.origen,
            codigo='CAJ-INV',
            nombre='Caja inventario',
        )
        apertura = AperturaCaja.objects.create(caja=caja, usuario=self.usuario)
        cliente = Cliente.objects.create(
            empresa=self.empresa,
            tipo_identificacion=Cliente.TipoIdentificacionChoices.CONSUMIDOR_FINAL,
            identificacion='9999999999997',
            razon_social='CONSUMIDOR FINAL',
        )
        venta = Venta.objects.create(
            empresa=self.empresa,
            numero_venta='V-FEFO-001',
            caja=caja,
            apertura_caja=apertura,
            usuario=self.usuario,
            cliente=cliente,
            estado=Venta.EstadoChoices.COMPLETADA,
            subtotal=Decimal('24.00'),
            subtotal_0=Decimal('24.00'),
            total=Decimal('24.00'),
        )
        DetalleVenta.objects.create(
            venta=venta,
            producto=perecible,
            bodega=self.origen,
            cantidad=Decimal('3.00'),
            precio_unitario=Decimal('8.00'),
            subtotal=Decimal('24.00'),
            total=Decimal('24.00'),
            costo_unitario=Decimal('3.50'),
        )

        registrar_inventario_venta(venta)
        vencido.refresh_from_db()
        vigente.refresh_from_db()
        self.assertEqual(vencido.cantidad_disponible, Decimal('4.00'))
        self.assertEqual(vigente.cantidad_disponible, Decimal('2.00'))
        movimiento = MovimientoInventario.objects.get(venta_id='V-FEFO-001')
        self.assertEqual(movimiento.lote_id, vigente.id)
