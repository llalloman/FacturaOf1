from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0005_seccionmodulo_jerarquia'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='modulosistema',
            options={
                'ordering': ['seccion__orden', 'grupo', 'orden', 'label'],
                'verbose_name': 'módulo del sistema',
                'verbose_name_plural': 'módulos del sistema',
            },
        ),
    ]
