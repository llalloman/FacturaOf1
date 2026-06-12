from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from .models import Zona, Mesa, Pedido, DetallePedido
from .serializers import (
    ZonaSerializer, MesaSerializer,
    PedidoSerializer, PedidoListSerializer,
    DetallePedidoSerializer, DetallePedidoCreateSerializer,
)
from apps.core.permissions import HasModuleAccess


def _empresa(user):
    """Retorna la empresa del usuario o None si es SUPER_ADMIN."""
    if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
        return None
    return getattr(user, 'empresa', None)


class ZonaViewSet(viewsets.ModelViewSet):
    serializer_class = ZonaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'pedidos'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activa']
    search_fields = ['nombre']
    ordering_fields = ['orden', 'nombre']
    ordering = ['orden', 'nombre']

    def get_queryset(self):
        qs = Zona.objects.annotate(mesas_count=Count('mesas'))
        empresa = _empresa(self.request.user)
        return qs.filter(empresa=empresa) if empresa else qs

    def perform_create(self, serializer):
        empresa = _empresa(self.request.user)
        serializer.save(empresa=empresa)


class MesaViewSet(viewsets.ModelViewSet):
    serializer_class = MesaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'pedidos'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['zona', 'estado', 'activa']
    search_fields = ['numero', 'nombre']
    ordering_fields = ['numero', 'nombre', 'zona__nombre']
    ordering = ['zona__nombre', 'numero']

    def get_queryset(self):
        qs = Mesa.objects.select_related('zona').prefetch_related('pedidos')
        empresa = _empresa(self.request.user)
        return qs.filter(empresa=empresa) if empresa else qs

    def perform_create(self, serializer):
        empresa = _empresa(self.request.user)
        serializer.save(empresa=empresa)

    @action(detail=True, methods=['post'])
    def liberar(self, request, pk=None):
        """Fuerza estado LIBRE en una mesa (ej: cuando se cancela un pedido manualmente)."""
        mesa = self.get_object()
        mesa.estado = 'LIBRE'
        mesa.save(update_fields=['estado'])
        return Response(MesaSerializer(mesa).data)


class PedidoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'pedidos'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['mesa', 'estado', 'tipo', 'caja']
    search_fields = ['numero_pedido', 'cliente__razon_social', 'mesa__numero']
    ordering_fields = ['fecha_apertura', 'total']
    ordering = ['-fecha_apertura']

    def get_serializer_class(self):
        if self.action == 'list':
            return PedidoListSerializer
        return PedidoSerializer

    def get_queryset(self):
        qs = Pedido.objects.select_related(
            'mesa', 'mesa__zona', 'usuario', 'cliente', 'caja', 'venta'
        ).annotate(items_count=Count('detalles'))
        empresa = _empresa(self.request.user)
        if empresa:
            qs = qs.filter(empresa=empresa)
        # Filtro rápido por estado activo
        activos = self.request.query_params.get('activos')
        if activos == '1':
            qs = qs.exclude(estado__in=['PAGADO', 'CANCELADO'])
        return qs

    def _recalcular_pedido_activo(self, pedido):
        """Normaliza totales de pedidos abiertos para evitar arrastre de centavos."""
        if pedido.estado in ('PAGADO', 'CANCELADO'):
            return pedido
        for detalle in pedido.detalles.exclude(estado='CANCELADO'):
            detalle.save()
        pedido.recalcular_totales()
        pedido.refresh_from_db(fields=['subtotal', 'iva', 'total'])
        return pedido

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        for pedido in queryset:
            self._recalcular_pedido_activo(pedido)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        pedido = self.get_object()
        self._recalcular_pedido_activo(pedido)
        serializer = self.get_serializer(pedido)
        return Response(serializer.data)

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['patch'])
    def cambiar_estado(self, request, pk=None):
        """Cambia el estado del pedido y actualiza la mesa si corresponde."""
        pedido = self.get_object()
        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in dict(Pedido.EstadoChoices.choices):
            return Response({'error': 'Estado inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        pedido.estado = nuevo_estado
        if nuevo_estado in ('PAGADO', 'CANCELADO'):
            pedido.fecha_cierre = timezone.now()
            if pedido.mesa:
                # Liberar mesa solo si no hay otro pedido activo
                otros = Pedido.objects.filter(
                    mesa=pedido.mesa
                ).exclude(id=pedido.id).exclude(estado__in=['PAGADO', 'CANCELADO']).exists()
                if not otros:
                    pedido.mesa.estado = 'LIBRE'
                    pedido.mesa.save(update_fields=['estado'])
        pedido.save()
        return Response(PedidoSerializer(pedido, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def agregar_item(self, request, pk=None):
        """Agrega uno o varios ítems al pedido."""
        pedido = self.get_object()
        if pedido.estado in ('PAGADO', 'CANCELADO'):
            return Response(
                {'error': 'No se puede modificar un pedido cerrado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = DetallePedidoCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        detalle = DetallePedido.objects.create(
            pedido=pedido,
            usuario=request.user,
            **ser.validated_data,
        )
        pedido.recalcular_totales()
        return Response(DetallePedidoSerializer(detalle).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='items/(?P<item_id>[^/.]+)')
    @transaction.atomic
    def eliminar_item(self, request, pk=None, item_id=None):
        """Cancela (marcado como CANCELADO) un ítem del pedido."""
        pedido = self.get_object()
        try:
            detalle = pedido.detalles.get(id=item_id)
        except DetallePedido.DoesNotExist:
            return Response({'error': 'Ítem no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        detalle.estado = 'CANCELADO'
        detalle.save(update_fields=['estado'])
        pedido.recalcular_totales()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cobrar(self, request, pk=None):
        """
        Convierte el pedido en una Venta.
        Espera los mismos parámetros que VentaSerializer (pagos, genera_factura, etc.)
        más los campos de caja requeridos.
        """
        from apps.ventas.models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta
        from apps.clientes.models import Cliente
        import uuid as uuid_lib
        from decimal import Decimal

        pedido = self.get_object()
        if pedido.estado == 'PAGADO':
            return Response({'error': 'El pedido ya fue cobrado.'}, status=status.HTTP_400_BAD_REQUEST)
        if pedido.estado == 'CANCELADO':
            return Response({'error': 'El pedido está cancelado.'}, status=status.HTTP_400_BAD_REQUEST)

        # Recalcular detalles activos con la lógica actual antes de cobrar.
        # Esto corrige ítems históricos que pudieron quedar con un centavo de arrastre.
        for detalle in pedido.detalles.exclude(estado='CANCELADO'):
            detalle.save()
        pedido.recalcular_totales()
        pedido.refresh_from_db(fields=['subtotal', 'iva', 'total'])

        pagos_data = request.data.get('pagos', [])
        genera_factura = request.data.get('genera_factura', False)
        cliente_id = request.data.get('cliente_id') or (pedido.cliente_id)
        caja_id = request.data.get('caja_id') or (pedido.caja_id)

        if not caja_id:
            return Response({'error': 'Se requiere caja_id.'}, status=status.HTTP_400_BAD_REQUEST)
        if not cliente_id:
            return Response({'error': 'Se requiere cliente_id (puede ser el Consumidor Final).'}, status=status.HTTP_400_BAD_REQUEST)
        if not pagos_data:
            return Response({'error': 'Se requiere al menos un pago.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            caja = Caja.objects.get(id=caja_id)
        except Caja.DoesNotExist:
            return Response({'error': 'Caja no encontrada.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cliente = Cliente.objects.get(id=cliente_id, empresa=pedido.empresa, activo=True)
        except Cliente.DoesNotExist:
            return Response({'error': 'Cliente no encontrado o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)

        if genera_factura:
            # Validar readiness fiscal (onboarding)
            empresa = pedido.empresa
            if not getattr(empresa, 'onboarding_completado', False):
                return Response({'error': 'Debes completar la configuración fiscal de tu empresa para emitir facturas electrónicas.'}, status=status.HTTP_400_BAD_REQUEST)
            from apps.facturacion.services.factura_service import (
                MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE,
                cliente_consumidor_final_supera_limite,
            )
            if cliente_consumidor_final_supera_limite(cliente, pedido.total):
                return Response({'error': MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE}, status=status.HTTP_400_BAD_REQUEST)

        # Obtener o crear apertura de caja
        apertura = AperturaCaja.objects.filter(caja=caja, estado='ABIERTA').first()
        if not apertura:
            from decimal import Decimal as D
            apertura = AperturaCaja.objects.create(
                caja=caja, usuario=request.user, estado='ABIERTA', monto_apertura=D('0.00')
            )

        # Calcular subtotales por tarifa de IVA (requeridos por generar_xml_factura)
        from decimal import Decimal as _D
        subtotal_0 = _D('0.00')
        subtotal_12 = _D('0.00')
        subtotal_15 = _D('0.00')
        descuento_total = _D('0.00')
        for d in pedido.detalles.exclude(estado='CANCELADO'):
            pct = getattr(d.producto, 'porcentaje_iva', '4')
            descuento_total += Decimal(str(d.descuento or '0.00'))
            if pct == '4':
                subtotal_15 += d.subtotal
            elif pct in ('0', '6', '7'):
                subtotal_0 += d.subtotal
            else:
                subtotal_12 += d.subtotal

        # Crear la Venta
        venta = Venta.objects.create(
            empresa=pedido.empresa,
            numero_venta=f"V-{uuid_lib.uuid4().hex[:8].upper()}",
            caja=caja,
            apertura_caja=apertura,
            usuario=request.user,
            cliente_id=cliente_id,
            tipo_venta='PEDIDO',
            estado='COMPLETADA',
            subtotal=pedido.subtotal,
            subtotal_0=subtotal_0,
            subtotal_12=subtotal_12,
            subtotal_15=subtotal_15,
            iva=pedido.iva,
            total=pedido.total,
            descuento=descuento_total.quantize(Decimal('0.01')),
            genera_factura=genera_factura,
        )

        # Trasladar detalles activos
        for d in pedido.detalles.exclude(estado='CANCELADO'):
            DetalleVenta.objects.create(
                venta=venta,
                producto=d.producto,
                cantidad=d.cantidad,
                precio_unitario=d.precio_unitario,
                descuento=d.descuento,
                subtotal=d.subtotal,
                iva=d.iva,
                total=d.subtotal + d.iva,
                costo_unitario=d.producto.costo,
            )

        # Registrar pagos
        for p in pagos_data:
            PagoVenta.objects.create(
                venta=venta,
                forma_pago=p.get('forma_pago', 'EFECTIVO'),
                monto=p.get('monto', 0),
                referencia=p.get('referencia', ''),
            )

        # Marcar pedido como pagado
        pedido.estado = 'PAGADO'
        pedido.venta = venta
        pedido.fecha_cierre = timezone.now()
        pedido.save(update_fields=['estado', 'venta', 'fecha_cierre'])

        # Liberar mesa
        if pedido.mesa:
            otros = Pedido.objects.filter(
                mesa=pedido.mesa
            ).exclude(id=pedido.id).exclude(estado__in=['PAGADO', 'CANCELADO']).exists()
            if not otros:
                pedido.mesa.estado = 'LIBRE'
                pedido.mesa.save(update_fields=['estado'])

        # Auto-factura electrónica
        if genera_factura:
            try:
                from apps.facturacion.services.factura_service import (
                    crear_factura_desde_venta, procesar_factura_sri,
                )
                factura = crear_factura_desde_venta(venta)
                procesar_factura_sri(factura)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error generando factura desde pedido {pedido.id}: {e}", exc_info=True)

        from apps.ventas.serializers import VentaSerializer
        return Response(VentaSerializer(venta, context={'request': request}).data, status=status.HTTP_201_CREATED)


class DetallePedidoViewSet(viewsets.ModelViewSet):
    """
    CRUD de ítems individuales.  Útil para actualizar estado desde una pantalla de cocina.
    """
    serializer_class = DetallePedidoSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'pedidos'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['pedido', 'estado']
    search_fields = ['producto__nombre', 'producto__codigo_principal']
    ordering_fields = ['id']
    ordering = ['id']

    def get_queryset(self):
        qs = DetallePedido.objects.select_related('producto', 'pedido', 'usuario')
        empresa = _empresa(self.request.user)
        if empresa:
            qs = qs.filter(pedido__empresa=empresa)
        return qs

    @action(detail=True, methods=['patch'])
    def cambiar_estado(self, request, pk=None):
        detalle = self.get_object()
        nuevo = request.data.get('estado')
        if nuevo not in dict(DetallePedido.EstadoItemChoices.choices):
            return Response({'error': 'Estado inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        detalle.estado = nuevo
        detalle.save(update_fields=['estado'])
        return Response(DetallePedidoSerializer(detalle).data)
