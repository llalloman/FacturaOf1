from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('bancos', '0001_initial'),
        ('proveedores', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagoproveedor',
            name='cuenta_bancaria',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pagos_proveedores',
                to='bancos.cuentabancaria',
                verbose_name='cuenta origen',
            ),
        ),
        migrations.AddField(
            model_name='pagoproveedor',
            name='movimiento_bancario',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pago_proveedor',
                to='bancos.movimientobancario',
                verbose_name='movimiento bancario',
            ),
        ),
    ]
