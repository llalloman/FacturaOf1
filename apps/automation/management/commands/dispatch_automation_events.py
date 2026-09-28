from django.core.management.base import BaseCommand

from apps.automation.services.dispatcher import dispatch_pending_events


class Command(BaseCommand):
    help = 'Inspecciona o despacha eventos Automation pendientes de forma idempotente.'

    def add_arguments(self, parser):
        parser.add_argument('--send', action='store_true', help='Habilita el envío HTTP explícito.')
        parser.add_argument('--limit', type=int, default=50)
        parser.add_argument('--timeout', type=int, default=10)

    def handle(self, *args, **options):
        summary = dispatch_pending_events(
            limit=max(1, options['limit']),
            send=options['send'],
            timeout=max(1, options['timeout']),
        )
        self.stdout.write(self.style.SUCCESS(str(summary)))
