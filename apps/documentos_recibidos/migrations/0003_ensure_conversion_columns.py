from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('documentos_recibidos', '0002_rename_documentos__empresa_d7c575_idx_documentos__empresa_a76764_idx_and_more'),
        ('proveedores', '0005_detallerecepcion_lote_caducidad'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                (
                    'ALTER TABLE documentos_recibidos_sri '
                    'ADD COLUMN IF NOT EXISTS proveedor_id bigint NULL'
                ),
                (
                    'ALTER TABLE documentos_recibidos_sri '
                    'ADD COLUMN IF NOT EXISTS cuenta_por_pagar_id bigint NULL'
                ),
                (
                    'ALTER TABLE documentos_recibidos_sri '
                    'ADD COLUMN IF NOT EXISTS fecha_conversion timestamp with time zone NULL'
                ),
                (
                    'CREATE INDEX IF NOT EXISTS documentos_recibidos_sri_proveedor_id_idx '
                    'ON documentos_recibidos_sri (proveedor_id)'
                ),
                (
                    'CREATE UNIQUE INDEX IF NOT EXISTS documentos_recibidos_sri_cuenta_por_pagar_id_uniq '
                    'ON documentos_recibidos_sri (cuenta_por_pagar_id) '
                    'WHERE cuenta_por_pagar_id IS NOT NULL'
                ),
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
