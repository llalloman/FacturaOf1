"""Read-only audit of the database schema currently serving the application."""

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = (
        'Reporta migraciones pendientes y tablas/columnas faltantes sin ejecutar '
        'migraciones ni modificar la base de datos.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--fail-on-drift',
            action='store_true',
            help='Termina con error si encuentra cualquier diferencia.',
        )

    def _pending_migrations(self):
        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        return [
            migration.app_label + '.' + migration.name
            for migration, backwards in executor.migration_plan(targets)
            if not backwards
        ]

    def _missing_schema(self):
        introspection = connection.introspection
        tables = set(introspection.table_names())
        missing = []

        for model in apps.get_models():
            meta = model._meta
            if meta.proxy or not meta.managed:
                continue

            table = meta.db_table
            if table not in tables:
                missing.append(f'{table} (tabla)')
                continue

            columns = {
                column.name for column in introspection.get_table_description(connection.cursor(), table)
            }
            for field in meta.local_concrete_fields:
                if field.column not in columns:
                    missing.append(f'{table}.{field.column} (columna)')

        return missing

    def handle(self, *args, **options):
        pending = self._pending_migrations()
        missing = self._missing_schema()

        self.stdout.write(f'Migraciones pendientes: {len(pending)}')
        for migration in pending:
            self.stdout.write(f'  - {migration}')

        self.stdout.write(f'Tablas/columnas faltantes: {len(missing)}')
        for item in missing:
            self.stdout.write(f'  - {item}')

        if options['fail_on_drift'] and (pending or missing):
            raise CommandError('Se detectó drift de esquema; no se realizó ninguna escritura.')

        self.stdout.write(self.style.SUCCESS('Auditoría de esquema completada en modo read-only.'))
