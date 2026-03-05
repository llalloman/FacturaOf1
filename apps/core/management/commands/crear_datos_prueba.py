"""
Script para crear datos de prueba en el sistema
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.usuarios.models import Usuario
from apps.empresas.models import Empresa
from apps.suscripciones.models import PlanSuscripcion, Suscripcion
from apps.clientes.models import Cliente
from apps.productos.models import Producto


class Command(BaseCommand):
    help = 'Crea datos de prueba para el sistema'
    
    def handle(self, *args, **kwargs):
        self.stdout.write('Creando datos de prueba...\n')
        
        # Crear Planes de Suscripción
        self.stdout.write('1. Creando planes de suscripción...')
        planes = self._crear_planes()
        self.stdout.write(self.style.SUCCESS(f'✓ {len(planes)} planes creados'))
        
        # Crear Empresa
        self.stdout.write('2. Creando empresa de prueba...')
        empresa = self._crear_empresa()
        self.stdout.write(self.style.SUCCESS(f'✓ Empresa creada: {empresa.razon_social}'))
        
        # Crear Suscripción
        self.stdout.write('3. Creando suscripción...')
        suscripcion = self._crear_suscripcion(empresa, planes[0])
        self.stdout.write(self.style.SUCCESS(f'✓ Suscripción creada'))
        
        # Crear Usuarios
        self.stdout.write('4. Creando usuarios...')
        usuarios = self._crear_usuarios(empresa)
        self.stdout.write(self.style.SUCCESS(f'✓ {len(usuarios)} usuarios creados'))
        
        # Crear Clientes
        self.stdout.write('5. Creando clientes...')
        clientes = self._crear_clientes(empresa)
        self.stdout.write(self.style.SUCCESS(f'✓ {len(clientes)} clientes creados'))
        
        # Crear Productos
        self.stdout.write('6. Creando productos...')
        productos = self._crear_productos(empresa)
        self.stdout.write(self.style.SUCCESS(f'✓ {len(productos)} productos creados'))
        
        self.stdout.write(self.style.SUCCESS('\n✓ Datos de prueba creados exitosamente'))
        self.stdout.write('\n=== CREDENCIALES DE ACCESO ===')
        self.stdout.write('Admin de Empresa:')
        self.stdout.write('  Email: admin@empresa.com')
        self.stdout.write('  Password: admin123')
        self.stdout.write('\nContador:')
        self.stdout.write('  Email: contador@empresa.com')
        self.stdout.write('  Password: contador123')
        self.stdout.write('\n=============================\n')
    
    def _crear_planes(self):
        planes = []
        
        # Plan Básico
        plan, _ = PlanSuscripcion.objects.get_or_create(
            codigo='BASICO_MENSUAL',
            defaults={
                'nombre': 'Plan Básico Mensual',
                'tipo': PlanSuscripcion.TipoPlanChoices.BASICO,
                'periodo': PlanSuscripcion.PeriodoChoices.MENSUAL,
                'precio': Decimal('29.99'),
                'facturas_mensuales': 100,
                'usuarios_permitidos': 2,
                'empresas_permitidas': 1,
                'soporte_prioritario': False,
                'api_access': False,
                'reportes_avanzados': False,
                'descripcion': 'Plan ideal para pequeños negocios'
            }
        )
        planes.append(plan)
        
        # Plan Profesional
        plan, _ = PlanSuscripcion.objects.get_or_create(
            codigo='PROFESIONAL_MENSUAL',
            defaults={
                'nombre': 'Plan Profesional Mensual',
                'tipo': PlanSuscripcion.TipoPlanChoices.PROFESIONAL,
                'periodo': PlanSuscripcion.PeriodoChoices.MENSUAL,
                'precio': Decimal('59.99'),
                'facturas_mensuales': 500,
                'usuarios_permitidos': 5,
                'empresas_permitidas': 1,
                'soporte_prioritario': True,
                'api_access': True,
                'reportes_avanzados': True,
                'descripcion': 'Plan para empresas en crecimiento'
            }
        )
        planes.append(plan)
        
        # Plan Empresarial
        plan, _ = PlanSuscripcion.objects.get_or_create(
            codigo='EMPRESARIAL_ANUAL',
            defaults={
                'nombre': 'Plan Empresarial Anual',
                'tipo': PlanSuscripcion.TipoPlanChoices.EMPRESARIAL,
                'periodo': PlanSuscripcion.PeriodoChoices.ANUAL,
                'precio': Decimal('599.99'),
                'facturas_mensuales': 0,  # Ilimitado
                'usuarios_permitidos': 0,  # Ilimitado
                'empresas_permitidas': 5,
                'soporte_prioritario': True,
                'api_access': True,
                'reportes_avanzados': True,
                'descripcion': 'Plan completo para empresas'
            }
        )
        planes.append(plan)
        
        return planes
    
    def _crear_empresa(self):
        empresa, created = Empresa.objects.get_or_create(
            ruc='1234567890001',
            defaults={
                'razon_social': 'EMPRESA DEMO SAS',
                'nombre_comercial': 'Demo Corporation',
                'tipo_contribuyente': Empresa.TipoContribuyenteChoices.SOCIEDAD,
                'obligado_contabilidad': True,
                'direccion_matriz': 'Av. Principal 123 y Secundaria, Quito, Ecuador',
                'telefono': '022345678',
                'email': 'info@empresademo.com',
                'ambiente': Empresa.AmbienteChoices.PRUEBAS,
                'establecimiento_codigo': '001',
                'punto_emision_codigo': '001',
                'activa': True,
                'verificada': False,
            }
        )
        return empresa
    
    def _crear_suscripcion(self, empresa, plan):
        suscripcion, created = Suscripcion.objects.get_or_create(
            empresa=empresa,
            estado=Suscripcion.EstadoChoices.ACTIVA,
            defaults={
                'plan': plan,
                'fecha_inicio': timezone.now(),
                'fecha_fin': timezone.now() + timedelta(days=30),
                'auto_renovar': True,
            }
        )
        return suscripcion
    
    def _crear_usuarios(self, empresa):
        usuarios = []
        
        # Admin de Empresa
        usuario, created = Usuario.objects.get_or_create(
            email='admin@empresa.com',
            defaults={
                'first_name': 'Admin',
                'last_name': 'Empresa',
                'rol': Usuario.RolChoices.ADMIN_EMPRESA,
                'empresa': empresa,
                'is_active': True,
            }
        )
        if created:
            usuario.set_password('admin123')
            usuario.save()
        usuarios.append(usuario)
        
        # Contador
        usuario, created = Usuario.objects.get_or_create(
            email='contador@empresa.com',
            defaults={
                'first_name': 'María',
                'last_name': 'Contador',
                'rol': Usuario.RolChoices.CONTADOR,
                'empresa': empresa,
                'is_active': True,
            }
        )
        if created:
            usuario.set_password('contador123')
            usuario.save()
        usuarios.append(usuario)
        
        # Vendedor
        usuario, created = Usuario.objects.get_or_create(
            email='vendedor@empresa.com',
            defaults={
                'first_name': 'Carlos',
                'last_name': 'Vendedor',
                'rol': Usuario.RolChoices.VENDEDOR,
                'empresa': empresa,
                'is_active': True,
            }
        )
        if created:
            usuario.set_password('vendedor123')
            usuario.save()
        usuarios.append(usuario)
        
        return usuarios
    
    def _crear_clientes(self, empresa):
        clientes = []
        
        clientes_data = [
            {
                'tipo_identificacion': '05',
                'identificacion': '1234567890',
                'razon_social': 'Juan Pérez Gómez',
                'email': 'juan.perez@email.com',
                'telefono': '0991234567',
                'direccion': 'Quito, Pichincha',
            },
            {
                'tipo_identificacion': '04',
                'identificacion': '1234567890001',
                'razon_social': 'CORPORACIÓN TECNOLÓGICA CIA. LTDA.',
                'nombre_comercial': 'TechCorp',
                'email': 'contacto@techcorp.com',
                'telefono': '022334455',
                'direccion': 'Guayaquil, Guayas',
            },
            {
                'tipo_identificacion': '07',
                'identificacion': '9999999999999',
                'razon_social': 'CONSUMIDOR FINAL',
                'email': '',
                'telefono': '',
                'direccion': '',
            },
        ]
        
        for data in clientes_data:
            cliente, _ = Cliente.objects.get_or_create(
                empresa=empresa,
                identificacion=data['identificacion'],
                defaults=data
            )
            clientes.append(cliente)
        
        return clientes
    
    def _crear_productos(self, empresa):
        productos = []
        
        productos_data = [
            {
                'codigo_principal': 'PROD001',
                'nombre': 'Laptop HP 15"',
                'descripcion': 'Laptop HP 15 pulgadas, 8GB RAM, 256GB SSD',
                'tipo': Producto.TipoChoices.BIEN,
                'precio': Decimal('850.00'),
                'costo': Decimal('650.00'),
                'aplica_iva': True,
                'porcentaje_iva': '2',
                'maneja_inventario': True,
                'stock_actual': Decimal('10.00'),
            },
            {
                'codigo_principal': 'SERV001',
                'nombre': 'Consultoría de Software',
                'descripcion': 'Servicio de consultoría y desarrollo de software',
                'tipo': Producto.TipoChoices.SERVICIO,
                'precio': Decimal('50.00'),
                'aplica_iva': True,
                'porcentaje_iva': '2',
                'maneja_inventario': False,
            },
            {
                'codigo_principal': 'PROD002',
                'nombre': 'Mouse Inalámbrico',
                'descripcion': 'Mouse inalámbrico ergonómico',
                'tipo': Producto.TipoChoices.BIEN,
                'precio': Decimal('15.00'),
                'costo': Decimal('8.00'),
                'aplica_iva': True,
                'porcentaje_iva': '2',
                'maneja_inventario': True,
                'stock_actual': Decimal('50.00'),
            },
        ]
        
        for data in productos_data:
            producto, _ = Producto.objects.get_or_create(
                empresa=empresa,
                codigo_principal=data['codigo_principal'],
                defaults=data
            )
            productos.append(producto)
        
        return productos
