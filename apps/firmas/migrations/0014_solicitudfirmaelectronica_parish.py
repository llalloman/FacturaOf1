from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('firmas', '0013_add_transfer_provider_choice'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfirmaelectronica',
            name='parish',
            field=models.CharField(blank=True, max_length=120, verbose_name='parroquia'),
        ),
    ]
