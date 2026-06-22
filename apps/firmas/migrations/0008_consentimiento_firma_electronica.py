from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('firmas', '0007_backfill_signature_tax_snapshots'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConsentimientoFirmaElectronica',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('accepted_terms', models.BooleanField(default=True, verbose_name='aceptó términos')),
                ('accepted_privacy', models.BooleanField(default=True, verbose_name='aceptó privacidad')),
                ('accepted_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='fecha de aceptación')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='dirección IP')),
                ('user_agent', models.TextField(blank=True, verbose_name='user agent')),
                ('terms_version', models.CharField(max_length=40, verbose_name='versión de términos')),
                ('privacy_version', models.CharField(max_length=40, verbose_name='versión de privacidad')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('request', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='legal_consent', to='firmas.solicitudfirmaelectronica', verbose_name='solicitud')),
            ],
            options={
                'verbose_name': 'consentimiento de solicitud de firma',
                'verbose_name_plural': 'consentimientos de solicitudes de firma',
                'db_table': 'electronic_signature_request_consents',
                'ordering': ['-accepted_at'],
            },
        ),
        migrations.AddIndex(
            model_name='consentimientofirmaelectronica',
            index=models.Index(fields=['accepted_at'], name='electronic__accepte_4fee6f_idx'),
        ),
        migrations.AddIndex(
            model_name='consentimientofirmaelectronica',
            index=models.Index(fields=['terms_version', 'privacy_version'], name='electronic__terms_v_f4cd5a_idx'),
        ),
    ]
