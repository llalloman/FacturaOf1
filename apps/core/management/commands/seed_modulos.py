"""
Seed: configura la matriz de permisos de módulos por plan.

Ejecutar: python manage.py seed_modulos
"""
from django.core.management.base import BaseCommand
from apps.suscripciones.models import (
    MODULOS_BASE,
    ModuloPermiso,
    ModuloSistema,
    PlanSuscripcion,
    SeccionModulo,
    get_todos_modulos_codigos,
)


# ── Definición de permisos por tipo de plan ──────────────────────────────────

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

# Mapa tipo → módulos
PLAN_MODULOS = {
    'BASICO':      MODULOS_BASICO,
    'PROFESIONAL': MODULOS_PROFESIONAL,
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
        self._seed_catalogo()
        todos_modulos = get_todos_modulos_codigos()
        planes = PlanSuscripcion.objects.all()
        total_creados = 0
        total_planes = 0

        for plan in planes:
            modulos = todos_modulos if plan.tipo in ('FREE', 'EMPRESARIAL', 'ILIMITADO') else PLAN_MODULOS.get(plan.tipo)
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

    def _seed_catalogo(self):
        secciones = {}
        grupos = list(dict.fromkeys(m['grupo'] for m in MODULOS_BASE))
        for index, grupo in enumerate(grupos, start=1):
            codigo = self._normalizar_codigo(grupo)
            seccion, _ = SeccionModulo.objects.update_or_create(
                codigo=codigo,
                defaults={'nombre': grupo, 'orden': index, 'activo': True},
            )
            secciones[grupo] = seccion

        for modulo in MODULOS_BASE:
            seccion = secciones[modulo['grupo']]
            ModuloSistema.objects.update_or_create(
                codigo=modulo['codigo'],
                defaults={
                    'seccion': seccion,
                    'label': modulo['label'],
                    'ruta': modulo['ruta'],
                    'grupo': seccion.nombre,
                    'icono': modulo.get('icono', ''),
                    'orden': modulo.get('orden', 0),
                    'activo': modulo.get('activo', True),
                    'external': modulo.get('external', False),
                },
            )

    def _normalizar_codigo(self, valor):
        reemplazos = str.maketrans('áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN')
        texto = valor.translate(reemplazos).lower()
        partes = []
        actual = []
        for char in texto:
            if char.isalnum():
                actual.append(char)
            elif actual:
                partes.append(''.join(actual))
                actual = []
        if actual:
            partes.append(''.join(actual))
        return '_'.join(partes)
