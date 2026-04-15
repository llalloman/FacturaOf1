from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0002_detalle_precio_precision'),
    ]

    operations = [
        migrations.AddField(
            model_name='detallepedido',
            name='descuento',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12, verbose_name='descuento'),
        ),
    ]
