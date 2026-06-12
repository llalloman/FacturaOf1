"""
Comando de gestión para sincronizar los planes de suscripción con los
valores que muestra la landing page.

Uso: python manage.py actualizar_planes

La lógica es segura para producción:
  1. Renombra códigos heredados (BASICO → BASICO-ANUAL, etc.) preservando los
     IDs, de modo que las suscripciones existentes no pierdan su FK.
  2. Hace upsert (update_or_create) de los 7 planes canónicos.
  3. Desactiva —no borra— cualquier plan con código desconocido.

Convención: 0 = ilimitado en la BD (el serializer convierte 0 → -1 para el API).
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.suscripciones.models import PlanSuscripcion


# ---------------------------------------------------------------------------
# Definición canónica de planes (debe coincidir con la landing)
# ---------------------------------------------------------------------------
PLANES = [
    {
        'codigo': 'FREE',
        'nombre': 'Demo guiada',
        'tipo': 'FREE',
        'periodo': 'MENSUAL',
        'precio': Decimal('0.00'),
        'facturas_mensuales': 50,
        'usuarios_permitidos': 1,
        'empresas_permitidas': 1,
        'soporte_prioritario': False,
        'api_access': False,
        'reportes_avanzados': False,
        'activo': True,
        'descripcion': 'Agenda una demostración gratuita y recibe asesoría para empezar a facturar.',
    },
    {
        'codigo': 'BASICO-MENSUAL',
        'nombre': 'Básico Mensual',
        'tipo': 'BASICO',
        'periodo': 'MENSUAL',
        'precio': Decimal('12.99'),
        'facturas_mensuales': 100,
        'usuarios_permitidos': 1,
        'empresas_permitidas': 1,
        'soporte_prioritario': False,
        'api_access': False,
        'reportes_avanzados': False,
        'activo': True,
        'descripcion': 'Ideal para emprendedores y negocios que están empezando.',
    },
    {
        'codigo': 'BASICO-ANUAL',
        'nombre': 'Básico Anual',
        'tipo': 'BASICO',
        'periodo': 'ANUAL',
        'precio': Decimal('129.99'),
        'facturas_mensuales': 100,
        'usuarios_permitidos': 1,
        'empresas_permitidas': 1,
        'soporte_prioritario': False,
        'api_access': False,
        'reportes_avanzados': False,
        'activo': True,
        'descripcion': 'Ideal para emprendedores y negocios que están empezando.',
    },
    {
        'codigo': 'PROFESIONAL-MENSUAL',
        'nombre': 'Profesional Mensual',
        'tipo': 'PROFESIONAL',
        'periodo': 'MENSUAL',
        'precio': Decimal('24.99'),
        'facturas_mensuales': 300,
        'usuarios_permitidos': 3,
        'empresas_permitidas': 1,
        'soporte_prioritario': True,
        'api_access': False,
        'reportes_avanzados': True,
        'activo': True,
        'descripcion': 'La opción favorita de tiendas y negocios en crecimiento.',
    },
    {
        'codigo': 'PROFESIONAL-ANUAL',
        'nombre': 'Profesional Anual',
        'tipo': 'PROFESIONAL',
        'periodo': 'ANUAL',
        'precio': Decimal('249.99'),
        'facturas_mensuales': 300,
        'usuarios_permitidos': 3,
        'empresas_permitidas': 1,
        'soporte_prioritario': True,
        'api_access': False,
        'reportes_avanzados': True,
        'activo': True,
        'descripcion': 'La opción favorita de tiendas y negocios en crecimiento.',
    },
    {
        'codigo': 'EMPRESARIAL-MENSUAL',
        'nombre': 'Empresarial Mensual',
        'tipo': 'EMPRESARIAL',
        'periodo': 'MENSUAL',
        'precio': Decimal('49.99'),
        'facturas_mensuales': 0,       # 0 = ilimitado
        'usuarios_permitidos': 10,
        'empresas_permitidas': 0,      # 0 = ilimitado (multiempresa)
        'soporte_prioritario': True,
        'api_access': True,
        'reportes_avanzados': True,
        'activo': True,
        'descripcion': 'Para empresas con múltiples usuarios y mayores volúmenes.',
    },
    {
        'codigo': 'EMPRESARIAL-ANUAL',
        'nombre': 'Empresarial Anual',
        'tipo': 'EMPRESARIAL',
        'periodo': 'ANUAL',
        'precio': Decimal('499.99'),
        'facturas_mensuales': 0,       # 0 = ilimitado
        'usuarios_permitidos': 10,
        'empresas_permitidas': 0,      # 0 = ilimitado (multiempresa)
        'soporte_prioritario': True,
        'api_access': True,
        'reportes_avanzados': True,
        'activo': True,
        'descripcion': 'Para empresas con múltiples usuarios y mayores volúmenes.',
    },
]

# Renombres de códigos heredados → nuevos códigos
# Se hace con UPDATE para que el ID quede intacto y las FK de Suscripcion no rompan.
RENOMBRES = {
    'BASICO': 'BASICO-ANUAL',
    'PROFESIONAL': 'PROFESIONAL-ANUAL',
    'EMPRESARIAL': 'EMPRESARIAL-ANUAL',
}


class Command(BaseCommand):
    help = 'Sincroniza los planes de suscripción con los valores de la landing page.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('Actualizando planes de suscripción...'))

        # 1. Renombrar códigos heredados (preserva IDs)
        for old_code, new_code in RENOMBRES.items():
            updated = PlanSuscripcion.objects.filter(codigo=old_code).update(codigo=new_code)
            if updated:
                self.stdout.write(f'  Renombrado: {old_code} → {new_code}')

        # 2. Upsert de todos los planes canónicos
        canonical_codes = set()
        for data in PLANES:
            codigo = data.pop('codigo')
            canonical_codes.add(codigo)
            obj, created = PlanSuscripcion.objects.update_or_create(
                codigo=codigo,
                defaults=data,
            )
            data['codigo'] = codigo  # restaurar para re-ejecuciones
            verb = 'Creado' if created else 'Actualizado'
            self.stdout.write(f'  {verb}: {codigo}  (${obj.precio}  {obj.periodo})')

        # 3. Desactivar planes con códigos desconocidos (no borrar para no romper FKs)
        obsoletos = PlanSuscripcion.objects.exclude(codigo__in=canonical_codes).filter(activo=True)
        count = obsoletos.update(activo=False)
        if count:
            self.stdout.write(
                self.style.WARNING(f'  Desactivados {count} plan(es) con código no reconocido.')
            )

        self.stdout.write(self.style.SUCCESS('Planes actualizados exitosamente.'))
