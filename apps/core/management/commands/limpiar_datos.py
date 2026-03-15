from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Elimina datos transaccionales manteniendo master data (empresas, clientes, productos, bodegas, suscripciones, usuarios)'

    def handle(self, *args, **options):
        self.stdout.write('Iniciando limpieza de datos transaccionales...')

        with transaction.atomic():
            # Facturación
            from apps.facturacion.models import (
                DetalleFactura, NotaCredito, DetalleNotaCredito,
                Factura, ComprobanteElectronico, Secuencial
            )
            DetalleNotaCredito.objects.all().delete()
            NotaCredito.objects.all().delete()
            DetalleFactura.objects.all().delete()
            Factura.objects.all().delete()
            ComprobanteElectronico.objects.all().delete()
            Secuencial.objects.all().delete()
            self.stdout.write('  ✓ facturacion')

            # Ventas
            from apps.ventas.models import PagoVenta, DetalleVenta, Venta, AperturaCaja, Caja
            PagoVenta.objects.all().delete()
            DetalleVenta.objects.all().delete()
            Venta.objects.all().delete()
            AperturaCaja.objects.all().delete()
            Caja.objects.all().delete()
            self.stdout.write('  ✓ ventas')

            # Pedidos
            from apps.pedidos.models import DetallePedido, Pedido, Mesa
            DetallePedido.objects.all().delete()
            Pedido.objects.all().delete()
            Mesa.objects.all().delete()
            self.stdout.write('  ✓ pedidos')

            # Cotizaciones
            from apps.cotizaciones.models import ItemCotizacion, Cotizacion
            ItemCotizacion.objects.all().delete()
            Cotizacion.objects.all().delete()
            self.stdout.write('  ✓ cotizaciones')

            # Contabilidad
            from apps.contabilidad.models import CuentaContable
            CuentaContable.objects.all().delete()
            self.stdout.write('  ✓ contabilidad')

            # Celery results
            try:
                from django_celery_results.models import TaskResult
                TaskResult.objects.all().delete()
                self.stdout.write('  ✓ celery results')
            except Exception:
                pass

            # Cartera
            try:
                from apps.cartera.models import CuentaPorCobrar, Pago
                Pago.objects.all().delete()
                CuentaPorCobrar.objects.all().delete()
                self.stdout.write('  ✓ cartera')
            except Exception:
                pass

            # Nomina
            try:
                from apps.nomina.models import RolPago, DetalleRolPago
                DetalleRolPago.objects.all().delete()
                RolPago.objects.all().delete()
                self.stdout.write('  ✓ nomina')
            except Exception:
                pass

            # Bancos movimientos
            try:
                from apps.bancos.models import MovimientoBanco
                MovimientoBanco.objects.all().delete()
                self.stdout.write('  ✓ bancos movimientos')
            except Exception:
                pass

        self.stdout.write(self.style.SUCCESS('LIMPIEZA COMPLETA'))
