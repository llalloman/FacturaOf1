from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pagos', '0002_remove_pagoconfiguracion_fee_percent_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pagoonline',
            name='provider',
            field=models.CharField(choices=[('PAYPHONE', 'PayPhone'), ('TRANSFERENCIA', 'Transferencia bancaria')], default='PAYPHONE', max_length=30, verbose_name='proveedor'),
        ),
    ]
