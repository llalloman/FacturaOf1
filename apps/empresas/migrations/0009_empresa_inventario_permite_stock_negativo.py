from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('empresas', '0008_empresa_ruc_proveedor_facturacion_electronica'),
    ]

    operations = [
        migrations.AddField(
            model_name='empresa',
            name='inventario_permite_stock_negativo',
            field=models.BooleanField(
                default=True,
                help_text='Política por empresa; el valor global de entorno queda como compatibilidad.',
                verbose_name='permitir stock negativo',
            ),
        ),
    ]
