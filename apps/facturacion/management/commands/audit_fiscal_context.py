from collections import Counter

from django.core.management.base import BaseCommand, CommandError

from apps.facturacion.models import ComprobanteElectronico


class Command(BaseCommand):
    help = (
        'Audita el contexto fiscal de comprobantes existentes sin modificar datos. '
        'Identifica documentos legacy y referencias inconsistentes.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--empresa', type=int, help='Limita la auditoría a una empresa.')
        parser.add_argument('--limit', type=int, default=0, help='Limita filas detalladas; 0 muestra todas.')
        parser.add_argument('--fail-on-inconsistency', action='store_true', help='Falla si encuentra referencias fiscales inconsistentes.')
        parser.add_argument('--fail-on-legacy', action='store_true', help='Falla si encuentra comprobantes sin referencias fiscales nuevas.')

    def handle(self, *args, **options):
        queryset = ComprobanteElectronico.objects.select_related(
            'empresa', 'establecimiento_ref', 'punto_emision_ref',
        ).order_by('empresa_id', 'id')
        if options.get('empresa'):
            queryset = queryset.filter(empresa_id=options['empresa'])

        counters = Counter()
        inconsistencias = []
        total = 0
        for comprobante in queryset.iterator():
            total += 1
            establecimiento = comprobante.establecimiento_ref
            punto = comprobante.punto_emision_ref
            if not establecimiento and not punto:
                counters['legacy_sin_referencia'] += 1
                continue
            if not establecimiento or not punto:
                counters['referencia_incompleta'] += 1
                inconsistencias.append((comprobante, 'establecimiento_y_punto_deben_existir_juntos'))
                continue
            if establecimiento.empresa_id != comprobante.empresa_id:
                counters['establecimiento_empresa_incorrecta'] += 1
                inconsistencias.append((comprobante, 'establecimiento_empresa'))
            if punto.empresa_id != comprobante.empresa_id:
                counters['punto_empresa_incorrecta'] += 1
                inconsistencias.append((comprobante, 'punto_empresa'))
            if punto.establecimiento_id != establecimiento.id:
                counters['punto_padre_incorrecto'] += 1
                inconsistencias.append((comprobante, 'punto_establecimiento'))
            if establecimiento.codigo != comprobante.establecimiento:
                counters['codigo_establecimiento_diferente'] += 1
                inconsistencias.append((comprobante, 'codigo_establecimiento'))
            if punto.codigo != comprobante.punto_emision:
                counters['codigo_punto_diferente'] += 1
                inconsistencias.append((comprobante, 'codigo_punto'))

        self.stdout.write(f'Comprobantes auditados: {total}')
        for nombre, cantidad in sorted(counters.items()):
            self.stdout.write(f'{nombre}: {cantidad}')
        self.stdout.write(f'inconsistencias_detalladas: {len(inconsistencias)}')

        limit = options.get('limit') or 0
        for comprobante, motivo in inconsistencias[:limit or None]:
            self.stdout.write(
                self.style.WARNING(
                    f'id={comprobante.id} empresa={comprobante.empresa_id} '
                    f'numero={comprobante.numero_comprobante} motivo={motivo}'
                )
            )
        if inconsistencias:
            self.stdout.write(self.style.WARNING('Auditoría finalizada: requiere revisión; no se modificó ningún registro.'))
        else:
            self.stdout.write(self.style.SUCCESS('Auditoría finalizada sin inconsistencias referenciales.'))
        if options.get('fail_on_inconsistency') and inconsistencias:
            raise CommandError(
                f'La auditoría encontró {len(inconsistencias)} inconsistencia(s) fiscal(es).'
            )
        if options.get('fail_on_legacy') and counters.get('legacy_sin_referencia', 0):
            raise CommandError(
                'La auditoría encontró comprobantes legacy sin referencias fiscales nuevas.'
            )
