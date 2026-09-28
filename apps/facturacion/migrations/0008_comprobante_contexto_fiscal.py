from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('empresas', '0001_initial'),
        ('facturacion', '0007_add_configurado_to_secuencial'),
    ]

    operations = [
        migrations.AddField(
            model_name='comprobanteelectronico',
            name='establecimiento_ref',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='comprobantes',
                to='empresas.establecimiento',
                verbose_name='establecimiento fiscal',
            ),
        ),
        migrations.AddField(
            model_name='comprobanteelectronico',
            name='punto_emision_ref',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='comprobantes',
                to='empresas.puntoemision',
                verbose_name='punto de emisión fiscal',
            ),
        ),
    ]
