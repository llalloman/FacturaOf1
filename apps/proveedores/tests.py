import pytest
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from apps.usuarios.models import Usuario
from apps.empresas.models import Empresa
from apps.productos.models import Producto, Categoria
from apps.inventarios.models import Bodega, StockProducto, MovimientoInventario
from apps.proveedores.models import (
    Proveedor, OrdenCompra, DetalleOrdenCompra,
    RecepcionCompra, DetalleRecepcion,
    CuentaPorPagar, PagoProveedor
)


@pytest.fixture
def empresa():
    """Fixture para empresa de prueba"""
    return Empresa.objects.create(
        ruc='1234567890001',
        razon_social='Empresa Test S.A.',
        nombre_comercial='Empresa Test',
        activa=True
    )


@pytest.fixture
def usuario_admin(empresa):
    """Fixture para usuario administrador"""
    return Usuario.objects.create_user(
        username='admin',
        email='admin@test.com',
        password='test123',
        empresa=empresa,
        rol='ADMIN_EMPRESA',
        primer_nombre='Admin',
        primer_apellido='Test'
    )


@pytest.fixture
def proveedor(empresa):
    """Fixture para proveedor"""
    return Proveedor.objects.create(
        empresa=empresa,
        tipo_identificacion='RUC',
        identificacion='9876543210001',
        razon_social='Proveedor Test S.A.',
        nombre_comercial='Proveedor Test',
        dias_credito=30,
        limite_credito=Decimal('10000.00')
    )


@pytest.fixture
def categoria(empresa):
    """Fixture para categoría"""
    return Categoria.objects.create(
        empresa=empresa,
        nombre='Electrónica',
        codigo='ELEC'
    )


@pytest.fixture
def producto(empresa, categoria):
    """Fixture para producto"""
    return Producto.objects.create(
        empresa=empresa,
        categoria=categoria,
        codigo='PROD001',
        nombre='Producto Test',
        tipo_producto='BIEN',
        precio_venta=Decimal('100.00'),
        costo=Decimal('50.00'),
        aplica_iva=True
    )


@pytest.fixture
def bodega(empresa):
    """Fixture para bodega"""
    return Bodega.objects.create(
        empresa=empresa,
        codigo='BOD001',
        nombre='Bodega Principal',
        es_principal=True
    )


@pytest.fixture
def client_api(usuario_admin):
    """Fixture para cliente API autenticado"""
    client = APIClient()
    client.force_authenticate(user=usuario_admin)
    return client


@pytest.mark.django_db
class TestProveedorAPI:
    """Tests para API de Proveedores"""
    
    def test_crear_proveedor(self, client_api, empresa):
        """Test crear proveedor"""
        data = {
            'tipo_identificacion': 'RUC',
            'identificacion': '1111111111001',
            'razon_social': 'Nuevo Proveedor S.A.',
            'dias_credito': 15,
            'limite_credito': '5000.00'
        }
        
        response = client_api.post('/api/proveedores/proveedores/', data)
        assert response.status_code == 201
        assert Proveedor.objects.filter(identificacion='1111111111001').exists()
    
    def test_listar_proveedores(self, client_api, proveedor):
        """Test listar proveedores"""
        response = client_api.get('/api/proveedores/proveedores/')
        assert response.status_code == 200
        assert len(response.data['results']) >= 1
    
    def test_estadisticas_proveedor(self, client_api, proveedor):
        """Test obtener estadísticas de proveedor"""
        response = client_api.get(
            f'/api/proveedores/proveedores/{proveedor.id}/estadisticas/'
        )
        assert response.status_code == 200
        assert 'total_ordenes' in response.data
        assert 'total_deuda' in response.data


@pytest.mark.django_db
class TestOrdenCompraAPI:
    """Tests para API de Órdenes de Compra"""
    
    def test_crear_orden_compra(self, client_api, proveedor, producto, bodega):
        """Test crear orden de compra con detalles"""
        data = {
            'proveedor': proveedor.id,
            'bodega_destino': bodega.id,
            'fecha_orden': timezone.now().date().isoformat(),
            'detalles': [
                {
                    'producto': producto.id,
                    'cantidad': '10.00',
                    'precio_unitario': '45.00',
                    'aplica_iva': True,
                    'porcentaje_iva': '15.00'
                }
            ]
        }
        
        response = client_api.post('/api/proveedores/ordenes/', data, format='json')
        assert response.status_code == 201
        
        orden = OrdenCompra.objects.get(id=response.data['id'])
        assert orden.detalles.count() == 1
        assert orden.subtotal > 0
    
    def test_enviar_orden(self, client_api, proveedor, producto, bodega, usuario_admin):
        """Test enviar orden de compra"""
        orden = OrdenCompra.objects.create(
            empresa=usuario_admin.empresa,
            proveedor=proveedor,
            bodega_destino=bodega,
            numero_orden='TEST-001',
            fecha_orden=timezone.now().date(),
            creado_por=usuario_admin,
            estado='BORRADOR'
        )
        
        response = client_api.post(f'/api/proveedores/ordenes/{orden.id}/enviar/')
        assert response.status_code == 200
        
        orden.refresh_from_db()
        assert orden.estado == 'ENVIADA'


@pytest.mark.django_db
class TestRecepcionCompraAPI:
    """Tests para API de Recepciones de Compra"""
    
    @pytest.fixture
    def orden_compra(self, empresa, proveedor, producto, bodega, usuario_admin):
        """Fixture para orden de compra con detalles"""
        orden = OrdenCompra.objects.create(
            empresa=empresa,
            proveedor=proveedor,
            bodega_destino=bodega,
            numero_orden='ORD-001',
            fecha_orden=timezone.now().date(),
            creado_por=usuario_admin,
            estado='ENVIADA'
        )
        
        detalle = DetalleOrdenCompra.objects.create(
            orden_compra=orden,
            producto=producto,
            cantidad=Decimal('20.00'),
            precio_unitario=Decimal('50.00'),
            aplica_iva=True
        )
        detalle.calcular_totales()
        detalle.save()
        
        orden.calcular_totales()
        orden.save()
        
        return orden
    
    def test_crear_recepcion(self, client_api, orden_compra, bodega):
        """Test crear recepción de compra"""
        detalle_orden = orden_compra.detalles.first()
        
        data = {
            'orden_compra': orden_compra.id,
            'bodega': bodega.id,
            'fecha_recepcion': timezone.now().date().isoformat(),
            'detalles': [
                {
                    'detalle_orden': detalle_orden.id,
                    'cantidad_recibida': '10.00',
                    'costo_unitario': '50.00'
                }
            ]
        }
        
        response = client_api.post(
            '/api/proveedores/recepciones/',
            data,
            format='json'
        )
        assert response.status_code == 201
        assert RecepcionCompra.objects.filter(orden_compra=orden_compra).exists()
    
    def test_confirmar_recepcion_actualiza_inventario(
        self, client_api, orden_compra, bodega, producto
    ):
        """Test que confirmar recepción actualiza inventario"""
        detalle_orden = orden_compra.detalles.first()
        
        # Crear recepción
        recepcion = RecepcionCompra.objects.create(
            empresa=orden_compra.empresa,
            orden_compra=orden_compra,
            bodega=bodega,
            numero_recepcion='REC-001',
            fecha_recepcion=timezone.now().date(),
            recibido_por=orden_compra.creado_por,
            estado='BORRADOR'
        )
        
        DetalleRecepcion.objects.create(
            recepcion=recepcion,
            detalle_orden=detalle_orden,
            cantidad_recibida=Decimal('10.00'),
            costo_unitario=Decimal('50.00')
        )
        
        # Stock inicial
        stock_inicial = StockProducto.objects.filter(
            producto=producto,
            bodega=bodega
        ).first()
        cantidad_inicial = stock_inicial.cantidad if stock_inicial else Decimal('0.00')
        
        # Confirmar recepción
        response = client_api.post(
            f'/api/proveedores/recepciones/{recepcion.id}/confirmar/'
        )
        assert response.status_code == 200
        
        # Verificar que se actualizó el inventario
        movimientos = MovimientoInventario.objects.filter(
            producto=producto,
            bodega=bodega,
            tipo_movimiento='ENTRADA_COMPRA'
        )
        assert movimientos.exists()
        
        # Verificar stock
        stock = StockProducto.objects.get(producto=producto, bodega=bodega)
        assert stock.cantidad == cantidad_inicial + Decimal('10.00')
        
        # Verificar que se creó cuenta por pagar
        assert hasattr(recepcion, 'cuenta_por_pagar')


@pytest.mark.django_db
class TestCuentaPorPagarAPI:
    """Tests para API de Cuentas por Pagar"""
    
    @pytest.fixture
    def cuenta_por_pagar(self, empresa, proveedor):
        """Fixture para cuenta por pagar"""
        return CuentaPorPagar.objects.create(
            empresa=empresa,
            proveedor=proveedor,
            numero_cuenta='CP-001',
            fecha_emision=timezone.now().date(),
            fecha_vencimiento=timezone.now().date() + timedelta(days=30),
            monto_total=Decimal('1000.00'),
            saldo=Decimal('1000.00')
        )
    
    def test_listar_cuentas_vencidas(self, client_api, empresa, proveedor):
        """Test listar cuentas vencidas"""
        # Crear cuenta vencida
        CuentaPorPagar.objects.create(
            empresa=empresa,
            proveedor=proveedor,
            numero_cuenta='CP-VENC-001',
            fecha_emision=timezone.now().date() - timedelta(days=40),
            fecha_vencimiento=timezone.now().date() - timedelta(days=10),
            monto_total=Decimal('500.00'),
            saldo=Decimal('500.00')
        )
        
        response = client_api.get('/api/proveedores/cuentas-por-pagar/vencidas/')
        assert response.status_code == 200
        assert len(response.data) >= 1
    
    def test_resumen_cuentas_por_pagar(self, client_api, cuenta_por_pagar):
        """Test resumen de cuentas por pagar"""
        response = client_api.get('/api/proveedores/cuentas-por-pagar/resumen/')
        assert response.status_code == 200
        assert 'total_deuda' in response.data
        assert 'cuentas_pendientes' in response.data


@pytest.mark.django_db
class TestPagoProveedorAPI:
    """Tests para API de Pagos a Proveedores"""
    
    @pytest.fixture
    def cuenta_por_pagar(self, empresa, proveedor):
        """Fixture para cuenta por pagar"""
        return CuentaPorPagar.objects.create(
            empresa=empresa,
            proveedor=proveedor,
            numero_cuenta='CP-002',
            fecha_emision=timezone.now().date(),
            fecha_vencimiento=timezone.now().date() + timedelta(days=30),
            monto_total=Decimal('800.00'),
            saldo=Decimal('800.00')
        )
    
    def test_registrar_pago(self, client_api, cuenta_por_pagar, proveedor):
        """Test registrar pago a proveedor"""
        data = {
            'proveedor': proveedor.id,
            'cuenta_por_pagar': cuenta_por_pagar.id,
            'fecha_pago': timezone.now().date().isoformat(),
            'forma_pago': 'EFECTIVO',
            'monto': '300.00'
        }
        
        response = client_api.post('/api/proveedores/pagos/', data)
        assert response.status_code == 201
        
        # Verificar que se actualizó la cuenta
        cuenta_por_pagar.refresh_from_db()
        assert cuenta_por_pagar.monto_pagado == Decimal('300.00')
        assert cuenta_por_pagar.saldo == Decimal('500.00')
        assert cuenta_por_pagar.estado == 'PARCIAL'
    
    def test_pago_completo_cambia_estado(self, client_api, cuenta_por_pagar, proveedor):
        """Test que pago completo cambia estado a PAGADA"""
        data = {
            'proveedor': proveedor.id,
            'cuenta_por_pagar': cuenta_por_pagar.id,
            'fecha_pago': timezone.now().date().isoformat(),
            'forma_pago': 'TRANSFERENCIA',
            'monto': '800.00'
        }
        
        response = client_api.post('/api/proveedores/pagos/', data)
        assert response.status_code == 201
        
        cuenta_por_pagar.refresh_from_db()
        assert cuenta_por_pagar.estado == 'PAGADA'
        assert cuenta_por_pagar.saldo == Decimal('0.00')
    
    def test_no_permitir_pago_mayor_a_saldo(self, client_api, cuenta_por_pagar, proveedor):
        """Test que no permite pago mayor al saldo"""
        data = {
            'proveedor': proveedor.id,
            'cuenta_por_pagar': cuenta_por_pagar.id,
            'fecha_pago': timezone.now().date().isoformat(),
            'forma_pago': 'EFECTIVO',
            'monto': '1000.00'  # Mayor al saldo
        }
        
        response = client_api.post('/api/proveedores/pagos/', data)
        assert response.status_code == 400
