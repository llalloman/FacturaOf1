from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


def backfill_tax_snapshots(apps, schema_editor):
    Request = apps.get_model('firmas', 'SolicitudFirmaElectronica')
    cent = Decimal('0.01')
    for request in Request.objects.all().iterator():
        final_price = Decimal(request.sale_price or 0)
        tax_rate = Decimal(request.tax_rate or 15)
        factor = Decimal('1.00') + tax_rate / Decimal('100.00')
        subtotal = (final_price / factor).quantize(cent, rounding=ROUND_HALF_UP)
        request.subtotal_without_tax = subtotal
        request.tax_amount = (final_price - subtotal).quantize(cent, rounding=ROUND_HALF_UP)
        request.save(update_fields=['subtotal_without_tax', 'tax_amount'])


class Migration(migrations.Migration):
    dependencies = [('firmas', '0006_firmaprecioelectronica_tax_rate_and_more')]
    operations = [migrations.RunPython(backfill_tax_snapshots, migrations.RunPython.noop)]
