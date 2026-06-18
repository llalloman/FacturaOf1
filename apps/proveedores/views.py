from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from .models import (
    Proveedor, ProveedorProducto, OrdenCompra, RecepcionCompra,
    CuentaPorPagar, PagoProveedor
)
from .serializers import (
    ProveedorSerializer, ProveedorProductoSerializer, OrdenCompraSerializer,
    RecepcionCompraSerializer, CuentaPorPagarSerializer,
    PagoProveedorSerializer
)
from apps.core.permissions import IsAuthenticated, IsTenantUser, HasModuleAccess


class ProveedorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de proveedores
    """
    serializer_class = ProveedorSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, HasModuleAccess]
    module_required = 'proveedores'
    filterset_fields = ['activo', 'tipo_identificacion']
    search_fields = ['identificacion', 'razon_social', 'nombre_comercial']
    ordering_fields = ['razon_social', 'creado_en']
    ordering = ['razon_social']
    
    def get_queryset(self):
        return Proveedor.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('empresa')
    
    @action(detail=True, methods=['get'])
    def estadisticas(self, request, pk=None):
        """Estadísticas del proveedor"""
        proveedor = self.get_object()
        
        ordenes = proveedor.ordenes_compra.all()
        cuentas = proveedor.cuentas_por_pagar.all()
        
        return Response({
            'total_ordenes': ordenes.count(),
            'ordenes_pendientes': ordenes.filter(
                estado__in=['ENVIADA', 'PARCIAL']
            ).count(),
            'total_compras': sum(o.total for o in ordenes),
            'total_deuda': sum(
                c.saldo for c in cuentas.filter(estado__in=['PENDIENTE', 'PARCIAL'])
            ),
            'facturas_vencidas': cuentas.filter(
                estado__in=['PENDIENTE', 'PARCIAL'],
                fecha_vencimiento__lt=timezone.now().date()
            ).count()
        })


class ProveedorProductoViewSet(viewsets.ModelViewSet):
    serializer_class = ProveedorProductoSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, HasModuleAccess]
    module_required = 'proveedores'
    filterset_fields = ['proveedor', 'producto', 'activo', 'es_preferido']
    search_fields = [
        'proveedor__razon_social', 'producto__nombre',
        'producto__codigo_principal', 'codigo_proveedor',
    ]
    ordering = ['producto__nombre', '-es_preferido']

    def get_queryset(self):
        return ProveedorProducto.objects.filter(
            empresa=self.request.user.empresa,
        ).select_related('proveedor', 'producto')


class OrdenCompraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de órdenes de compra
    """
    serializer_class = OrdenCompraSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, HasModuleAccess]
    module_required = 'proveedores'
    filterset_fields = ['estado', 'proveedor', 'bodega_destino']
    search_fields = ['numero_orden']
    ordering_fields = ['fecha_orden', 'numero_orden', 'total']
    ordering = ['-fecha_orden']
    
    def get_queryset(self):
        return OrdenCompra.objects.filter(
            empresa=self.request.user.empresa
        ).select_related(
            'empresa', 'proveedor', 'bodega_destino', 'creado_por'
        ).prefetch_related('detalles__producto')
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def enviar(self, request, pk=None):
        """Marcar orden como enviada al proveedor"""
        orden = self.get_object()
        
        if orden.estado != OrdenCompra.EstadoChoices.BORRADOR:
            return Response(
                {'error': 'Solo se pueden enviar órdenes en borrador'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        orden.estado = OrdenCompra.EstadoChoices.ENVIADA
        orden.save()
        
        return Response({
            'message': 'Orden enviada correctamente',
            'orden': OrdenCompraSerializer(orden).data
        })
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancelar(self, request, pk=None):
        """Cancelar una orden de compra"""
        orden = self.get_object()
        
        if orden.estado == OrdenCompra.EstadoChoices.RECIBIDA:
            return Response(
                {'error': 'No se puede cancelar una orden ya recibida'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar si tiene recepciones
        if orden.recepciones.filter(estado='RECIBIDA').exists():
            return Response(
                {'error': 'No se puede cancelar una orden con recepciones confirmadas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        orden.estado = OrdenCompra.EstadoChoices.CANCELADA
        orden.save()
        
        return Response({
            'message': 'Orden cancelada correctamente'
        })
    
    @action(detail=False, methods=['get'])
    def pendientes(self, request):
        """Órdenes pendientes de recibir"""
        ordenes = self.get_queryset().filter(
            estado__in=[
                OrdenCompra.EstadoChoices.ENVIADA,
                OrdenCompra.EstadoChoices.PARCIAL
            ]
        )
        
        serializer = self.get_serializer(ordenes, many=True)
        return Response(serializer.data)


class RecepcionCompraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de recepciones de compra
    """
    serializer_class = RecepcionCompraSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, HasModuleAccess]
    module_required = 'proveedores'
    filterset_fields = ['estado', 'orden_compra', 'bodega']
    search_fields = ['numero_recepcion', 'numero_factura_proveedor']
    ordering_fields = ['fecha_recepcion', 'numero_recepcion']
    ordering = ['-fecha_recepcion']
    
    def get_queryset(self):
        return RecepcionCompra.objects.filter(
            empresa=self.request.user.empresa
        ).select_related(
            'empresa', 'orden_compra__proveedor', 'bodega', 'recibido_por'
        ).prefetch_related('detalles__detalle_orden__producto')
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def confirmar(self, request, pk=None):
        """Confirmar recepción y actualizar inventario"""
        from apps.inventarios.models import MovimientoInventario
        
        recepcion = self.get_object()
        
        if recepcion.estado != RecepcionCompra.EstadoChoices.BORRADOR:
            return Response(
                {'error': 'Solo se pueden confirmar recepciones en borrador'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Actualizar cantidades recibidas en la orden
        for detalle_recep in recepcion.detalles.all():
            detalle_orden = detalle_recep.detalle_orden
            detalle_orden.cantidad_recibida += detalle_recep.cantidad_recibida
            detalle_orden.save()

            producto = detalle_orden.producto
            if producto.tipo == 'BIEN' and producto.maneja_inventario:
                # Crear movimiento solo para bienes que controlan existencias.
                MovimientoInventario.objects.create(
                    empresa=recepcion.empresa,
                    producto=producto,
                    bodega=recepcion.bodega,
                    tipo_movimiento=MovimientoInventario.TipoMovimientoChoices.ENTRADA_COMPRA,
                    cantidad=detalle_recep.cantidad_recibida,
                    costo_unitario=detalle_recep.costo_unitario,
                    documento_referencia=f"Recepción {recepcion.numero_recepcion}",
                    observaciones=f"OC: {recepcion.orden_compra.numero_orden}",
                    usuario=request.user,
                )

            from .models import ProveedorProducto
            relacion, _ = ProveedorProducto.objects.update_or_create(
                empresa=recepcion.empresa,
                proveedor=recepcion.orden_compra.proveedor,
                producto=producto,
                defaults={
                    'costo_referencia': detalle_recep.costo_unitario,
                    'activo': True,
                },
            )
            if not producto.proveedores_catalogo.filter(
                empresa=recepcion.empresa,
                es_preferido=True,
            ).exists():
                relacion.es_preferido = True
                relacion.save(update_fields=['es_preferido'])

            producto.costo = detalle_recep.costo_unitario
            producto.save(update_fields=['costo'])
        
        # Actualizar estado de la orden
        orden = recepcion.orden_compra
        orden.actualizar_estado_recepcion()
        orden.save()
        
        # Marcar recepción como confirmada
        recepcion.estado = RecepcionCompra.EstadoChoices.RECIBIDA
        recepcion.save()
        
        # Crear cuenta por pagar si no existe
        if not hasattr(recepcion, 'cuenta_por_pagar'):
            # Calcular total de la recepción
            total = sum(
                d.cantidad_recibida * d.costo_unitario
                for d in recepcion.detalles.all()
            )
            
            # Calcular fecha de vencimiento según días de crédito
            proveedor = orden.proveedor
            fecha_vencimiento = recepcion.fecha_recepcion + timedelta(
                days=proveedor.dias_credito
            )
            
            # Generar número de cuenta
            empresa = recepcion.empresa
            ultimo = CuentaPorPagar.objects.filter(empresa=empresa).order_by('-id').first()
            siguiente_num = 1 if not ultimo else int(ultimo.numero_cuenta.split('-')[-1]) + 1
            numero_cuenta = f"{empresa.id}-CP-{siguiente_num:06d}"
            
            CuentaPorPagar.objects.create(
                empresa=recepcion.empresa,
                proveedor=proveedor,
                recepcion=recepcion,
                numero_cuenta=numero_cuenta,
                fecha_emision=recepcion.fecha_recepcion,
                fecha_vencimiento=fecha_vencimiento,
                monto_total=total,
                saldo=total
            )
        
        return Response({
            'message': 'Recepción confirmada correctamente',
            'recepcion': RecepcionCompraSerializer(recepcion).data
        })
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancelar(self, request, pk=None):
        """Cancelar una recepción"""
        recepcion = self.get_object()
        
        if recepcion.estado == RecepcionCompra.EstadoChoices.RECIBIDA:
            return Response(
                {'error': 'No se puede cancelar una recepción ya confirmada'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        recepcion.estado = RecepcionCompra.EstadoChoices.CANCELADA
        recepcion.save()
        
        return Response({
            'message': 'Recepción cancelada correctamente'
        })


class CuentaPorPagarViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de cuentas por pagar
    """
    serializer_class = CuentaPorPagarSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, HasModuleAccess]
    module_required = 'proveedores'
    filterset_fields = ['estado', 'proveedor']
    search_fields = ['numero_cuenta']
    ordering_fields = ['fecha_vencimiento', 'fecha_emision', 'monto_total']
    ordering = ['fecha_vencimiento']
    
    def get_queryset(self):
        return CuentaPorPagar.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('empresa', 'proveedor', 'recepcion')
    
    @action(detail=False, methods=['get'])
    def vencidas(self, request):
        """Cuentas por pagar vencidas"""
        hoy = timezone.now().date()
        
        cuentas = self.get_queryset().filter(
            estado__in=['PENDIENTE', 'PARCIAL'],
            fecha_vencimiento__lt=hoy
        )
        
        serializer = self.get_serializer(cuentas, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def por_vencer(self, request):
        """Cuentas por pagar próximas a vencer (próximos 7 días)"""
        hoy = timezone.now().date()
        fecha_limite = hoy + timedelta(days=7)
        
        cuentas = self.get_queryset().filter(
            estado__in=['PENDIENTE', 'PARCIAL'],
            fecha_vencimiento__gte=hoy,
            fecha_vencimiento__lte=fecha_limite
        )
        
        serializer = self.get_serializer(cuentas, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Resumen de cuentas por pagar"""
        queryset = self.get_queryset()
        hoy = timezone.now().date()
        
        pendientes = queryset.filter(estado__in=['PENDIENTE', 'PARCIAL'])
        
        return Response({
            'total_deuda': sum(c.saldo for c in pendientes),
            'cuentas_pendientes': pendientes.count(),
            'cuentas_vencidas': pendientes.filter(fecha_vencimiento__lt=hoy).count(),
            'total_vencido': sum(
                c.saldo for c in pendientes.filter(fecha_vencimiento__lt=hoy)
            ),
            'por_vencer_7dias': pendientes.filter(
                fecha_vencimiento__gte=hoy,
                fecha_vencimiento__lte=hoy + timedelta(days=7)
            ).count()
        })


class PagoProveedorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de pagos a proveedores
    """
    serializer_class = PagoProveedorSerializer
    permission_classes = [IsAuthenticated, IsTenantUser, HasModuleAccess]
    module_required = 'proveedores'
    filterset_fields = ['proveedor', 'cuenta_por_pagar', 'forma_pago']
    search_fields = ['numero_pago', 'numero_documento']
    ordering_fields = ['fecha_pago', 'monto']
    ordering = ['-fecha_pago']
    
    def get_queryset(self):
        return PagoProveedor.objects.filter(
            empresa=self.request.user.empresa
        ).select_related(
            'empresa', 'proveedor', 'cuenta_por_pagar',
            'cuenta_bancaria', 'movimiento_bancario', 'registrado_por'
        )
    
    @action(detail=False, methods=['get'])
    def por_proveedor(self, request):
        """Pagos agrupados por proveedor"""
        proveedor_id = request.query_params.get('proveedor_id')
        
        if not proveedor_id:
            return Response(
                {'error': 'Debe proporcionar proveedor_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        pagos = self.get_queryset().filter(proveedor_id=proveedor_id)
        
        serializer = self.get_serializer(pagos, many=True)
        return Response({
            'total_pagado': sum(p.monto for p in pagos),
            'cantidad_pagos': pagos.count(),
            'pagos': serializer.data
        })
