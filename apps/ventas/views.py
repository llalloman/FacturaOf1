from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from django.db import transaction
from django.utils import timezone
from .models import Caja, AperturaCaja, Venta, MovimientoCaja
from .serializers import (
    CajaSerializer, AperturaCajaSerializer, VentaSerializer,
    VentaSyncSerializer, MovimientoCajaSerializer
)


class CajaViewSet(viewsets.ModelViewSet):
    serializer_class = CajaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['empresa', 'activa']
    search_fields = ['nombre', 'codigo']
    
    def _get_empresa(self):
        user = self.request.user
        if getattr(user, 'rol', None) == 'SUPER_ADMIN':
            return None  # SUPER_ADMIN puede ver todas las cajas
        return getattr(user, 'empresa', None)

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
            return Caja.objects.all()
        empresa = self._get_empresa()
        if empresa:
            return Caja.objects.filter(empresa=empresa)
        return Caja.objects.none()

    def perform_create(self, serializer):
        empresa = self._get_empresa()
        if empresa:
            serializer.save(empresa=empresa)
        else:
            serializer.save()

    @action(detail=False, methods=['post'])
    def init_default(self, request):
        """Crea una caja y bodega por defecto para la empresa si no existen."""
        from apps.inventarios.models import Bodega
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response({'error': 'No tienes empresa asignada.'}, status=status.HTTP_400_BAD_REQUEST)

        # Buscar o crear bodega principal
        bodega, _ = Bodega.objects.get_or_create(
            empresa=empresa,
            codigo='PRINCIPAL',
            defaults={'nombre': 'Bodega Principal', 'activa': True},
        )
        # Buscar o crear caja principal
        caja, created = Caja.objects.get_or_create(
            empresa=empresa,
            codigo='CAJA01',
            defaults={'nombre': 'Caja Principal', 'bodega': bodega, 'activa': True},
        )
        return Response(CajaSerializer(caja).data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)


class AperturaCajaViewSet(viewsets.ModelViewSet):
    serializer_class = AperturaCajaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['caja', 'estado']
    ordering_fields = ['fecha_apertura']
    ordering = ['-fecha_apertura']
    
    def get_queryset(self):
        user = self.request.user
        queryset = AperturaCaja.objects.select_related('caja', 'usuario')
        
        if not user.is_superuser:
            queryset = queryset.filter(caja__empresa=user.empresa)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        """Cerrar caja"""
        apertura = self.get_object()
        
        if apertura.estado != 'ABIERTA':
            return Response(
                {'error': 'La caja no está abierta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calcular totales
        ventas_total = Venta.objects.filter(
            caja=apertura.caja,
            fecha_venta__gte=apertura.fecha_apertura,
            estado='COMPLETADA'
        ).aggregate(total=Sum('total'))['total'] or 0
        
        movimientos = MovimientoCaja.objects.filter(
            apertura_caja=apertura
        )
        
        ingresos = movimientos.filter(tipo='INGRESO').aggregate(
            total=Sum('monto')
        )['total'] or 0
        
        egresos = movimientos.filter(tipo='EGRESO').aggregate(
            total=Sum('monto')
        )['total'] or 0
        
        # Actualizar apertura
        apertura.estado = 'CERRADA'
        apertura.fecha_cierre = timezone.now()
        apertura.monto_cierre = request.data.get('monto_cierre', 0)
        apertura.total_ventas = ventas_total
        apertura.total_ingresos = ingresos
        apertura.total_egresos = egresos
        
        esperado = apertura.monto_apertura + ventas_total + ingresos - egresos
        apertura.diferencia = apertura.monto_cierre - esperado
        
        apertura.save()
        
        serializer = self.get_serializer(apertura)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def actual(self, request):
        """Obtener apertura actual de una caja"""
        caja_id = request.query_params.get('caja_id')
        
        if not caja_id:
            return Response(
                {'error': 'Se requiere caja_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        apertura = AperturaCaja.objects.filter(
            caja_id=caja_id,
            estado='ABIERTA'
        ).first()
        
        if not apertura:
            return Response(
                {'error': 'No hay caja abierta'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(apertura)
        return Response(serializer.data)


class VentaViewSet(viewsets.ModelViewSet):
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['caja', 'cliente', 'estado']
    search_fields = ['numero_venta', 'cliente__razon_social']
    ordering_fields = ['fecha_venta', 'total']
    ordering = ['-fecha_venta']
    
    def get_queryset(self):
        user = self.request.user
        queryset = Venta.objects.select_related('caja', 'cliente', 'usuario', 'factura')
        queryset = queryset.prefetch_related('detalles__producto', 'pagos')

        if not user.is_superuser and getattr(user, 'rol', None) != 'SUPER_ADMIN':
            queryset = queryset.filter(caja__empresa=user.empresa)
        
        # Filtros por fecha
        fecha_desde = self.request.query_params.get('fecha_desde', None)
        fecha_hasta = self.request.query_params.get('fecha_hasta', None)
        
        if fecha_desde:
            queryset = queryset.filter(fecha_venta__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_venta__lte=fecha_hasta)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    @transaction.atomic
    def sync(self, request):
        """Sincronizar venta desde POS offline (TRANSACCIÓN ATÓMICA)"""
        serializer = VentaSyncSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            try:
                venta = serializer.save()
                return Response(
                    VentaSerializer(venta).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                return Response(
                    {'error': f'Error en transacción: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def anular(self, request, pk=None):
        """Anular venta y reversar inventario (TRANSACCIÓN ATÓMICA)"""
        venta = self.get_object()
        
        if venta.estado == 'ANULADA':
            return Response(
                {'error': 'La venta ya está anulada'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        motivo = request.data.get('motivo', '')
        if not motivo:
            return Response(
                {'error': 'Se requiere un motivo para anular'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Reversar movimientos de inventario
            from apps.inventarios.models import MovimientoInventario
            
            for detalle in venta.detalles.all():
                # Crear movimiento de reversión (AJUSTE_ENTRADA)
                MovimientoInventario.objects.create(
                    bodega=venta.caja.bodega,
                    producto=detalle.producto,
                    tipo_movimiento='AJUSTE_ENTRADA',
                    cantidad=detalle.cantidad,
                    costo_unitario=detalle.costo_unitario,
                    referencia=f'Anulación venta {venta.numero_venta} - {motivo}',
                    usuario=request.user
                )
            
            # Anular venta
            venta.estado = 'ANULADA'
            venta.save()
            
            serializer = self.get_serializer(venta)
            return Response(serializer.data)
            
        except Exception as e:
            return Response(
                {'error': f'Error al anular venta: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def reporte_mensual(self, request):
        """Ventas totales del mes indicado"""
        from calendar import monthrange
        mes = int(request.query_params.get('mes', timezone.now().month))
        anio = int(request.query_params.get('anio', timezone.now().year))
        _, ultimo_dia = monthrange(anio, mes)
        inicio = timezone.datetime(anio, mes, 1, tzinfo=timezone.get_current_timezone())
        fin = timezone.datetime(anio, mes, ultimo_dia, 23, 59, 59, tzinfo=timezone.get_current_timezone())

        qs = self.get_queryset().filter(
            estado='COMPLETADA', fecha_venta__gte=inicio, fecha_venta__lte=fin
        )
        totales = qs.aggregate(
            total_ventas=Sum('total'),
            cantidad_ventas=Count('id'),
        )
        return Response({
            'mes': mes, 'anio': anio,
            'total_ventas': totales['total_ventas'] or 0,
            'cantidad_ventas': totales['cantidad_ventas'] or 0,
        })

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Resumen de ventas"""
        queryset = self.get_queryset().filter(estado='COMPLETADA')
        
        totales = queryset.aggregate(
            total_ventas=Sum('total'),
            cantidad_ventas=Count('id'),
            total_descuentos=Sum('descuento')
        )
        
        # Ventas por método de pago
        from .models import PagoVenta
        pagos_resumen = PagoVenta.objects.filter(
            venta__in=queryset
        ).values('metodo_pago').annotate(
            total=Sum('monto')
        )
        
        return Response({
            'totales': totales,
            'por_metodo_pago': pagos_resumen
        })


class MovimientoCajaViewSet(viewsets.ModelViewSet):
    serializer_class = MovimientoCajaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['apertura_caja', 'tipo']
    ordering_fields = ['fecha_movimiento']
    ordering = ['-fecha_movimiento']
    
    def get_queryset(self):
        user = self.request.user
        queryset = MovimientoCaja.objects.select_related('apertura_caja__caja', 'usuario')
        
        if not user.is_superuser:
            queryset = queryset.filter(apertura_caja__caja__empresa=user.empresa)
        
        return queryset
