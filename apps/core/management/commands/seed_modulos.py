"""
Seed: configura la matriz de permisos de módulos por plan.

Ejecutar: python manage.py seed_modulos
"""
from django.core.management.base import BaseCommand
from apps.suscripciones.models import PlanSuscripcion, ModuloPermiso, TODOS_LOS_MODULOS


# ── Definición de permisos por tipo de plan ──────────────────────────────────

MODULOS_FREE = TODOS_LOS_MODULOS  # FREE tiene acceso a todo durante su período

MODULOS_BASICO = [
    'dashboard',
    'facturacion',
    'retenciones',
    'notas_credito',
    'clientes',
    'productos',
    'ventas',
    'configuracion',
]

MODULOS_PROFESIONAL = [
    'dashboard',
    'facturacion',
    'retenciones',
    'guias_remision',
    'notas_debito',
    'notas_credito',
    'cartera',
    'declaraciones',
    'cotizaciones',
    'clientes',
    'productos',
    'proveedores',
    'inventarios',
    'ventas',
    'pedidos',
    'reportes',
    'configuracion',
    'usuarios',
]

MODULOS_EMPRESARIAL = TODOS_LOS_MODULOS  # Empresarial tiene todo

MODULOS_ILIMITADO = TODOS_LOS_MODULOS

# Mapa tipo → módulos
PLAN_MODULOS = {
    'FREE':        MODULOS_FREE,
    'BASICO':      MODULOS_BASICO,
    'PROFESIONAL': MODULOS_PROFESIONAL,
    'EMPRESARIAL': MODULOS_EMPRESARIAL,
    'ILIMITADO':   MODULOS_ILIMITADO,
}


class Command(BaseCommand):
    help = 'Siembra la matriz de permisos de módulos para cada plan de suscripción.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Reemplaza los permisos existentes aunque ya hayan sido configurados.',
        )

    def handle(self, *args, **options):
        force = options['force']
        planes = PlanSuscripcion.objects.all()
        total_creados = 0
        total_planes = 0

        for plan in planes:
            modulos = PLAN_MODULOS.get(plan.tipo)
            if modulos is None:
                self.stdout.write(self.style.WARNING(
                    f'  Plan "{plan.nombre}" (tipo={plan.tipo}) — sin configuración, saltando.'
                ))
                continue

            existentes = ModuloPermiso.objects.filter(plan=plan).count()
            if existentes > 0 and not force:
                self.stdout.write(
                    f'  Plan "{plan.nombre}" — ya tiene {existentes} módulos configurados (usa --force para reemplazar).'
                )
                continue

            ModuloPermiso.objects.filter(plan=plan).delete()
            nuevos = [ModuloPermiso(plan=plan, modulo=m) for m in modulos]
            ModuloPermiso.objects.bulk_create(nuevos)
            total_creados += len(nuevos)
            total_planes += 1
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Plan "{plan.nombre}" ({plan.tipo}) → {len(modulos)} módulos asignados.'
            ))

        self.stdout.write(self.style.SUCCESS(
            f'\nListo: {total_planes} planes actualizados, {total_creados} permisos creados.'
        ))
