from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db import transaction

from apps.empresas.models import Empresa, Establecimiento, PuntoEmision
from apps.facturacion.constants import RUC_PROVEEDOR_FACTURACION


class Command(BaseCommand):
    help = 'Audita OF1 Solutions y permite inicializarla solo en staging/pruebas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--ruc', default='',
            help='RUC propio de OF1 Solutions; no es el RUC del proveedor OF1.',
        )
        parser.add_argument('--nombre', default='OF1 Solutions')
        parser.add_argument(
            '--apply', action='store_true',
            help='Crea el tenant si no existe; requiere DEBUG y SRI_AMBIENTE=PRUEBAS.',
        )
        parser.add_argument('--direccion', default='')
        parser.add_argument('--telefono', default='')
        parser.add_argument('--email', default='')
        parser.add_argument(
            '--bootstrap-erp', action='store_true',
            help='Inicializa establecimiento 001, punto 001 y secuenciales base.',
        )
        parser.add_argument(
            '--user-email', default='',
            help='Usuario existente que recibira membresia ADMIN_EMPRESA.',
        )
        parser.add_argument(
            '--plan', action='store_true',
            help='Muestra un plan read-only de configuracion ERP faltante.',
        )

    def handle(self, *args, **options):
        ruc = str(options['ruc']).strip()
        nombre = str(options['nombre']).strip()
        apply_changes = bool(options['apply'])

        if not ruc:
            raise CommandError(
                'Indique --ruc con el RUC propio de OF1 Solutions. '
                'No se debe reutilizar el RUC del proveedor de facturacion.'
            )

        if apply_changes and not (
            bool(getattr(settings, 'DEBUG', False))
            and str(getattr(settings, 'SRI_AMBIENTE', '')).upper() == 'PRUEBAS'
        ):
            raise CommandError(
                '--apply solo esta permitido con DEBUG activo y '
                'SRI_AMBIENTE=PRUEBAS. Use una base aislada de staging.'
            )
        if options['bootstrap_erp'] and not apply_changes:
            raise CommandError('--bootstrap-erp requiere --apply.')
        if options['user_email'] and not apply_changes:
            raise CommandError('--user-email requiere --apply.')

        # Evita que una columna nueva no migrada rompa una auditoria read-only.
        empresa = Empresa.objects.only(
            'id', 'ruc', 'razon_social', 'activa', 'ambiente',
            'onboarding_completado', 'ruc_proveedor_facturacion_electronica',
            'direccion_matriz', 'telefono', 'email',
            'establecimiento_codigo', 'punto_emision_codigo',
        ).filter(ruc=ruc).first()
        if empresa is None and not apply_changes:
            self.stdout.write(self.style.WARNING(
                f'No existe Empresa con RUC {ruc}. No se creo ningun registro. '
                f'Nombre esperado: {nombre}.'
            ))
            return

        if empresa is None:
            required = ['direccion', 'telefono', 'email']
            missing = [key for key in required if not str(options.get(key) or '').strip()]
            if missing:
                raise CommandError(
                    'Para --apply indique --direccion, --telefono y --email. '
                    'No se crean datos ficticios.'
                )
            with transaction.atomic():
                empresa = Empresa.objects.create(
                    ruc=ruc,
                    razon_social=nombre,
                    nombre_comercial=nombre,
                    tipo_contribuyente=Empresa.TipoContribuyenteChoices.SOCIEDAD,
                    direccion_matriz=str(options['direccion']).strip(),
                    telefono=str(options['telefono']).strip(),
                    email=str(options['email']).strip(),
                    ambiente=Empresa.AmbienteChoices.PRUEBAS,
                    ruc_proveedor_facturacion_electronica=RUC_PROVEEDOR_FACTURACION,
                    activa=True,
                )
            self.stdout.write(self.style.SUCCESS(
                f'Empresa creada en ambiente de pruebas: id={empresa.id}, ruc={empresa.ruc}.'
            ))

        if apply_changes and (options['bootstrap_erp'] or options['user_email']):
            self._bootstrap(empresa, options)

        provider_value = empresa.ruc_proveedor_facturacion_electronica or (
            f'(vacio; backfill pendiente; default={RUC_PROVEEDOR_FACTURACION})'
        )
        self.stdout.write(self.style.SUCCESS(
            f'Empresa encontrada: id={empresa.id}, ruc={empresa.ruc}, '
            f'nombre={empresa.razon_social}, activa={empresa.activa}, '
            f'onboarding_completado={empresa.onboarding_completado}, '
            f'ruc_proveedor={provider_value}'
        ))

        if options['plan']:
            self._print_plan(empresa)

    def _print_plan(self, empresa):
        establecimientos = Establecimiento.objects.filter(empresa_id=empresa.id)
        puntos = PuntoEmision.objects.filter(establecimiento__empresa_id=empresa.id)
        tables = set(connection.introspection.table_names())
        membership_table = 'usuarios_empresamembresia'
        membership_count = 'schema pendiente'
        if membership_table in tables:
            with connection.cursor() as cursor:
                cursor.execute(
                    f'SELECT COUNT(1) FROM {membership_table} WHERE empresa_id = %s',
                    [empresa.id],
                )
                membership_count = cursor.fetchone()[0]

        self.stdout.write('Plan read-only de configuracion ERP:')
        self.stdout.write(f'  - establecimientos: {establecimientos.count()}')
        self.stdout.write(f'  - puntos de emision: {puntos.count()}')
        self.stdout.write(f'  - membresias de empresa: {membership_count}')
        self.stdout.write(
            f'  - legado establecimiento/punto: '
            f'{empresa.establecimiento_codigo}/{empresa.punto_emision_codigo}'
        )
        if not establecimientos.exists():
            self.stdout.write('  - pendiente: crear establecimiento con direccion aprobada')
        if not puntos.exists():
            self.stdout.write('  - pendiente: crear punto de emision y secuenciales')
        if membership_count == 'schema pendiente' or membership_count == 0:
            self.stdout.write('  - pendiente: asignar membresia administrativa a usuario existente')

    def _bootstrap(self, empresa, options):
        from apps.facturacion.models import Secuencial
        from apps.usuarios.models import EmpresaMembresia, Usuario

        with transaction.atomic():
            establecimiento, _ = Establecimiento.objects.get_or_create(
                empresa=empresa,
                codigo='001',
                defaults={
                    'nombre': 'Matriz',
                    'direccion': empresa.direccion_matriz,
                    'telefono': empresa.telefono,
                    'activo': True,
                },
            )
            PuntoEmision.objects.get_or_create(
                establecimiento=establecimiento,
                codigo='001',
                defaults={'nombre': 'Punto principal', 'activo': True},
            )
            for tipo in ('01', '04', '05', '06', '07'):
                Secuencial.objects.get_or_create(
                    empresa=empresa,
                    tipo_comprobante=tipo,
                    establecimiento='001',
                    punto_emision='001',
                    defaults={'secuencial_actual': 0, 'configurado': False},
                )

            user_email = str(options.get('user_email') or '').strip()
            if user_email:
                user = Usuario.objects.filter(email__iexact=user_email).first()
                if user is None:
                    raise CommandError(
                        f'No existe un usuario con email {user_email}; '
                        'no se crea un usuario ficticio.'
                    )
                EmpresaMembresia.objects.update_or_create(
                    usuario=user,
                    empresa=empresa,
                    defaults={
                        'rol_empresa': EmpresaMembresia.RolEmpresaChoices.ADMIN_EMPRESA,
                        'activa': True,
                        'predeterminada': not bool(user.empresa_id),
                        'metadatos': {'origen': 'audit_of1_tenant_bootstrap'},
                        'creada_por': user,
                    },
                )

        self.stdout.write(self.style.SUCCESS(
            f'ERP inicializado para empresa {empresa.id}: establecimiento 001, '
            'punto 001 y secuenciales base.'
        ))
