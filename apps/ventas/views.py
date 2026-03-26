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
from apps.core.export_mixin import ExportMixin


class CajaViewSet(viewsets.ModelViewSet):
    serializer_class = CajaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['empresa', 'activa']
    search_fields = ['nombre', 'codigo']
    ordering_fields = ['nombre', 'codigo']
    ordering = ['nombre']
    
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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['caja', 'estado']
    search_fields = ['caja__nombre', 'caja__codigo', 'usuario__username']
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


class VentaViewSet(ExportMixin, viewsets.ModelViewSet):
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['caja', 'cliente', 'estado']
    search_fields = ['numero_venta', 'cliente__razon_social']
    ordering_fields = ['fecha_venta', 'total']
    ordering = ['-fecha_venta']
    export_filename = 'ventas'
    export_fields = [
        ('numero_venta', 'Nro. Venta'),
        ('fecha_venta', 'Fecha'),
        ('cliente__razon_social', 'Cliente'),
        ('cliente__identificacion', 'Identificación'),
        ('tipo_venta', 'Tipo'),
        ('estado', 'Estado'),
        ('subtotal', 'Subtotal'),
        ('descuento', 'Descuento'),
        ('iva', 'IVA'),
        ('total', 'Total'),
        ('genera_factura', 'Facturado'),
        ('caja__nombre', 'Caja'),
        ('usuario__username', 'Usuario'),
    ]
    
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
    
    @action(detail=True, methods=['post'])
    def generar_factura(self, request, pk=None):
        """Crea la Factura electrónica para esta venta y la envía al SRI."""
        from apps.facturacion.services.factura_service import crear_factura_desde_venta, procesar_factura_sri
        from apps.facturacion.serializers import FacturaSerializer
        from apps.facturacion.services.factura_service import (
            MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE,
            cliente_consumidor_final_supera_limite,
        )

        venta = self.get_object()
        # Validar readiness fiscal (onboarding)
        empresa = venta.empresa
        if not getattr(empresa, 'onboarding_completado', False):
            return Response(
                {'error': 'Debes completar la configuración fiscal de tu empresa para emitir facturas electrónicas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if venta.factura_id:
            return Response(
                {'error': 'Esta venta ya tiene una factura electrónica vinculada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cliente_consumidor_final_supera_limite(venta.cliente, venta.total):
            return Response(
                {'error': MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            factura = crear_factura_desde_venta(venta)
            sri_result = procesar_factura_sri(factura)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'factura': FacturaSerializer(factura, context={'request': request}).data,
            'sri': sri_result,
        })

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

    @action(detail=False, methods=['get'], url_path='reporte-ultimos-meses')
    def reporte_ultimos_meses(self, request):
        """Ventas totales de los últimos N meses (default 6), agrupadas por mes."""
        from calendar import monthrange
        from dateutil.relativedelta import relativedelta
        meses = int(request.query_params.get('meses', 6))
        ahora = timezone.now()
        resultado = []
        for i in range(meses - 1, -1, -1):
            fecha = ahora - relativedelta(months=i)
            mes, anio = fecha.month, fecha.year
            _, ultimo_dia = monthrange(anio, mes)
            inicio = timezone.datetime(anio, mes, 1, tzinfo=timezone.get_current_timezone())
            fin = timezone.datetime(anio, mes, ultimo_dia, 23, 59, 59, tzinfo=timezone.get_current_timezone())
            qs = self.get_queryset().filter(estado='COMPLETADA', fecha_venta__gte=inicio, fecha_venta__lte=fin)
            agg = qs.aggregate(total_ventas=Sum('total'), cantidad_ventas=Count('id'))
            resultado.append({
                'mes': mes,
                'anio': anio,
                'total_ventas': float(agg['total_ventas'] or 0),
                'cantidad_ventas': agg['cantidad_ventas'] or 0,
            })
        return Response(resultado)

    @action(detail=False, methods=['get'], url_path='proyecciones')
    def proyecciones(self, request):
        """
        Devuelve ventas históricas diarias + proyección por media móvil,
        y proyección de agotamiento de stock por producto.
        """
        from datetime import timedelta, date as date_type
        from apps.ventas.models import DetalleVenta

        dias_historial = int(request.query_params.get('dias', 30))
        dias_proyeccion = int(request.query_params.get('proyeccion', 14))
        ventana_ma = int(request.query_params.get('ventana', 7))  # media móvil N días

        hoy = timezone.now().date()
        inicio = hoy - timedelta(days=dias_historial - 1)

        # --- Ventas diarias históricas ---
        qs = self.get_queryset().filter(
            estado='COMPLETADA',
            fecha_venta__date__gte=inicio,
            fecha_venta__date__lte=hoy,
        )
        ventas_raw = (
            qs.values('fecha_venta__date')
            .annotate(total_dia=Sum('total'), cantidad=Count('id'))
            .order_by('fecha_venta__date')
        )
        ventas_por_dia = {
            str(v['fecha_venta__date']): float(v['total_dia'] or 0)
            for v in ventas_raw
        }
        historico = [
            {
                'fecha': str(inicio + timedelta(days=i)),
                'total': ventas_por_dia.get(str(inicio + timedelta(days=i)), 0.0),
            }
            for i in range(dias_historial)
        ]

        # --- Proyección: media móvil ponderada (días más recientes pesan más) ---
        valores = [d['total'] for d in historico]
        ventana = min(ventana_ma, len(valores))
        if ventana > 0:
            # Pesos lineales: el más reciente pesa más
            pesos = list(range(1, ventana + 1))
            ultimos = valores[-ventana:]
            promedio = sum(v * p for v, p in zip(ultimos, pesos)) / sum(pesos)
        else:
            promedio = 0.0

        proyeccion = [
            {'fecha': str(hoy + timedelta(days=i)), 'proyectado': round(promedio, 2)}
            for i in range(1, dias_proyeccion + 1)
        ]

        # --- Proyección de stock por producto ---
        empresa = getattr(request.user, 'empresa', None)
        proyeccion_stock = []
        if empresa:
            detalles_qs = (
                DetalleVenta.objects
                .filter(
                    venta__empresa=empresa,
                    venta__estado='COMPLETADA',
                    venta__fecha_venta__date__gte=inicio,
                )
                .values('producto_id', 'producto__nombre', 'producto__stock_actual', 'producto__maneja_inventario', 'producto__stock_minimo')
                .annotate(total_vendido=Sum('cantidad'))
                .order_by('-total_vendido')
            )
            for d in detalles_qs[:12]:
                tasa_diaria = float(d['total_vendido'] or 0) / dias_historial
                stock = float(d['producto__stock_actual'] or 0)
                dias_hasta_agotamiento = None
                if tasa_diaria > 0:
                    dias_hasta_agotamiento = round(stock / tasa_diaria, 1)
                proyeccion_stock.append({
                    'producto_id': d['producto_id'],
                    'nombre': d['producto__nombre'],
                    'stock_actual': round(stock, 2),
                    'stock_minimo': float(d['producto__stock_minimo'] or 0),
                    'vendido_periodo': float(d['total_vendido'] or 0),
                    'tasa_diaria': round(tasa_diaria, 2),
                    'dias_hasta_agotamiento': dias_hasta_agotamiento,
                    'maneja_inventario': d['producto__maneja_inventario'],
                })

        return Response({
            'historico': historico,
            'proyeccion': proyeccion,
            'proyeccion_stock': proyeccion_stock,
            'promedio_diario': round(promedio, 2),
            'dias_historial': dias_historial,
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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['apertura_caja', 'tipo']
    search_fields = ['descripcion', 'referencia']
    ordering_fields = ['fecha_movimiento', 'monto']
    ordering = ['-fecha_movimiento']
    
    def get_queryset(self):
        user = self.request.user
        queryset = MovimientoCaja.objects.select_related('apertura_caja__caja', 'usuario')
        
        if not user.is_superuser:
            queryset = queryset.filter(apertura_caja__caja__empresa=user.empresa)
        
        return queryset
