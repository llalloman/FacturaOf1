from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('automation', '0002_remove_commerciallead_uniq_automation_lead_phone_channel_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='commerciallead',
            name='internal_notes',
            field=models.TextField(blank=True, verbose_name='notas internas'),
        ),
        migrations.AlterField(
            model_name='commerciallead',
            name='interest_type',
            field=models.CharField(
                choices=[
                    ('signature', 'Firma electrónica'),
                    ('erp', 'ERP FacturaOF1'),
                    ('invoicing', 'Facturación electrónica'),
                    ('custom_software', 'Desarrollo a medida'),
                    ('automation_ai', 'Automatización e IA'),
                    ('chatbot', 'Chatbots'),
                    ('integration', 'Integraciones'),
                    ('support', 'Soporte'),
                    ('payment', 'Pago'),
                    ('documents', 'Documentos'),
                    ('human', 'Atención humana'),
                    ('unknown', 'No definido'),
                ],
                default='unknown',
                max_length=40,
                verbose_name='tipo de interés',
            ),
        ),
        migrations.AlterField(
            model_name='commerciallead',
            name='status',
            field=models.CharField(
                choices=[
                    ('new', 'Nuevo'),
                    ('bot_responded', 'Respondido por bot'),
                    ('in_follow_up', 'En seguimiento'),
                    ('contacted', 'Contactado'),
                    ('qualified', 'Calificado'),
                    ('requires_human', 'Requiere humano'),
                    ('proposal_sent', 'Propuesta enviada'),
                    ('converted', 'Convertido'),
                    ('lost', 'Perdido'),
                    ('closed', 'Cerrado'),
                ],
                default='new',
                max_length=30,
                verbose_name='estado',
            ),
        ),
    ]
