from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('automation', '0005_automationwebhookevent_contract_version')]
    operations = [
        migrations.AddField(
            model_name='automationwebhookevent', name='next_attempt_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='próximo intento'),
        ),
        migrations.AddField(
            model_name='automationwebhookevent', name='dead_lettered_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='fecha dead-letter'),
        ),
    ]
