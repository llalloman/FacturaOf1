from django.db import migrations


def add_firmas_modulo(apps, schema_editor):
    SeccionModulo = apps.get_model('suscripciones', 'SeccionModulo')
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')
    ModuloPermiso = apps.get_model('suscripciones', 'ModuloPermiso')
    PlanSuscripcion = apps.get_model('suscripciones', 'PlanSuscripcion')

    seccion, _ = SeccionModulo.objects.update_or_create(
        codigo='administracion',
        defaults={'nombre': 'Administración', 'orden': 7, 'activo': True},
    )
    ModuloSistema.objects.update_or_create(
        codigo='firmas_electronicas',
        defaults={
            'seccion': seccion,
            'label': 'Solicitudes de Firma Electrónica',
            'ruta': '/firmas-electronicas',
            'grupo': seccion.nombre,
            'icono': 'FileSignature',
            'orden': 3,
            'activo': True,
            'external': False,
        },
    )
    for plan in PlanSuscripcion.objects.filter(tipo__in=['PROFESIONAL', 'EMPRESARIAL', 'ILIMITADO']):
        ModuloPermiso.objects.get_or_create(plan=plan, modulo='firmas_electronicas')


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0007_normalizar_orden_menus'),
    ]

    operations = [
        migrations.RunPython(add_firmas_modulo, migrations.RunPython.noop),
    ]
