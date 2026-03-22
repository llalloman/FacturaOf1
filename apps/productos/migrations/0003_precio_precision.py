from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0002_add_imagen_field'),
    ]

    operations = [
        migrations.AlterField(
            model_name='producto',
            name='precio',
            field=models.DecimalField(decimal_places=4, max_digits=12, verbose_name='precio'),
        ),
        migrations.AlterField(
            model_name='producto',
            name='precio_minimo',
            field=models.DecimalField(blank=True, decimal_places=4, help_text='Precio mínimo de venta', max_digits=12, null=True, verbose_name='precio mínimo'),
        ),
    ]
