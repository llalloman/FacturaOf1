from rest_framework import mixins, viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q, Sum, F
from django.shortcuts import get_object_or_404
from datetime import timedelta
from django.utils import timezone
from .models import Bodega, StockProducto, LoteInventario, MovimientoInventario, TransferenciaInventario
from .serializers import (
    BodegaSerializer, StockProductoSerializer, LoteInventarioSerializer, MovimientoInventarioSerializer,
    TransferenciaInventarioSerializer
)
from apps.core.permissions import HasModuleAccess, is_global_platform_user, is_platform_user
from apps.core.tenant import ActiveCompanyWriteMixin, active_empresa, require_active_empresa, tenant_queryset


class BodegaViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    serializer_class = BodegaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['empresa', 'activa']
    search_fields = ['nombre', 'codigo']
    ordering_fields = ['nombre', 'fecha_creacion']
    ordering = ['nombre']
    
    def get_queryset(self):
        return tenant_queryset(self.request, Bodega.objects.all())

    def perform_create(self, serializer):
        serializer.save(empresa=require_active_empresa(self.request))


class StockProductoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = StockProductoSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega', 'producto']
    search_fields = ['producto__codigo', 'producto__nombre']
    ordering_fields = ['cantidad', 'ultima_actualizacion']
    ordering = ['-ultima_actualizacion']
    
    def get_queryset(self):
        queryset = tenant_queryset(
            self.request,
            StockProducto.objects.select_related('producto', 'bodega'),
            'bodega__empresa',
        )
        
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

    @action(detail=False, methods=['get'])
    def reconciliacion(self, request):
        """Compara el saldo material con el kardex sin modificar producción."""
        rows = []
        for stock in self.get_queryset().select_related('producto', 'bodega'):
            saldo_kardex = MovimientoInventario.objects.filter(
                empresa=stock.bodega.empresa, producto=stock.producto, bodega=stock.bodega,
            ).aggregate(total=Sum('cantidad'))['total'] or 0
            diferencia = stock.cantidad - saldo_kardex
            if diferencia:
                rows.append({
                    'producto_id': stock.producto_id, 'producto': stock.producto.nombre,
                    'bodega_id': stock.bodega_id, 'bodega': stock.bodega.nombre,
                    'stock_registrado': str(stock.cantidad), 'saldo_kardex': str(saldo_kardex),
                    'diferencia': str(diferencia),
                })
        return Response({'empresa_id': active_empresa(request).id if active_empresa(request) else None, 'inconsistencias': rows, 'total': len(rows)})


class LoteInventarioViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
    serializer_class = LoteInventarioSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega', 'producto', 'estado', 'activo']
    search_fields = ['numero_lote', 'producto__codigo_principal', 'producto__nombre']
    ordering_fields = ['fecha_caducidad', 'cantidad_disponible', 'fecha_creacion']
    ordering = ['fecha_caducidad', 'numero_lote']

    def get_queryset(self):
        return tenant_queryset(
            self.request,
            LoteInventario.objects.select_related('producto', 'bodega'),
        )

    def perform_create(self, serializer):
        serializer.save(empresa=require_active_empresa(self.request))

    def perform_destroy(self, instance):
        self._require_instance_active_empresa(instance)
        if instance.movimientos.exists():
            raise ValidationError({
                'detail': 'No se puede eliminar un lote con movimientos; desactívelo.'
            })
        instance.delete()

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


class MovimientoInventarioViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'inventarios'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bodega', 'producto', 'lote', 'tipo_movimiento']
    search_fields = ['producto__codigo_principal', 'producto__nombre', 'documento_referencia', 'lote__numero_lote']
    ordering_fields = ['fecha_movimiento']
    ordering = ['-fecha_movimiento']
    
    def get_queryset(self):
        queryset = tenant_queryset(
            self.request,
            MovimientoInventario.objects.select_related('producto', 'bodega', 'lote', 'usuario'),
            'bodega__empresa',
        )
        
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


class TransferenciaInventarioViewSet(ActiveCompanyWriteMixin, viewsets.ModelViewSet):
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
        empresa = active_empresa(self.request)
        queryset = TransferenciaInventario.objects.select_related(
            'bodega_origen', 'bodega_destino', 'usuario_envia', 'usuario_recibe'
        ).prefetch_related('detalles__producto')
        
        if empresa:
            queryset = queryset.filter(bodega_origen__empresa=empresa)
        elif not is_global_platform_user(user):
            # El permiso de módulo no convierte a soporte/auditoría en
            # administrador consolidado; deben seleccionar una empresa.
            queryset = queryset.none()

        return queryset
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def aprobar(self, request, pk=None):
        """Aprobar transferencia (TRANSACCIÓN ATÓMICA con LOCKS)"""
        transferencia = get_object_or_404(
            # PostgreSQL no permite bloquear el lado nullable de los
            # `select_related` (usuario_recibe). Lock solo de la transferencia;
            # los stocks se bloquean individualmente más abajo.
            self.get_queryset().select_for_update(of=('self',)),
            pk=pk,
        )
        
        if transferencia.estado in (
            TransferenciaInventario.EstadoChoices.EN_TRANSITO,
            TransferenciaInventario.EstadoChoices.RECIBIDA,
        ):
            return Response(self.get_serializer(transferencia).data)
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
            
            # El despacho solo descuenta el origen. La bodega destino no debe
            # disponer del stock hasta confirmar la recepcion fisica.
            for detalle in transferencia.detalles.all():
                MovimientoInventario.objects.get_or_create(
                    empresa=transferencia.empresa,
                    bodega=transferencia.bodega_origen,
                    producto=detalle.producto,
                    tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.TRANSFERENCIA_SALIDA,
                    documento_referencia=f'Transferencia #{transferencia.id} - salida',
                    defaults={
                        'cantidad': -detalle.cantidad_enviada,
                        'costo_unitario': detalle.producto.costo,
                        'usuario': request.user,
                    },
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
    @transaction.atomic
    def recibir(self, request, pk=None):
        """Confirmar la recepción física de una transferencia en tránsito."""
        transferencia = get_object_or_404(
            # PostgreSQL no permite bloquear el lado nullable de la relación
            # usuario_recibe; el stock se materializa en los movimientos y
            # queda protegido por la transacción del despacho/recepción.
            self.get_queryset().select_for_update(of=('self',)),
            pk=pk,
        )
        if transferencia.estado == TransferenciaInventario.EstadoChoices.RECIBIDA:
            return Response(self.get_serializer(transferencia).data)
        if transferencia.estado != TransferenciaInventario.EstadoChoices.EN_TRANSITO:
            return Response(
                {'error': 'Solo se pueden recibir transferencias en tránsito.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        transferencia.estado = TransferenciaInventario.EstadoChoices.RECIBIDA
        transferencia.fecha_recepcion = timezone.now()
        transferencia.usuario_recibe = request.user
        transferencia.save(update_fields=['estado', 'fecha_recepcion', 'usuario_recibe'])

        # La recepcion es el momento en que el inventario llega a destino.
        # get_or_create mantiene el endpoint seguro ante reintentos y permite
        # convivir con transferencias antiguas ya procesadas.
        for detalle in transferencia.detalles.all():
            referencia_entrada = f'Transferencia #{transferencia.id} - entrada'
            referencia_legacy = f'Transferencia #{transferencia.id}'
            if MovimientoInventario.objects.filter(
                empresa=transferencia.empresa,
                bodega=transferencia.bodega_destino,
                producto=detalle.producto,
                tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.TRANSFERENCIA_ENTRADA,
                documento_referencia__in=[referencia_entrada, referencia_legacy],
            ).exists():
                detalle.cantidad_recibida = detalle.cantidad_enviada
                detalle.save(update_fields=['cantidad_recibida'])
                continue
            movimiento_salida = MovimientoInventario.objects.filter(
                empresa=transferencia.empresa,
                bodega=transferencia.bodega_origen,
                producto=detalle.producto,
                tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.TRANSFERENCIA_SALIDA,
                documento_referencia=f'Transferencia #{transferencia.id} - salida',
            ).first()
            MovimientoInventario.objects.get_or_create(
                empresa=transferencia.empresa,
                bodega=transferencia.bodega_destino,
                producto=detalle.producto,
                tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.TRANSFERENCIA_ENTRADA,
                documento_referencia=referencia_entrada,
                defaults={
                    'cantidad': detalle.cantidad_enviada,
                    'costo_unitario': (
                        movimiento_salida.costo_unitario
                        if movimiento_salida else detalle.producto.costo
                    ),
                    'usuario': request.user,
                },
            )
            detalle.cantidad_recibida = detalle.cantidad_enviada
            detalle.save(update_fields=['cantidad_recibida'])
        return Response(self.get_serializer(transferencia).data)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def rechazar(self, request, pk=None):
        """Rechazar transferencia"""
        transferencia = get_object_or_404(
            self.get_queryset().select_for_update(),
            pk=pk,
        )
        
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
