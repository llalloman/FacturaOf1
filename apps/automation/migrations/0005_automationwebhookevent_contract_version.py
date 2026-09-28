from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('automation', '0004_automationprivacyconsent_and_more')]
    operations = [migrations.AddField(
        model_name='automationwebhookevent', name='contract_version',
        field=models.CharField(default='v1', max_length=20, verbose_name='versión de contrato'),
    )]
