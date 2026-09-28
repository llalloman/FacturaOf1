from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('empresas', '0009_empresa_inventario_permite_stock_negativo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='empresa',
            name='inventario_permite_stock_negativo',
            field=models.BooleanField(
                default=True,
                help_text='Company-level policy; the environment flag remains a legacy fallback.',
                verbose_name='allow negative stock',
            ),
        ),
    ]
