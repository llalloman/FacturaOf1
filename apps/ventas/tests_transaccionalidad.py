"""
Tests de transaccionalidad y concurrencia
"""
import pytest
import threading
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from apps.empresas.models import Empresa, Establecimiento, PuntoEmision
from apps.productos.models import Producto
from apps.clientes.models import Cliente
from apps.inventarios.models import Bodega, StockProducto, MovimientoInventario, TransferenciaInventario, DetalleTransferencia
from apps.ventas.models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta

User = get_user_model()


@pytest.mark.django_db(transaction=True)
class TestTransaccionalidadVentas(TransactionTestCase):
    """Tests de transaccionalidad en ventas"""
    
    def setUp(self):
        # Crear datos de prueba
        self.empresa = Empresa.objects.create(
            ruc='1234567890001',
            razon_social='Empresa Test',
            nombre_comercial='Test',
            ambiente='PRUEBAS'
        )
        
        self.usuario = User.objects.create_user(
            username='test',
            password='test123',
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
            codigo='PROD001',
            nombre='Producto Test',
            precio=Decimal('10.00'),
            costo=Decimal('5.00'),
            activo=True
        )
        
        self.cliente = Cliente.objects.create(
            empresa=self.empresa,
            tipo_identificacion='CONSUMIDOR_FINAL',
            identificacion='9999999999999',
            razon_social='CONSUMIDOR FINAL'
        )
        
        # Stock inicial
        self.stock = StockProducto.objects.create(
            bodega=self.bodega,
            producto=self.producto,
            cantidad_actual=100,
            stock_minimo=10
        )
    
    def test_venta_rollback_en_error(self):
        """Test: Si falla crear detalles, la venta debe revertirse"""
        from django.db import transaction
        
        with pytest.raises(Exception):
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
                    
                    if stock.cantidad_actual < cantidad:
                        raise ValueError('Stock insuficiente')
                    
                    # Crear venta...
                    stock.cantidad_actual -= cantidad
                    stock.save()
            except Exception as e:
                errores.append(str(e))
        
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
        assert stock_final.cantidad_actual >= 0
        assert len(errores) > 0  # Al menos algunos deben haber fallado


@pytest.mark.django_db(transaction=True)
class TestTransaccionalidadTransferencias(TransactionTestCase):
    """Tests de transaccionalidad en transferencias"""
    
    def setUp(self):
        self.empresa = Empresa.objects.create(
            ruc='1234567890001',
            razon_social='Empresa Test',
            nombre_comercial='Test',
            ambiente='PRUEBAS'
        )
        
        self.usuario = User.objects.create_user(
            username='test',
            password='test123',
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
            codigo='PROD001',
            nombre='Producto Test',
            precio=Decimal('10.00'),
            activo=True
        )
        
        # Stock inicial en origen
        self.stock_origen = StockProducto.objects.create(
            bodega=self.bodega_origen,
            producto=self.producto,
            cantidad_actual=100,
            stock_minimo=10
        )
    
    def test_transferencia_stock_insuficiente(self):
        """Test: Transferencia debe fallar si no hay stock suficiente"""
        transferencia = TransferenciaInventario.objects.create(
            bodega_origen=self.bodega_origen,
            bodega_destino=self.bodega_destino,
            usuario=self.usuario,
            estado='PENDIENTE'
        )
        
        DetalleTransferencia.objects.create(
            transferencia=transferencia,
            producto=self.producto,
            cantidad=150,  # Más del stock disponible
            costo_unitario=Decimal('5.00')
        )
        
        # Intentar aprobar debe fallar
        from apps.inventarios.views import TransferenciaInventarioViewSet
        from rest_framework.test import APIRequestFactory
        from rest_framework.request import Request
        
        factory = APIRequestFactory()
        request = factory.post('/aprobar/')
        request.user = self.usuario
        
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
        assert stock_final.cantidad_actual == 100


@pytest.mark.django_db
class TestValidacionesConcurrencia(TestCase):
    """Tests de validaciones y edge cases"""
    
    def test_movimiento_duplicado(self):
        """Test: No debe crear movimientos duplicados para la misma venta"""
        # TODO: Implementar test
        pass
    
    def test_cierre_caja_concurrente(self):
        """Test: No debe cerrar caja dos veces"""
        # TODO: Implementar test
        pass
