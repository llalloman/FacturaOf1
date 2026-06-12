from django.db import migrations, models
import django.db.models.deletion


def normalizar_codigo(valor):
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n',
        'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ñ': 'n',
    }
    texto = ''.join(reemplazos.get(char, char) for char in valor)
    texto = ''.join(char.lower() if char.isalnum() else '_' for char in texto)
    return '_'.join(part for part in texto.split('_') if part)


def crear_secciones_y_asignar(apps, schema_editor):
    SeccionModulo = apps.get_model('suscripciones', 'SeccionModulo')
    ModuloSistema = apps.get_model('suscripciones', 'ModuloSistema')

    grupos = []
    for grupo in ModuloSistema.objects.order_by('grupo', 'orden').values_list('grupo', flat=True):
        if grupo and grupo not in grupos:
            grupos.append(grupo)

    secciones = {}
    for index, grupo in enumerate(grupos, start=1):
        codigo_base = normalizar_codigo(grupo)
        codigo = codigo_base
        contador = 2
        while SeccionModulo.objects.filter(codigo=codigo).exclude(nombre=grupo).exists():
            codigo = f'{codigo_base}_{contador}'
            contador += 1
        seccion, _ = SeccionModulo.objects.update_or_create(
            codigo=codigo,
            defaults={'nombre': grupo, 'orden': index * 10, 'activo': True},
        )
        secciones[grupo] = seccion

    for modulo in ModuloSistema.objects.all():
        seccion = secciones.get(modulo.grupo)
        if seccion:
            modulo.seccion_id = seccion.id
            modulo.save(update_fields=['seccion'])


class Migration(migrations.Migration):

    dependencies = [
        ('suscripciones', '0004_modulosistema_catalogo'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeccionModulo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=50, unique=True, verbose_name='código')),
                ('nombre', models.CharField(max_length=100, verbose_name='nombre')),
                ('orden', models.PositiveIntegerField(default=0, verbose_name='orden')),
                ('activo', models.BooleanField(default=True, verbose_name='activo')),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('fecha_modificacion', models.DateTimeField(auto_now=True, verbose_name='fecha de modificación')),
            ],
            options={
                'verbose_name': 'sección de módulo',
                'verbose_name_plural': 'secciones de módulos',
                'ordering': ['orden', 'nombre'],
            },
        ),
        migrations.AddField(
            model_name='modulosistema',
            name='seccion',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='modulos', to='suscripciones.seccionmodulo', verbose_name='sección'),
        ),
        migrations.RunPython(crear_secciones_y_asignar, migrations.RunPython.noop),
    ]
