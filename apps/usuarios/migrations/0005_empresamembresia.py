from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0004_alter_usuario_rol'),
        ('empresas', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EmpresaMembresia',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rol_empresa', models.CharField(
                    choices=[
                        ('ADMIN_EMPRESA', 'Administrador de Empresa'),
                        ('CONTADOR', 'Contador'),
                        ('VENDEDOR', 'Vendedor'),
                        ('CONSULTOR', 'Consultor'),
                        ('FIRMADOR', 'Usuario Firmador'),
                    ], max_length=20, verbose_name='rol dentro de la empresa',
                )),
                ('modulos', models.JSONField(
                    blank=True, default=list,
                    help_text='Códigos de módulos con alcance explícito para esta membresía.',
                    verbose_name='módulos autorizados',
                )),
                ('activa', models.BooleanField(default=True, verbose_name='activa')),
                ('predeterminada', models.BooleanField(default=False, verbose_name='empresa predeterminada')),
                ('metadatos', models.JSONField(blank=True, default=dict, verbose_name='metadatos de auditoría')),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('fecha_modificacion', models.DateTimeField(auto_now=True, verbose_name='fecha de modificación')),
                ('creada_por', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='membresias_creadas', to=settings.AUTH_USER_MODEL,
                    verbose_name='creada por',
                )),
                ('empresa', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name='membresias',
                    to='empresas.empresa', verbose_name='empresa',
                )),
                ('usuario', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name='membresias',
                    to=settings.AUTH_USER_MODEL, verbose_name='usuario',
                )),
            ],
            options={
                'verbose_name': 'membresía de empresa',
                'verbose_name_plural': 'membresías de empresa',
            },
        ),
        migrations.AddConstraint(
            model_name='empresamembresia',
            constraint=models.UniqueConstraint(
                fields=('usuario', 'empresa'), name='uniq_usuario_empresa_membresia',
            ),
        ),
        migrations.AddIndex(
            model_name='empresamembresia',
            index=models.Index(fields=['usuario', 'activa'], name='idx_memb_usuario_activa'),
        ),
        migrations.AddIndex(
            model_name='empresamembresia',
            index=models.Index(fields=['empresa', 'activa'], name='idx_memb_empresa_activa'),
        ),
    ]
