from django.db import migrations, models


def backfill_request_numbers(apps, schema_editor):
    SolicitudFirmaElectronica = apps.get_model('firmas', 'SolicitudFirmaElectronica')
    for solicitud in SolicitudFirmaElectronica.objects.filter(request_number__isnull=True).order_by('id'):
        created_at = solicitud.created_at
        year = created_at.year if created_at else 2026
        solicitud.request_number = f'FE-{year}-{solicitud.id:06d}'
        solicitud.save(update_fields=['request_number'])


class Migration(migrations.Migration):

    dependencies = [
        ('firmas', '0002_solicituddemoerp'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='request_number',
            field=models.CharField(blank=True, max_length=30, null=True, unique=True, verbose_name='numero de solicitud'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='identification_type',
            field=models.CharField(choices=[('CEDULA', 'Cedula'), ('PASAPORTE', 'Pasaporte'), ('RUC', 'RUC')], default='CEDULA', max_length=20, verbose_name='tipo de identificacion'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='second_last_name',
            field=models.CharField(blank=True, max_length=120, verbose_name='segundo apellido'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='birth_date',
            field=models.DateField(blank=True, null=True, verbose_name='fecha de nacimiento'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='nationality',
            field=models.CharField(blank=True, default='ECUATORIANA', max_length=80, verbose_name='nacionalidad'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='gender',
            field=models.CharField(blank=True, max_length=20, verbose_name='sexo'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='has_ruc',
            field=models.BooleanField(default=False, verbose_name='tiene RUC'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='company_unit',
            field=models.CharField(blank=True, max_length=120, verbose_name='unidad de empresa'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='applicant_position',
            field=models.CharField(blank=True, max_length=120, verbose_name='cargo'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='request_reason',
            field=models.CharField(blank=True, max_length=180, verbose_name='motivo de solicitud'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='secondary_email',
            field=models.EmailField(blank=True, max_length=254, verbose_name='correo electronico secundario'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='secondary_phone',
            field=models.CharField(blank=True, max_length=20, verbose_name='telefono secundario'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='representative_identification_type',
            field=models.CharField(blank=True, choices=[('CEDULA', 'Cedula'), ('PASAPORTE', 'Pasaporte'), ('RUC', 'RUC')], max_length=20, verbose_name='tipo identificacion representante'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='representative_identification',
            field=models.CharField(blank=True, max_length=20, verbose_name='identificacion representante'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='representative_names',
            field=models.CharField(blank=True, max_length=120, verbose_name='nombres representante'),
        ),
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='representative_last_names',
            field=models.CharField(blank=True, max_length=160, verbose_name='apellidos representante'),
        ),
        migrations.AlterField(
            model_name='documentosolicitudfirma',
            name='document_type',
            field=models.CharField(choices=[('CEDULA_ANVERSO', 'Anverso de cedula'), ('CEDULA_REVERSO', 'Reverso de cedula'), ('SELFIE_CEDULA', 'Selfie con cedula'), ('RUC_PDF', 'RUC PDF'), ('CONSTITUCION_COMPANIA', 'Constitucion de compania'), ('NOMBRAMIENTO_REPRESENTANTE', 'Nombramiento representante legal'), ('ACEPTACION_NOMBRAMIENTO', 'Aceptacion de nombramiento'), ('CARTA_AUTORIZACION', 'Carta de autorizacion'), ('CEDULA_REPRESENTANTE', 'Cedula representante legal'), ('VIDEO_AUTORIZACION', 'Video de autorizacion'), ('DOCUMENTO_ADICIONAL', 'Documento adicional')], max_length=40, verbose_name='tipo de documento'),
        ),
        migrations.RunPython(backfill_request_numbers, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name='solicitudfirmaelectronica',
            index=models.Index(fields=['request_number'], name='electronic__request_d29721_idx'),
        ),
    ]
