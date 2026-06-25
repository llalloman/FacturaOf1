from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('firmas', '0012_scrub_payphone_tokens'),
    ]

    operations = [
        migrations.AlterField(
            model_name='firmapagoelectronico',
            name='provider',
            field=models.CharField(choices=[('PAYPHONE', 'PayPhone'), ('TRANSFERENCIA', 'Transferencia bancaria')], default='PAYPHONE', max_length=30, verbose_name='proveedor'),
        ),
    ]
