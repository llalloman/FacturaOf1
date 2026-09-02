# Generated manually for the Bandeja Tributaria MVP.

from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('empresas', '0008_empresa_ruc_proveedor_facturacion_electronica'),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentoRecibidoSRI',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_comprobante', models.CharField(choices=[('01', 'Factura'), ('04', 'Nota de crédito'), ('05', 'Nota de débito'), ('06', 'Guía de remisión'), ('07', 'Comprobante de retención'), ('03', 'Liquidación de compra'), ('00', 'Desconocido')], default='00', max_length=2, verbose_name='tipo de comprobante')),
                ('clave_acceso', models.CharField(db_index=True, max_length=49, verbose_name='clave de acceso')),
                ('numero_autorizacion', models.CharField(blank=True, max_length=49, verbose_name='número de autorización')),
                ('numero_comprobante', models.CharField(blank=True, db_index=True, max_length=25, verbose_name='número de comprobante')),
                ('ruc_emisor', models.CharField(blank=True, db_index=True, max_length=13, verbose_name='RUC emisor')),
                ('razon_social_emisor', models.CharField(blank=True, max_length=300, verbose_name='razón social emisor')),
                ('ruc_receptor', models.CharField(blank=True, db_index=True, max_length=20, verbose_name='RUC receptor')),
                ('razon_social_receptor', models.CharField(blank=True, max_length=300, verbose_name='razón social receptor')),
                ('fecha_emision', models.DateField(blank=True, null=True, verbose_name='fecha de emisión')),
                ('fecha_autorizacion', models.DateTimeField(blank=True, null=True, verbose_name='fecha de autorización')),
                ('estado_sri', models.CharField(choices=[('SIN_VALIDAR', 'Sin validar'), ('AUTORIZADO', 'Autorizado'), ('NO_AUTORIZADO', 'No autorizado'), ('ERROR', 'Error')], default='SIN_VALIDAR', max_length=20, verbose_name='estado SRI')),
                ('estado_interno', models.CharField(choices=[('RECIBIDO', 'Recibido'), ('VALIDADO', 'Validado'), ('DUPLICADO', 'Duplicado'), ('REQUIERE_REVISION', 'Requiere revisión'), ('CONVERTIDO', 'Convertido'), ('DESCARTADO', 'Descartado')], default='RECIBIDO', max_length=30, verbose_name='estado interno')),
                ('subtotal_0', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='subtotal 0%')),
                ('subtotal_iva', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='subtotal IVA')),
                ('subtotal_no_objeto', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='subtotal no objeto')),
                ('subtotal_exento', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='subtotal exento')),
                ('iva', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='IVA')),
                ('ice', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='ICE')),
                ('total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='total')),
                ('nombre_archivo', models.CharField(blank=True, max_length=255, verbose_name='nombre de archivo')),
                ('xml_original', models.TextField(verbose_name='XML original')),
                ('observaciones', models.TextField(blank=True, verbose_name='observaciones')),
                ('errores', models.JSONField(blank=True, default=list, verbose_name='errores')),
                ('metadata', models.JSONField(blank=True, default=dict, verbose_name='metadata')),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')),
                ('fecha_modificacion', models.DateTimeField(auto_now=True, verbose_name='fecha de modificación')),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documentos_recibidos_sri', to='empresas.empresa', verbose_name='empresa')),
                ('usuario_creador', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='documentos_recibidos_sri', to=settings.AUTH_USER_MODEL, verbose_name='usuario creador')),
            ],
            options={
                'verbose_name': 'documento recibido SRI',
                'verbose_name_plural': 'documentos recibidos SRI',
                'db_table': 'documentos_recibidos_sri',
                'ordering': ['-fecha_emision', '-fecha_creacion'],
            },
        ),
        migrations.CreateModel(
            name='DocumentoRecibidoImpuesto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(blank=True, max_length=5, verbose_name='código')),
                ('codigo_porcentaje', models.CharField(blank=True, max_length=5, verbose_name='código porcentaje')),
                ('tarifa', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=8, verbose_name='tarifa')),
                ('base_imponible', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='base imponible')),
                ('valor', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='valor')),
                ('documento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='impuestos', to='documentos_recibidos.documentorecibidosri', verbose_name='documento')),
            ],
            options={
                'db_table': 'documentos_recibidos_impuestos',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='DocumentoRecibidoDetalle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo_principal', models.CharField(blank=True, max_length=60, verbose_name='código principal')),
                ('descripcion', models.CharField(max_length=500, verbose_name='descripción')),
                ('cantidad', models.DecimalField(decimal_places=6, default=Decimal('0.00'), max_digits=14, verbose_name='cantidad')),
                ('precio_unitario', models.DecimalField(decimal_places=6, default=Decimal('0.00'), max_digits=14, verbose_name='precio unitario')),
                ('descuento', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='descuento')),
                ('base_imponible', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='base imponible')),
                ('iva', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='IVA')),
                ('ice', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='ICE')),
                ('total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, verbose_name='total')),
                ('documento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='detalles', to='documentos_recibidos.documentorecibidosri', verbose_name='documento')),
            ],
            options={
                'db_table': 'documentos_recibidos_detalles',
                'ordering': ['id'],
            },
        ),
        migrations.AddConstraint(
            model_name='documentorecibidosri',
            constraint=models.UniqueConstraint(fields=('empresa', 'clave_acceso'), name='uniq_documento_recibido_empresa_clave'),
        ),
        migrations.AddIndex(
            model_name='documentorecibidosri',
            index=models.Index(fields=['empresa', 'estado_interno'], name='documentos__empresa_d7c575_idx'),
        ),
        migrations.AddIndex(
            model_name='documentorecibidosri',
            index=models.Index(fields=['empresa', 'fecha_emision'], name='documentos__empresa_c5bfcd_idx'),
        ),
        migrations.AddIndex(
            model_name='documentorecibidosri',
            index=models.Index(fields=['empresa', 'tipo_comprobante'], name='documentos__empresa_96a413_idx'),
        ),
        migrations.AddIndex(
            model_name='documentorecibidosri',
            index=models.Index(fields=['empresa', 'ruc_emisor'], name='documentos__empresa_81df9e_idx'),
        ),
    ]
