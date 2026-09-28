from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarios', '0005_movimientoinventario_idempotency'),
    ]

    operations = [
        migrations.AlterField(
            model_name='movimientoinventario',
            name='cantidad',
            field=models.DecimalField(
                decimal_places=2,
                max_digits=12,
                verbose_name='cantidad',
            ),
        ),
    ]
