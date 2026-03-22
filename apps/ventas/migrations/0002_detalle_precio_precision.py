from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='detalleventa',
            name='precio_unitario',
            field=models.DecimalField(decimal_places=6, max_digits=12, verbose_name='precio unitario'),
        ),
    ]
