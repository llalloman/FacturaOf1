from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('firmas', '0014_solicitudfirmaelectronica_parish'),
    ]

    operations = [
        migrations.AddField(
            model_name='firmacuponelectronico',
            name='public_to_ai',
            field=models.BooleanField(default=False, verbose_name='visible para automation'),
        ),
    ]
