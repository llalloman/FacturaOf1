from django.db import migrations


def scrub_tokens(apps, schema_editor):
    FirmaPagoElectronico = apps.get_model('firmas', 'FirmaPagoElectronico')
    PagoOnline = apps.get_model('pagos', 'PagoOnline')

    for payment in FirmaPagoElectronico.objects.exclude(raw_request={}):
        raw = dict(payment.raw_request or {})
        if 'token' in raw:
            raw.pop('token', None)
            payment.raw_request = raw
            payment.save(update_fields=['raw_request'])

    for payment in PagoOnline.objects.exclude(raw_request={}):
        raw = dict(payment.raw_request or {})
        if 'token' in raw:
            raw.pop('token', None)
            payment.raw_request = raw
            payment.save(update_fields=['raw_request'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('firmas', '0011_firmaprecioelectronica_producto_erp'),
        ('pagos', '0002_remove_pagoconfiguracion_fee_percent_and_more'),
    ]

    operations = [
        migrations.RunPython(scrub_tokens, noop_reverse),
    ]
