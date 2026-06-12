from django.db import migrations, models


MODULOS_BASE = [
    {'codigo': 'dashboard',      'label': 'Dashboard',          'ruta': '/',               'grupo': 'Inicio',                    'icono': 'LayoutDashboard', 'orden': 10},
    {'codigo': 'pos',            'label': 'POS',                'ruta': '/pos',            'grupo': 'Ventas',                    'icono': 'Tablet',          'orden': 10, 'external': True},
    {'codigo': 'cotizaciones',   'label': 'Cotizaciones',       'ruta': '/cotizaciones',   'grupo': 'Ventas',                    'icono': 'ClipboardList',   'orden': 20},
    {'codigo': 'pedidos',        'label': 'Mesas y Pedidos',    'ruta': '/pedidos',        'grupo': 'Ventas',                    'icono': 'LayoutGrid',      'orden': 30},
    {'codigo': 'ventas',         'label': 'Ventas',             'ruta': '/ventas',         'grupo': 'Ventas',                    'icono': 'ShoppingCart',    'orden': 40},
    {'codigo': 'clientes',       'label': 'Clientes',           'ruta': '/clientes',       'grupo': 'Ventas',                    'icono': 'Users',           'orden': 50},
    {'codigo': 'facturacion',    'label': 'Facturas',           'ruta': '/facturacion',    'grupo': 'Facturación Electrónica',   'icono': 'FileText',        'orden': 10},
    {'codigo': 'notas_credito',  'label': 'Notas de Crédito',   'ruta': '/notas-credito',  'grupo': 'Facturación Electrónica',   'icono': 'FileCheck2',      'orden': 20},
    {'codigo': 'notas_debito',   'label': 'Notas de Débito',    'ruta': '/notas-debito',   'grupo': 'Facturación Electrónica',   'icono': 'FileMinus',       'orden': 30},
    {'codigo': 'retenciones',    'label': 'Retenciones',        'ruta': '/retenciones',    'grupo': 'Facturación Electrónica',   'icono': 'Receipt',         'orden': 40},
    {'codigo': 'guias_remision', 'label': 'Guías de Remisión',  'ruta': '/guias-remision', 'grupo': 'Facturación Electrónica',   'icono': 'Truck',           'orden': 50},
    {'codigo': 'productos',      'label': 'Productos',          'ruta': '/productos',      'grupo': 'Inventario',                'icono': 'Package',         'orden': 10},
    {'codigo': 'inventarios',    'label': 'Inventarios',        'ruta': '/inventarios',    'grupo': 'Inventario',                'icono': 'Warehouse',       'orden': 20},
    {'codigo': 'proveedores',    'label': 'Proveedores',        'ruta': '/proveedores',    'grupo': 'Compras',                   'icono': 'ShoppingBag',     'orden': 10},
    {'codigo': 'cartera',        'label': 'Cartera',            'ruta': '/cartera',        'grupo': 'Finanzas',                  'icono': 'Landmark',        'orden': 10},
    {'codigo': 'bancos',         'label': 'Bancos',             'ruta': '/bancos',         'grupo': 'Finanzas',                  'icono': 'Banknote',        'orden': 20},
    {'codigo': 'contabilidad',   'label': 'Contabilidad',       'ruta': '/contabilidad',   'grupo': 'Finanzas',                  'icono': 'BookOpen',        'orden': 30},
    {'codigo': 'declaraciones',  'label': 'Declaraciones SRI',  'ruta': '/declaraciones',  'grupo': 'Finanzas',                  'icono': 'FileBarChart2',   'orden': 40},
    {'codigo': 'nomina',         'label': 'Nómina',             'ruta': '/nomina',         'grupo': 'Finanzas',                  'icono': 'UsersRound',      'orden': 50},
    {'codigo': 'reportes',       'label': 'Reportes',           'ruta': '/reportes',       'grupo': 'Reportes',                  'icono': 'TrendingUp',      'orden': 10},
    {'codigo': 'usuarios',       'label': 'Usuarios',           'ruta': '/usuarios',       'grupo': 'Administración',            'icono': 'Users',           'orden': 10},
    {'codigo': 'configuracion',  'label': 'Configuración',      'ruta': '/configuracion',  'grupo': 'Administración',            'icono': 'Settings',        'orden': 20},
]


def seed_modulos(apps, schema_editor):
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')
    for modulo in MODULOS_BASE:
        defaults = {
            'label': modulo['label'],
            'ruta': modulo['ruta'],
            'grupo': modulo['grupo'],
            'icono': modulo.get('icono', ''),
            'orden': modulo.get('orden', 0),
            'activo': modulo.get('activo', True),
            'external': modulo.get('external', False),
        }
        ModuloSistema.objects.update_or_create(codigo=modulo['codigo'], defaults=defaults)


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0003_modulopermiso'),
    ]

    operations = [
        migrations.CreateModel(
            name='ModuloSistema',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=50, unique=True, verbose_name='código')),
                ('label', models.CharField(max_length=100, verbose_name='etiqueta')),
                ('ruta', models.CharField(max_length=120, verbose_name='ruta')),
                ('grupo', models.CharField(max_length=80, verbose_name='grupo')),
                ('icono', models.CharField(blank=True, max_length=60, verbose_name='icono')),
                ('orden', models.PositiveIntegerField(default=0, verbose_name='orden')),
                ('activo', models.BooleanField(default=True, verbose_name='activo')),
                ('external', models.BooleanField(default=False, verbose_name='abre externo')),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('fecha_modificacion', models.DateTimeField(auto_now=True, verbose_name='fecha de modificación')),
            ],
            options={
                'verbose_name': 'módulo del sistema',
                'verbose_name_plural': 'módulos del sistema',
                'ordering': ['grupo', 'orden', 'label'],
            },
        ),
        migrations.AlterField(
            model_name='modulopermiso',
            name='modulo',
            field=models.CharField(max_length=50, verbose_name='módulo'),
        ),
        migrations.RunPython(seed_modulos, migrations.RunPython.noop),
    ]
