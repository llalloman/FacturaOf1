from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('bancos', '0001_initial'),
        ('cartera', '0002_movimiento_cuenta_por_cobrar'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagocliente',
            name='cuenta_bancaria',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pagos_clientes',
                to='bancos.cuentabancaria',
                verbose_name='cuenta destino',
            ),
        ),
        migrations.AddField(
            model_name='pagocliente',
            name='movimiento_bancario',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pago_cliente',
                to='bancos.movimientobancario',
                verbose_name='movimiento bancario',
            ),
        ),
    ]
