from django.db import migrations


def firmas_superadmin_only(apps, schema_editor):
    ModuloPermiso = apps.get_model('suscripciones', 'ModuloPermiso')
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')

    ModuloPermiso.objects.filter(modulo='firmas_electronicas').delete()
    ModuloSistema.objects.filter(codigo='firmas_electronicas').update(activo=False)


def restore_firmas_module(apps, schema_editor):
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')
    ModuloSistema.objects.filter(codigo='firmas_electronicas').update(activo=True)


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0008_add_firmas_electronicas_modulo'),
    ]

    operations = [
        migrations.RunPython(firmas_superadmin_only, restore_firmas_module),
    ]
