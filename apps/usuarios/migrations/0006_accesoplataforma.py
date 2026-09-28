from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [('usuarios', '0005_empresamembresia')]

    operations = [
        migrations.CreateModel(
            name='AccesoPlataforma',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rol', models.CharField(choices=[('ADMIN_GLOBAL', 'Administrador global'), ('SOPORTE', 'Soporte de plataforma'), ('FACTURACION', 'Facturación de plataforma'), ('AUDITOR', 'Auditor de plataforma')], max_length=20)),
                ('alcances', models.JSONField(blank=True, default=list, help_text='Capacidades explícitas: empresas, suscripciones, auditoría, soporte, etc.')),
                ('activa', models.BooleanField(default=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_modificacion', models.DateTimeField(auto_now=True)),
                ('creada_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accesos_plataforma_creados', to='usuarios.usuario')),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='accesos_plataforma', to='usuarios.usuario')),
            ],
            options={'verbose_name': 'acceso de plataforma', 'verbose_name_plural': 'accesos de plataforma'},
        ),
        migrations.AddConstraint(
            model_name='accesoplataforma',
            constraint=models.UniqueConstraint(fields=('usuario', 'rol'), name='uniq_usuario_rol_plataforma'),
        ),
        migrations.AddIndex(
            model_name='accesoplataforma',
            index=models.Index(fields=['usuario', 'activa'], name='idx_acceso_plataforma_activa'),
        ),
    ]
