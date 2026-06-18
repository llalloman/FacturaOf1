from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('bancos', '0001_initial'),
        ('ventas', '0002_detalle_precio_precision'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagoventa',
            name='cuenta_bancaria',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pagos_ventas',
                to='bancos.cuentabancaria',
                verbose_name='cuenta destino',
            ),
        ),
        migrations.AddField(
            model_name='pagoventa',
            name='movimiento_bancario',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pago_venta',
                to='bancos.movimientobancario',
                verbose_name='movimiento bancario',
            ),
        ),
    ]
