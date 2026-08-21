from django.db import migrations


def add_firmador_modulo(apps, schema_editor):
    SeccionModulo = apps.get_model('suscripciones', 'SeccionModulo')
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')

    seccion, _ = SeccionModulo.objects.update_or_create(
        codigo='documentos',
        defaults={'nombre': 'Documentos', 'orden': 6, 'activo': True},
    )
    ModuloSistema.objects.update_or_create(
        codigo='firmador_pdf',
        defaults={
            'seccion': seccion,
            'label': 'Firmador PDF',
            'ruta': '/firmador',
            'grupo': seccion.nombre,
            'icono': 'FileSignature',
            'orden': 1,
            'activo': True,
            'external': False,
        },
    )


def remove_firmador_modulo(apps, schema_editor):
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')
    ModuloSistema.objects.filter(codigo='firmador_pdf').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0010_plansuscripcion_producto_erp'),
    ]

    operations = [
        migrations.RunPython(add_firmador_modulo, remove_firmador_modulo),
    ]

