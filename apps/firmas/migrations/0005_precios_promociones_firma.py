from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


INITIAL_PRICES = [
    ('7_DIAS', '7 días', Decimal('8.00'), 1),
    ('15_DIAS', '15 días', Decimal('8.00'), 2),
    ('1_MES', '30 días', Decimal('9.00'), 3),
    ('1_ANIO', '1 año', Decimal('21.00'), 4),
    ('2_ANIOS', '2 años', Decimal('32.00'), 5),
    ('3_ANIOS', '3 años', Decimal('43.00'), 6),
    ('4_ANIOS', '4 años', Decimal('53.00'), 7),
    ('5_ANIOS', '5 años', Decimal('62.00'), 8),
]


def seed_prices(apps, schema_editor):
    FirmaPrecioElectronica = apps.get_model('firmas', 'FirmaPrecioElectronica')
    for validity, _label, price, order in INITIAL_PRICES:
        FirmaPrecioElectronica.objects.update_or_create(
            validity=validity,
            defaults={'regular_price': price, 'active': True, 'order': order},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('firmas', '0004_rename_electronic__request_d29721_idx_electronic__request_86f6ce_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='FirmaPrecioElectronica',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('validity', models.CharField(choices=[('7_DIAS', '7 días'), ('15_DIAS', '15 días'), ('1_MES', '1 mes'), ('1_ANIO', '1 año'), ('2_ANIOS', '2 años'), ('3_ANIOS', '3 años'), ('4_ANIOS', '4 años'), ('5_ANIOS', '5 años')], max_length=20, unique=True, verbose_name='vigencia')),
                ('regular_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='precio final incluido IVA')),
                ('active', models.BooleanField(default=True, verbose_name='activo')),
                ('order', models.PositiveSmallIntegerField(default=0, verbose_name='orden')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='fecha de actualización')),
            ],
            options={
                'verbose_name': 'precio de firma electrónica',
                'verbose_name_plural': 'precios de firma electrónica',
                'db_table': 'electronic_signature_prices',
                'ordering': ['order', 'regular_price'],
            },
        ),
        migrations.CreateModel(
            name='FirmaPromocionElectronica',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, verbose_name='nombre')),
                ('promotional_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='precio promocional incluido IVA')),
                ('start_date', models.DateField(verbose_name='fecha de inicio')),
                ('end_date', models.DateField(verbose_name='fecha de fin')),
                ('active', models.BooleanField(default=True, verbose_name='activo')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='fecha de actualización')),
                ('price', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='promotions', to='firmas.firmaprecioelectronica', verbose_name='precio')),
            ],
            options={
                'verbose_name': 'promoción de firma electrónica',
                'verbose_name_plural': 'promociones de firma electrónica',
                'db_table': 'electronic_signature_promotions',
                'ordering': ['-active', '-start_date', 'end_date'],
            },
        ),
        migrations.AlterField(
            model_name='solicitudfirmaelectronica',
            name='validity',
            field=models.CharField(choices=[('7_DIAS', '7 días'), ('15_DIAS', '15 días'), ('1_MES', '1 mes'), ('1_ANIO', '1 año'), ('2_ANIOS', '2 años'), ('3_ANIOS', '3 años'), ('4_ANIOS', '4 años'), ('5_ANIOS', '5 años')], max_length=20, verbose_name='vigencia solicitada'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='regular_price',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10, verbose_name='precio normal'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='discount_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10, verbose_name='descuento aplicado'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='price_catalog',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='solicitudes', to='firmas.firmaprecioelectronica', verbose_name='precio de catálogo'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='promotion_applied',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='solicitudes', to='firmas.firmapromocionelectronica', verbose_name='promoción aplicada'),
        ),
        migrations.AddIndex(
            model_name='firmapromocionelectronica',
            index=models.Index(fields=['price', 'active', 'start_date', 'end_date'], name='electronic__price_i_99b7a3_idx'),
        ),
        migrations.RunPython(seed_prices, noop),
    ]
