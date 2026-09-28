from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):
    dependencies = [('bancos', '0001_initial'), ('empresas', '0001_initial'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(
        name='CierreTesoreria',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('fecha', models.DateField()),
            ('estado', models.CharField(choices=[('BORRADOR', 'Borrador'), ('CERRADO', 'Cerrado'), ('REABIERTO', 'Reabierto')], default='BORRADOR', max_length=20)),
            ('saldos_teoricos', models.JSONField(blank=True, default=dict)),
            ('saldos_declarados', models.JSONField(blank=True, default=dict)),
            ('diferencia_total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
            ('observaciones', models.TextField(blank=True)),
            ('fecha_cierre', models.DateTimeField(blank=True, null=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('cerrado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cierres_tesoreria_cerrados', to=settings.AUTH_USER_MODEL)),
            ('creado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cierres_tesoreria_creados', to=settings.AUTH_USER_MODEL)),
            ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cierres_tesoreria', to='empresas.empresa')),
        ],
        options={'ordering': ['-fecha'], 'constraints': [models.UniqueConstraint(fields=('empresa', 'fecha'), name='uniq_cierre_tesoreria_empresa_fecha')]},
    )]
