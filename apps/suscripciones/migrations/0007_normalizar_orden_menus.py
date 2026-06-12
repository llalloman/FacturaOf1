from django.db import migrations


def normalizar_ordenes(apps, schema_editor):
    SeccionModulo = apps.get_model('suscripciones', 'SeccionModulo')
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')

    for index, seccion in enumerate(SeccionModulo.objects.order_by('orden', 'nombre', 'id'), start=1):
        if seccion.orden != index:
            seccion.orden = index
            seccion.save(update_fields=['orden'])

    for seccion in SeccionModulo.objects.order_by('orden', 'nombre', 'id'):
        modulos = ModuloSistema.objects.filter(seccion=seccion).order_by('orden', 'label', 'id')
        for index, modulo in enumerate(modulos, start=1):
            if modulo.orden != index:
                modulo.orden = index
                modulo.save(update_fields=['orden'])

    sin_seccion = ModuloSistema.objects.filter(seccion__isnull=True).order_by('grupo', 'orden', 'label', 'id')
    grupo_actual = None
    index = 0
    for modulo in sin_seccion:
        if modulo.grupo != grupo_actual:
            grupo_actual = modulo.grupo
            index = 1
        else:
            index += 1
        if modulo.orden != index:
            modulo.orden = index
            modulo.save(update_fields=['orden'])


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0006_alter_modulosistema_options'),
    ]

    operations = [
        migrations.RunPython(normalizar_ordenes, migrations.RunPython.noop),
    ]
