from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def classify_existing_interactions(apps, schema_editor):
    Interaction = apps.get_model('automation', 'WhatsAppInteraction')
    Interaction.objects.filter(direction='INBOUND').update(sender_type='CUSTOMER', origin='whatsapp')
    Interaction.objects.filter(direction='OUTBOUND').update(sender_type='AI', origin='n8n')


class Migration(migrations.Migration):

    dependencies = [
        ('automation', '0004_automationprivacyconsent_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='commerciallead', name='conversation_mode',
            field=models.CharField(choices=[('BOT', 'Atiende el bot'), ('HUMAN_PENDING', 'Esperando asesor'), ('HUMAN_ACTIVE', 'Atiende un asesor')], db_index=True, default='BOT', max_length=20, verbose_name='modo de conversación'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='conversation_stage',
            field=models.CharField(blank=True, default='active', max_length=40, verbose_name='etapa de conversación'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='handoff_reason',
            field=models.CharField(blank=True, max_length=120, verbose_name='motivo de handoff'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='human_requested_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='solicitud de atención humana'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='human_active_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='inicio de atención humana'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='human_released_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='devolución al bot'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='human_active_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='automation_conversations_taken', to=settings.AUTH_USER_MODEL, verbose_name='asesor que tomó la conversación'),
        ),
        migrations.AddField(
            model_name='commerciallead', name='human_released_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='automation_conversations_released', to=settings.AUTH_USER_MODEL, verbose_name='asesor que devolvió la conversación'),
        ),
        migrations.AddField(
            model_name='whatsappinteraction', name='sender_type',
            field=models.CharField(choices=[('CUSTOMER', 'Cliente'), ('AI', 'Asistente IA'), ('HUMAN', 'Asesor'), ('UNKNOWN', 'Sin identificar')], default='UNKNOWN', max_length=12, verbose_name='tipo de remitente'),
        ),
        migrations.AddField(
            model_name='whatsappinteraction', name='origin',
            field=models.CharField(default='whatsapp', max_length=30, verbose_name='origen'),
        ),
        migrations.RunPython(classify_existing_interactions, migrations.RunPython.noop),
    ]
