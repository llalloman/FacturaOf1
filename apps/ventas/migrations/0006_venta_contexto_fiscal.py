from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('ventas', '0005_pagoventa_estado_pago'),
        ('empresas', '0008_empresa_ruc_proveedor_facturacion_electronica'),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='establecimiento_fiscal',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='ventas', to='empresas.establecimiento',
                verbose_name='establecimiento fiscal',
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='punto_emision_fiscal',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='ventas', to='empresas.puntoemision',
                verbose_name='punto de emisión fiscal',
            ),
        ),
    ]
