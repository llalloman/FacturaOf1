from django.db import migrations


DEFAULT_PROVIDER_RUC = '1793231594001'


def backfill_provider_ruc(apps, schema_editor):
    Empresa = apps.get_model('empresas', 'Empresa')
    Empresa.objects.filter(
        ruc_proveedor_facturacion_electronica__isnull=True,
    ).update(ruc_proveedor_facturacion_electronica=DEFAULT_PROVIDER_RUC)
    Empresa.objects.filter(
        ruc_proveedor_facturacion_electronica='',
    ).update(ruc_proveedor_facturacion_electronica=DEFAULT_PROVIDER_RUC)


class Migration(migrations.Migration):
    dependencies = [
        ('empresas', '0010_alter_empresa_inventario_permite_stock_negativo'),
    ]

    operations = [
        migrations.RunPython(backfill_provider_ruc, migrations.RunPython.noop),
    ]
