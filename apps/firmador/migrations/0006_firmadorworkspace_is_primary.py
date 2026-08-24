from django.db import migrations, models
from django.db.models import Count, Q


def assign_primary_workspaces(apps, schema_editor):
    FirmadorWorkspace = apps.get_model('firmador', 'FirmadorWorkspace')

    owner_ids = (
        FirmadorWorkspace.objects
        .exclude(owner_user_id__isnull=True)
        .values_list('owner_user_id', flat=True)
        .distinct()
    )

    for owner_id in owner_ids:
        workspaces = (
            FirmadorWorkspace.objects
            .filter(owner_user_id=owner_id)
            .annotate(
                documentos_total=Count('documentos', distinct=True),
                certificados_total=Count('certificados', distinct=True),
            )
            .order_by(
                '-activo',
                '-documentos_total',
                '-certificados_total',
                'created_at',
                'id',
            )
        )
        primary = workspaces.first()
        if not primary:
            continue
        FirmadorWorkspace.objects.filter(owner_user_id=owner_id).update(is_primary=False)
        primary.is_primary = True
        primary.save(update_fields=['is_primary'])


class Migration(migrations.Migration):

    dependencies = [
        ('firmador', '0005_firmadorconsentimientolegal'),
    ]

    operations = [
        migrations.AddField(
            model_name='firmadorworkspace',
            name='is_primary',
            field=models.BooleanField(default=False, verbose_name='workspace principal'),
        ),
        migrations.AddIndex(
            model_name='firmadorworkspace',
            index=models.Index(fields=['owner_user', 'is_primary'], name='firmador_fi_owner__f7c4d4_idx'),
        ),
        migrations.RunPython(assign_primary_workspaces, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='firmadorworkspace',
            constraint=models.UniqueConstraint(
                condition=Q(is_primary=True, activo=True),
                fields=('owner_user',),
                name='uniq_firmador_workspace_principal_activo',
            ),
        ),
    ]
