from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pagos', '0003_add_transfer_provider_choice'),
        ('empresas', '0008_empresa_ruc_proveedor_facturacion_electronica'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagoconfiguracion',
            name='establecimiento_fiscal',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='configuraciones_pagos', to='empresas.establecimiento',
                verbose_name='establecimiento fiscal para ventas online',
            ),
        ),
        migrations.AddField(
            model_name='pagoconfiguracion',
            name='punto_emision_fiscal',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='configuraciones_pagos', to='empresas.puntoemision',
                verbose_name='punto de emisión para ventas online',
            ),
        ),
    ]
