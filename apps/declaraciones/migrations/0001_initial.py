"""
Initial migration for DeclaracionMensual model.
"""
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('empresas', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeclaracionMensual',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_formulario', models.CharField(
                    choices=[('104', 'Formulario 104 — IVA'), ('103', 'Formulario 103 — Retenciones Fuente'), ('ATS', 'Anexo Transaccional Simplificado')],
                    max_length=3, verbose_name='tipo de formulario',
                )),
                ('anio', models.PositiveSmallIntegerField(verbose_name='año')),
                ('mes', models.PositiveSmallIntegerField(
                    validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(12)],
                    verbose_name='mes',
                )),
                ('estado', models.CharField(
                    choices=[('BORRADOR', 'Borrador'), ('CALCULADA', 'Calculada'), ('PRESENTADA', 'Presentada al SRI'), ('VENCIDA', 'Plazo vencido sin presentar')],
                    default='BORRADOR', max_length=20, verbose_name='estado',
                )),
                ('datos_json', models.JSONField(blank=True, default=dict, help_text='Snapshot JSON del cálculo: ventas, compras, retenciones, totales.', verbose_name='datos calculados')),
                ('total_ventas', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='total ventas')),
                ('total_compras', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='total compras')),
                ('iva_ventas', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='IVA ventas')),
                ('iva_compras', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='IVA compras')),
                ('impuesto_a_pagar', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='impuesto a pagar')),
                ('credito_tributario', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='crédito tributario')),
                ('total_retenido', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='total retenido')),
                ('fecha_limite', models.DateField(blank=True, null=True, verbose_name='fecha límite de presentación')),
                ('fecha_presentacion', models.DateTimeField(blank=True, null=True, verbose_name='fecha de presentación')),
                ('numero_formulario_sri', models.CharField(blank=True, default='', help_text='Número de presentación asignado por el SRI.', max_length=30, verbose_name='nro. formulario SRI')),
                ('notas', models.TextField(blank=True, default='', verbose_name='notas')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('empresa', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='declaraciones',
                    to='empresas.empresa',
                    verbose_name='empresa',
                )),
            ],
            options={
                'verbose_name': 'declaración mensual',
                'verbose_name_plural': 'declaraciones mensuales',
                'ordering': ['-anio', '-mes', 'tipo_formulario'],
                'unique_together': {('empresa', 'tipo_formulario', 'anio', 'mes')},
            },
        ),
    ]
