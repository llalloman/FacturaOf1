from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0003_precio_precision'),
    ]

    operations = [
        migrations.AlterField(
            model_name='producto',
            name='porcentaje_iva',
            field=models.CharField(
                choices=[
                    ('0', '0%'),
                    ('2', '12%'),
                    ('4', '15%'),
                    ('6', 'No Objeto de Impuesto'),
                    ('7', 'Exento de IVA'),
                ],
                default='4',
                max_length=2,
                verbose_name='porcentaje IVA',
            ),
        ),
    ]
