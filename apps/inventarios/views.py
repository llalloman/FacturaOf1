from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q, Sum, F
from datetime import timedelta
from django.utils import timezone
from .models import Bodega, StockProducto, LoteInventario, MovimientoInventario, TransferenciaInventario
from .serializers import (
    BodegaSerializer, StockProductoSerializer, LoteInventarioSerializer, MovimientoInventarioSerializer,
    TransferenciaInventarioSerializer
)
from apps.core.permissions import HasModuleAccess


class BodegaViewSet(viewsets.ModelViewSet):
    serializer_class = BodegaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['empresa', 'activa']
    search_fields = ['nombre', 'codigo']
    ordering_fields = ['nombre', 'fecha_creacion']
    ordering = ['nombre']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Bodega.objects.all()
        return Bodega.objects.filter(empresa=user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


class StockProductoViewSet(viewsets.ModelViewSet):
    serializer_class = StockProductoSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega', 'producto']
    search_fields = ['producto__codigo', 'producto__nombre']
    ordering_fields = ['cantidad', 'ultima_actualizacion']
    ordering = ['-ultima_actualizacion']
    
    def get_queryset(self):
        user = self.request.user
        queryset = StockProducto.objects.select_related('producto', 'bodega')
        
        if not user.is_superuser:
            queryset = queryset.filter(bodega__empresa=user.empresa)
        
        # Filtro por stock bajo
        stock_bajo = self.request.query_params.get('stock_bajo', None)
        if stock_bajo == 'true':
            queryset = queryset.filter(
                cantidad__lte=F('producto__stock_minimo')
            )
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def alertas(self, request):
        """Productos con stock bajo o agotados"""
        queryset = self.get_queryset().filter(
            Q(cantidad__lte=F('producto__stock_minimo')) | Q(cantidad=0)
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class LoteInventarioViewSet(viewsets.ModelViewSet):
    serializer_class = LoteInventarioSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega', 'producto', 'estado', 'activo']
    search_fields = ['numero_lote', 'producto__codigo_principal', 'producto__nombre']
    ordering_fields = ['fecha_caducidad', 'cantidad_disponible', 'fecha_creacion']
    ordering = ['fecha_caducidad', 'numero_lote']

    def get_queryset(self):
        user = self.request.user
        queryset = LoteInventario.objects.select_related('producto', 'bodega')
        if not user.is_superuser:
            queryset = queryset.filter(empresa=user.empresa)
        return queryset

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    @action(detail=False, methods=['get'])
    def alertas_caducidad(self, request):
        dias = int(request.query_params.get('dias', 30) or 30)
        hoy = timezone.now().date()
        limite = hoy + timedelta(days=max(0, dias))
        queryset = self.get_queryset().filter(
            activo=True,
            cantidad_disponible__gt=0,
            fecha_caducidad__isnull=False,
            fecha_caducidad__lte=limite,
        ).order_by('fecha_caducidad')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega', 'producto', 'lote', 'tipo_movimiento']
    search_fields = ['producto__codigo_principal', 'producto__nombre', 'documento_referencia', 'lote__numero_lote']
    ordering_fields = ['fecha_movimiento']
    ordering = ['-fecha_movimiento']
    
    def get_queryset(self):
        user = self.request.user
        queryset = MovimientoInventario.objects.select_related('producto', 'bodega', 'lote', 'usuario')
        
        if not user.is_superuser:
            queryset = queryset.filter(bodega__empresa=user.empresa)
        
        # Filtros adicionales
        fecha_desde = self.request.query_params.get('fecha_desde', None)
        fecha_hasta = self.request.query_params.get('fecha_hasta', None)
        
        if fecha_desde:
            queryset = queryset.filter(fecha_movimiento__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_movimiento__lte=fecha_hasta)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def kardex(self, request):
        """Kardex de un producto en una bodega"""
        producto_id = request.query_params.get('producto_id')
        bodega_id = request.query_params.get('bodega_id')
        
        if not producto_id or not bodega_id:
            return Response(
                {'error': 'Se requiere producto_id y bodega_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        movimientos = self.get_queryset().filter(
            producto_id=producto_id,
            bodega_id=bodega_id
        ).order_by('fecha_movimiento')

        lote_id = request.query_params.get('lote_id')
        if lote_id:
            movimientos = movimientos.filter(lote_id=lote_id)
        
        serializer = self.get_serializer(movimientos, many=True)
        return Response(serializer.data)


class TransferenciaInventarioViewSet(viewsets.ModelViewSet):
    serializer_class = TransferenciaInventarioSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega_origen', 'bodega_destino', 'estado']
    search_fields = ['observaciones', 'bodega_origen__nombre', 'bodega_destino__nombre']
    ordering_fields = ['fecha_envio']
    ordering = ['-fecha_envio']
    
    def get_queryset(self):
        user = self.request.user
        queryset = TransferenciaInventario.objects.select_related(
            'bodega_origen', 'bodega_destino', 'usuario_envia', 'usuario_recibe'
        ).prefetch_related('detalles__producto')
        
        if not user.is_superuser:
            queryset = queryset.filter(bodega_origen__empresa=user.empresa)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def aprobar(self, request, pk=None):
        """Aprobar transferencia (TRANSACCIÓN ATÓMICA con LOCKS)"""
        transferencia = self.get_object()
        
        if transferencia.estado != 'PENDIENTE':
            return Response(
                {'error': 'Solo se pueden aprobar transferencias pendientes'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Verificar stock disponible ANTES de aprobar (con lock para evitar race conditions)
            from apps.inventarios.models import StockProducto
            
            for detalle in transferencia.detalles.all():
                stock = StockProducto.objects.select_for_update().get(
                    bodega=transferencia.bodega_origen,
                    producto=detalle.producto
                )
                
                if stock.cantidad < detalle.cantidad_enviada:
                    raise ValueError(
                        f'Stock insuficiente para {detalle.producto.nombre}. '
                        f'Disponible: {stock.cantidad}, Requerido: {detalle.cantidad_enviada}'
                    )
            
            transferencia.estado = TransferenciaInventario.EstadoChoices.EN_TRANSITO
            transferencia.save()
            
            # Crear movimientos de inventario
            for detalle in transferencia.detalles.all():
                # Salida de bodega origen
                MovimientoInventario.objects.create(
                    empresa=transferencia.empresa,
                    bodega=transferencia.bodega_origen,
                    producto=detalle.producto,
                    tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.TRANSFERENCIA_SALIDA,
                    cantidad=-detalle.cantidad_enviada,
                    costo_unitario=detalle.producto.costo,
                    documento_referencia=f'Transferencia #{transferencia.id}',
                    usuario=request.user
                )
                
                # Entrada a bodega destino
                MovimientoInventario.objects.create(
                    empresa=transferencia.empresa,
                    bodega=transferencia.bodega_destino,
                    producto=detalle.producto,
                    tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.TRANSFERENCIA_ENTRADA,
                    cantidad=detalle.cantidad_enviada,
                    costo_unitario=detalle.producto.costo,
                    documento_referencia=f'Transferencia #{transferencia.id}',
                    usuario=request.user
                )
            
            serializer = self.get_serializer(transferencia)
            return Response(serializer.data)
        
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error en transacción: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        """Rechazar transferencia"""
        transferencia = self.get_object()
        
        if transferencia.estado != 'PENDIENTE':
            return Response(
                {'error': 'Solo se pueden rechazar transferencias pendientes'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transferencia.estado = TransferenciaInventario.EstadoChoices.CANCELADA
        transferencia.observaciones = request.data.get('observaciones', '')
        transferencia.save()
        
        serializer = self.get_serializer(transferencia)
        return Response(serializer.data)
