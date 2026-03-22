from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("cartera", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cuentaporcobrar",
            name="estado",
            field=models.CharField(
                choices=[
                    ("PENDIENTE", "Pendiente"),
                    ("PARCIAL", "Parcial"),
                    ("PAGADO", "Pagado"),
                    ("VENCIDA", "Vencida"),
                    ("INCOBRABLE", "Incobrable"),
                    ("ANULADA", "Anulada"),
                ],
                default="PENDIENTE",
                max_length=20,
                verbose_name="estado",
            ),
        ),
        migrations.CreateModel(
            name="MovimientoCuentaPorCobrar",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("fecha_movimiento", models.DateField(verbose_name="fecha de movimiento")),
                (
                    "tipo_movimiento",
                    models.CharField(
                        choices=[("DEBITO", "Débito"), ("CREDITO", "Crédito")],
                        max_length=20,
                        verbose_name="tipo de movimiento",
                    ),
                ),
                (
                    "motivo",
                    models.CharField(
                        choices=[
                            ("ANULACION_FACTURA", "Anulación de factura"),
                            ("AJUSTE_MANUAL", "Ajuste manual"),
                            ("REVERSION", "Reversión"),
                        ],
                        default="AJUSTE_MANUAL",
                        max_length=30,
                        verbose_name="motivo",
                    ),
                ),
                (
                    "monto",
                    models.DecimalField(decimal_places=2, max_digits=12, verbose_name="monto"),
                ),
                (
                    "concepto",
                    models.CharField(max_length=200, verbose_name="concepto"),
                ),
                (
                    "referencia",
                    models.CharField(blank=True, max_length=100, verbose_name="referencia"),
                ),
                ("notas", models.TextField(blank=True, verbose_name="notas")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "cuenta",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="movimientos",
                        to="cartera.cuentaporcobrar",
                        verbose_name="cuenta por cobrar",
                    ),
                ),
            ],
            options={
                "verbose_name": "movimiento de cuenta por cobrar",
                "verbose_name_plural": "movimientos de cuentas por cobrar",
                "ordering": ["-fecha_movimiento", "-created_at"],
            },
        ),
    ]
