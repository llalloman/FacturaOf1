from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from django.db import transaction
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
from .models import Caja, AperturaCaja, Venta, PagoVenta, MovimientoCaja
from .serializers import (
    CajaSerializer, AperturaCajaSerializer, VentaSerializer,
    VentaSyncSerializer, MovimientoCajaSerializer
)
from apps.core.export_mixin import ExportMixin
from apps.core.permissions import HasModuleAccess


class CajaViewSet(viewsets.ModelViewSet):
    serializer_class = CajaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = ['ventas', 'pos']
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
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = ['ventas', 'pos']
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
        
        ventas_qs = Venta.objects.filter(
            caja=apertura.caja,
            fecha_venta__gte=apertura.fecha_apertura,
            estado='COMPLETADA'
        )
        ventas_total = ventas_qs.aggregate(total=Sum('total'))['total'] or 0
        efectivo_ventas = ventas_qs.filter(pagos__forma_pago='EFECTIVO').aggregate(total=Sum('pagos__monto'))['total'] or 0
        
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
        
        esperado = apertura.monto_apertura + efectivo_ventas + ingresos - egresos
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
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = ['ventas', 'pos']
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
        queryset = Venta.objects.select_related('caja', 'cliente', 'usuario', 'factura', 'factura__comprobante')
        queryset = queryset.prefetch_related('detalles__producto', 'pagos')

        if not user.is_superuser and getattr(user, 'rol', None) != 'SUPER_ADMIN':
            queryset = queryset.filter(caja__empresa=user.empresa)
        
        # Filtros por fecha
        fecha_desde = self.request.query_params.get('fecha_desde', None)
        fecha_hasta = self.request.query_params.get('fecha_hasta', None)
        
        if fecha_desde:
            queryset = queryset.filter(fecha_venta__date__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_venta__date__lte=fecha_hasta)

        vista = (self.request.query_params.get('vista') or '').lower()
        if vista == 'cerradas':
            queryset = queryset.filter(estado='COMPLETADA').exclude(
                factura__comprobante__estado='ANULADO'
            )
        elif vista == 'anuladas':
            queryset = queryset.filter(
                Q(estado='ANULADA') | Q(factura__comprobante__estado='ANULADO')
            ).distinct()
        
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



    @action(detail=True, methods=['post'], url_path='marcar-pago')
    @transaction.atomic
    def marcar_pago(self, request, pk=None):
        """Marca un pago de la venta como pagado y crea el movimiento bancario."""
        venta = self.get_object()
        if venta.estado == 'ANULADA':
            return Response({'detail': 'No se puede registrar pago de una venta anulada.'}, status=400)

        pago_id = request.data.get('pago') or request.data.get('pago_id')
        if not pago_id:
            return Response({'detail': 'Se requiere pago.'}, status=400)

        try:
            pago = venta.pagos.select_related('cuenta_bancaria', 'movimiento_bancario', 'venta__cliente').get(pk=pago_id)
        except PagoVenta.DoesNotExist:
            return Response({'detail': 'El pago no pertenece a esta venta.'}, status=404)

        if pago.estado_pago == PagoVenta.EstadoPagoChoices.PAGADO and pago.movimiento_bancario_id:
            return Response({'detail': 'Este pago ya está marcado como pagado.'}, status=400)

        cuenta = pago.cuenta_bancaria
        cuenta_id = request.data.get('cuenta_bancaria')
        if cuenta_id:
            from apps.bancos.models import CuentaBancaria
            cuenta = CuentaBancaria.objects.filter(pk=cuenta_id, empresa=venta.empresa, activa=True).first()
            if not cuenta:
                return Response({'detail': 'Cuenta bancaria no encontrada o inactiva.'}, status=404)

        fecha_pago = request.data.get('fecha_pago')
        if fecha_pago:
            field = serializers.DateTimeField()
            try:
                fecha_pago = field.to_internal_value(fecha_pago)
            except serializers.ValidationError:
                return Response({'detail': 'La fecha de pago no es válida.'}, status=400)
        else:
            fecha_pago = timezone.now()

        referencia = (request.data.get('referencia') or '').strip()
        try:
            from apps.ventas.finance import confirmar_pago_venta
            movimiento = confirmar_pago_venta(
                pago,
                cuenta=cuenta,
                fecha_pago=fecha_pago,
                referencia=referencia,
                usuario=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        from apps.core.models import AuditLog
        AuditLog.objects.create(
            empresa=venta.empresa,
            usuario=request.user,
            accion='MARCAR_PAGO_VENTA',
            modulo='ventas',
            referencia=venta.numero_venta,
            datos={
                'pago_id': pago.id,
                'cuenta_id': cuenta.id if cuenta else None,
                'movimiento_bancario_id': movimiento.id if movimiento else None,
                'fecha_pago': pago.fecha_pago.isoformat() if pago.fecha_pago else None,
                'referencia': pago.referencia,
            },
        )

        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data)

    @action(detail=True, methods=['post'], url_path='actualizar-fecha')
    @transaction.atomic
    def actualizar_fecha(self, request, pk=None):
        """Actualiza la fecha de venta y sincroniza pagos/movimientos bancarios vinculados."""
        venta = self.get_object()
        if venta.estado == 'ANULADA':
            return Response({'detail': 'No se puede cambiar la fecha de una venta anulada.'}, status=400)

        fecha_venta = request.data.get('fecha_venta')
        if not fecha_venta:
            return Response({'detail': 'Se requiere fecha_venta.'}, status=400)

        field = serializers.DateTimeField()
        try:
            nueva_fecha = field.to_internal_value(fecha_venta)
        except serializers.ValidationError:
            return Response({'detail': 'La fecha de venta no es válida.'}, status=400)

        fecha_anterior = venta.fecha_venta
        venta.fecha_venta = nueva_fecha
        venta.save(update_fields=['fecha_venta', 'fecha_modificacion'])

        fecha_movimiento = timezone.localdate(nueva_fecha)
        pagos_actualizados = []
        movimientos_actualizados = []
        for pago in venta.pagos.select_related('movimiento_bancario').all():
            pago.fecha_pago = nueva_fecha
            pago.save(update_fields=['fecha_pago'])
            pagos_actualizados.append(pago.id)
            if pago.movimiento_bancario_id:
                movimiento = pago.movimiento_bancario
                movimiento.fecha = fecha_movimiento
                movimiento.save(update_fields=['fecha'])
                movimientos_actualizados.append(movimiento.id)

        factura_actualizada = None
        if venta.factura_id:
            comp = getattr(venta.factura, 'comprobante', None)
            if comp and comp.estado == 'BORRADOR':
                comp.fecha_emision = nueva_fecha
                comp.save(update_fields=['fecha_emision'])
                factura_actualizada = venta.factura_id

        from apps.core.models import AuditLog
        AuditLog.objects.create(
            empresa=venta.empresa,
            usuario=request.user,
            accion='ACTUALIZAR_FECHA_VENTA',
            modulo='ventas',
            referencia=venta.numero_venta,
            datos={
                'fecha_anterior': fecha_anterior.isoformat() if fecha_anterior else None,
                'fecha_nueva': nueva_fecha.isoformat(),
                'pagos': pagos_actualizados,
                'movimientos_bancarios': movimientos_actualizados,
                'factura_actualizada': factura_actualizada,
            },
        )

        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data)

    @action(detail=True, methods=['get'], url_path='facturas-disponibles')
    def facturas_disponibles(self, request, pk=None):
        """Lista facturas de la empresa que aún no están vinculadas a una venta."""
        venta = self.get_object()
        from apps.facturacion.models import Factura
        from apps.facturacion.serializers import FacturaSerializer

        qs = Factura.objects.filter(
            comprobante__empresa=venta.empresa,
            venta__isnull=True,
        ).select_related('comprobante', 'cliente')

        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(comprobante__numero_comprobante__icontains=search)
                | Q(cliente__razon_social__icontains=search)
                | Q(cliente__identificacion__icontains=search)
            )

        qs = qs.order_by('-comprobante__fecha_emision')[:25]
        return Response(FacturaSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='vincular-factura')
    @transaction.atomic
    def vincular_factura(self, request, pk=None):
        """Vincula una factura existente a una venta no facturada."""
        venta = self.get_object()
        if venta.estado == 'ANULADA':
            return Response({'detail': 'No se puede vincular factura a una venta anulada.'}, status=400)
        if venta.factura_id:
            return Response({'detail': 'Esta venta ya tiene una factura vinculada.'}, status=400)

        factura_id = request.data.get('factura') or request.data.get('factura_id')
        if not factura_id:
            return Response({'detail': 'Se requiere factura.'}, status=400)

        from apps.facturacion.models import Factura
        try:
            factura = Factura.objects.select_related('comprobante', 'cliente').get(
                pk=factura_id,
                comprobante__empresa=venta.empresa,
            )
        except Factura.DoesNotExist:
            return Response({'detail': 'Factura no encontrada para esta empresa.'}, status=404)

        if hasattr(factura, 'venta') and factura.venta is not None:
            return Response({'detail': 'La factura ya está vinculada a otra venta.'}, status=400)

        total_venta = Decimal(str(venta.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_factura = Decimal(str(factura.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if abs(total_venta - total_factura) > Decimal('0.01'):
            return Response({
                'detail': 'El total de la factura no coincide con el total de la venta.',
                'total_venta': total_venta,
                'total_factura': total_factura,
            }, status=400)

        comp = factura.comprobante
        fecha_factura_actualizada = False
        if comp.estado == 'BORRADOR' and comp.fecha_emision != venta.fecha_venta:
            comp.fecha_emision = venta.fecha_venta
            comp.save(update_fields=['fecha_emision'])
            fecha_factura_actualizada = True

        venta.factura = factura
        venta.genera_factura = True
        venta.save(update_fields=['factura', 'genera_factura'])

        from apps.ventas.finance import crear_cartera_credito_venta
        crear_cartera_credito_venta(venta)

        from apps.core.models import AuditLog
        AuditLog.objects.create(
            empresa=venta.empresa,
            usuario=request.user,
            accion='VINCULAR_FACTURA_VENTA',
            modulo='ventas',
            referencia=venta.numero_venta,
            datos={
                'factura_id': factura.id,
                'numero_factura': comp.numero_comprobante,
                'fecha_factura_actualizada': fecha_factura_actualizada,
            },
        )

        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data)

    @action(detail=True, methods=['get', 'post'], url_path='regularizacion')
    @transaction.atomic
    def regularizacion(self, request, pk=None):
        """Diagnostica y completa vínculos financieros, de costo e inventario."""
        venta = self.get_object()
        from apps.bancos.models import CuentaBancaria
        from apps.inventarios.models import Bodega, MovimientoInventario
        from apps.proveedores.models import Proveedor, ProveedorProducto
        from apps.core.models import AuditLog

        if request.method == 'POST':
            if venta.estado == 'ANULADA':
                return Response(
                    {'detail': 'No se puede regularizar una venta anulada.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            cambios = {'pagos': [], 'detalles': []}
            pagos_venta = {p.id: p for p in venta.pagos.select_related('movimiento_bancario')}
            for item in request.data.get('pagos', []):
                pago = pagos_venta.get(item.get('id'))
                if not pago:
                    return Response({'detail': 'Uno de los pagos no pertenece a la venta.'}, status=400)
                if pago.forma_pago == 'CREDITO':
                    continue
                cuenta = CuentaBancaria.objects.filter(
                    pk=item.get('cuenta_bancaria'),
                    empresa=venta.empresa,
                    activa=True,
                ).first()
                if not cuenta:
                    return Response({'detail': 'Selecciona una cuenta activa de la empresa.'}, status=400)
                if pago.movimiento_bancario_id and pago.cuenta_bancaria_id != cuenta.id:
                    return Response(
                        {'detail': 'El pago ya tiene movimiento bancario y no puede cambiarse de cuenta.'},
                        status=400,
                    )
                if pago.cuenta_bancaria_id != cuenta.id:
                    pago.cuenta_bancaria = cuenta
                    pago.save(update_fields=['cuenta_bancaria'])
                    cambios['pagos'].append({'pago_id': pago.id, 'cuenta_id': cuenta.id})

            detalles_venta = {
                d.id: d for d in venta.detalles.select_related('producto', 'proveedor', 'bodega')
            }
            detalles_para_stock = []
            for item in request.data.get('detalles', []):
                detalle = detalles_venta.get(item.get('id'))
                if not detalle:
                    return Response({'detail': 'Uno de los detalles no pertenece a la venta.'}, status=400)
                producto = detalle.producto
                campos = []

                proveedor_id = item.get('proveedor')
                proveedor = None
                if proveedor_id:
                    proveedor = Proveedor.objects.filter(
                        pk=proveedor_id,
                        empresa=venta.empresa,
                        activo=True,
                    ).first()
                    if not proveedor:
                        return Response({'detail': 'El proveedor seleccionado no es válido.'}, status=400)
                    if detalle.proveedor_id != proveedor.id:
                        detalle.proveedor = proveedor
                        campos.append('proveedor')

                if item.get('costo_unitario') not in (None, ''):
                    try:
                        costo = Decimal(str(item['costo_unitario']))
                    except Exception:
                        return Response({'detail': 'El costo ingresado no es válido.'}, status=400)
                    if costo < 0:
                        return Response({'detail': 'El costo no puede ser negativo.'}, status=400)
                    if detalle.costo_unitario != costo:
                        detalle.costo_unitario = costo
                        campos.append('costo_unitario')
                else:
                    costo = detalle.costo_unitario

                controla_stock = producto.tipo == 'BIEN' and producto.maneja_inventario
                movimientos_detalle = MovimientoInventario.objects.filter(
                    empresa=venta.empresa,
                    producto=producto,
                    tipo_movimiento='SALIDA_VENTA',
                    venta_id=str(venta.numero_venta),
                )
                if controla_stock:
                    bodega = Bodega.objects.filter(
                        pk=item.get('bodega'),
                        empresa=venta.empresa,
                        activa=True,
                    ).first()
                    if not bodega:
                        return Response({'detail': f'Selecciona la bodega para {producto.nombre}.'}, status=400)
                    if detalle.bodega_id != bodega.id:
                        detalle.bodega = bodega
                        campos.append('bodega')
                    if item.get('regularizar_inventario'):
                        detalles_para_stock.append(detalle.id)
                elif detalle.bodega_id:
                    detalle.bodega = None
                    campos.append('bodega')

                if not controla_stock and item.get('retirar_inventario'):
                    for movimiento in movimientos_detalle:
                        cambios['detalles'].append({
                            'detalle_id': detalle.id,
                            'movimiento_invalido_retirado': movimiento.id,
                        })
                        movimiento.delete()

                if campos:
                    detalle.save(update_fields=list(dict.fromkeys(campos)))
                    cambios['detalles'].append({'detalle_id': detalle.id, 'campos': campos})

                if proveedor:
                    relacion, _ = ProveedorProducto.objects.update_or_create(
                        empresa=venta.empresa,
                        proveedor=proveedor,
                        producto=producto,
                        defaults={'costo_referencia': costo, 'activo': True},
                    )
                    if not ProveedorProducto.objects.filter(
                        empresa=venta.empresa,
                        producto=producto,
                        es_preferido=True,
                    ).exists():
                        relacion.es_preferido = True
                        relacion.save(update_fields=['es_preferido'])

            from apps.ventas.finance import registrar_finanzas_venta
            registrar_finanzas_venta(venta)
            if detalles_para_stock:
                from apps.ventas.inventory import registrar_inventario_venta
                registrar_inventario_venta(venta, detalles_para_stock)

            AuditLog.objects.create(
                empresa=venta.empresa,
                usuario=request.user,
                accion='REGULARIZAR_VENTA',
                modulo='ventas',
                referencia=venta.numero_venta,
                datos=cambios,
            )

        pagos = []
        for pago in venta.pagos.select_related('cuenta_bancaria', 'movimiento_bancario'):
            pagos.append({
                'id': pago.id,
                'forma_pago': pago.forma_pago,
                'monto': float(pago.monto),
                'cuenta_bancaria': pago.cuenta_bancaria_id,
                'movimiento_bancario': pago.movimiento_bancario_id,
                'estado_pago': pago.estado_pago,
                'fecha_pago': pago.fecha_pago,
                'referencia': pago.referencia,
                'requiere_cuenta': pago.forma_pago != 'CREDITO',
            })

        detalles = []
        for detalle in venta.detalles.select_related('producto', 'proveedor', 'bodega'):
            controla_stock = detalle.producto.tipo == 'BIEN' and detalle.producto.maneja_inventario
            movimiento = MovimientoInventario.objects.filter(
                empresa=venta.empresa,
                producto=detalle.producto,
                tipo_movimiento='SALIDA_VENTA',
                venta_id=str(venta.numero_venta),
            ).first()
            detalles.append({
                'id': detalle.id,
                'producto': detalle.producto_id,
                'producto_nombre': detalle.producto.nombre,
                'tipo': detalle.producto.tipo,
                'maneja_inventario': detalle.producto.maneja_inventario,
                'controla_stock': controla_stock,
                'proveedor': detalle.proveedor_id,
                'bodega': (
                    detalle.bodega_id
                    or (movimiento.bodega_id if movimiento else None)
                    or (venta.caja.bodega_id if controla_stock else None)
                ),
                'costo_unitario': float(detalle.costo_unitario),
                'movimiento_inventario': movimiento.id if movimiento else None,
                'inventario_invalido': bool(movimiento and not controla_stock),
            })

        return Response({
            'venta': {
                'id': venta.id,
                'numero_venta': venta.numero_venta,
                'estado': venta.estado,
            },
            'pagos': pagos,
            'detalles': detalles,
            'cuentas': list(CuentaBancaria.objects.filter(
                empresa=venta.empresa, activa=True,
            ).values('id', 'banco', 'numero_cuenta')),
            'proveedores': list(Proveedor.objects.filter(
                empresa_id=venta.empresa_id,
                activo=True,
            ).order_by('razon_social').values('id', 'razon_social', 'identificacion', 'empresa_id')),
            'bodegas': list(Bodega.objects.filter(
                empresa=venta.empresa, activa=True,
            ).values('id', 'nombre', 'codigo')),
        })
    
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
                if detalle.producto.tipo != 'BIEN' or not detalle.producto.maneja_inventario:
                    continue
                salida = MovimientoInventario.objects.filter(
                    empresa=venta.empresa,
                    producto=detalle.producto,
                    tipo_movimiento='SALIDA_VENTA',
                    venta_id=str(venta.numero_venta),
                ).first()
                if not salida:
                    continue
                # Crear movimiento de reversión (AJUSTE_ENTRADA)
                MovimientoInventario.objects.create(
                    empresa=venta.empresa,
                    bodega=salida.bodega,
                    producto=detalle.producto,
                    tipo_movimiento='AJUSTE_ENTRADA',
                    cantidad=detalle.cantidad,
                    costo_unitario=detalle.costo_unitario,
                    venta_id=str(venta.numero_venta),
                    documento_referencia=f'Anulación venta {venta.numero_venta}',
                    observaciones=motivo,
                    usuario=request.user
                )

            # Los movimientos automáticos se retiran únicamente al anular su origen.
            from apps.core.models import AuditLog
            for pago in venta.pagos.select_related('movimiento_bancario'):
                movimiento = pago.movimiento_bancario
                if not movimiento:
                    continue
                AuditLog.objects.create(
                    empresa=venta.empresa,
                    usuario=request.user,
                    accion='ANULAR_MOVIMIENTO_BANCARIO',
                    modulo='bancos',
                    referencia=str(movimiento.pk),
                    datos={
                        'venta': venta.numero_venta,
                        'motivo': motivo,
                        'cuenta_id': movimiento.cuenta_id,
                        'tipo': movimiento.tipo,
                        'monto': str(movimiento.monto),
                    },
                )
                movimiento.delete()
            
            # Anular venta
            venta.estado = 'ANULADA'
            venta.save()
            
            serializer = self.get_serializer(venta)
            return Response(serializer.data)
            
        except Exception as e:
            transaction.set_rollback(True)
            return Response(
                {'error': f'Error al anular venta: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def generar_factura(self, request, pk=None):
        """Crea la Factura electrónica para esta venta y la envía al SRI.

        Acepta opcionalmente `cliente_id` en el cuerpo del request para sobrescribir
        el cliente de la venta en la factura (sin modificar la venta original).
        """
        from apps.facturacion.services.factura_service import crear_factura_desde_venta, procesar_factura_sri
        from apps.facturacion.serializers import FacturaSerializer
        from apps.facturacion.services.factura_service import (
            MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE,
            cliente_consumidor_final_supera_limite,
        )
        from apps.clientes.models import Cliente

        venta = self.get_object()
        empresa = venta.empresa

        # Validar readiness fiscal (onboarding)
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

        # Permitir cambiar de cliente antes de facturar (sin guardar en la venta)
        cliente_id = request.data.get('cliente_id')
        cliente_original = venta.cliente
        if cliente_id:
            try:
                nuevo_cliente = Cliente.objects.get(pk=cliente_id, empresa=empresa, activo=True)
                venta.cliente = nuevo_cliente
            except Cliente.DoesNotExist:
                return Response(
                    {'error': 'El cliente seleccionado no existe, no pertenece a esta empresa o está inactivo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if cliente_consumidor_final_supera_limite(venta.cliente, venta.total):
            venta.cliente = cliente_original
            return Response(
                {'error': MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            factura = crear_factura_desde_venta(venta)
            sri_result = procesar_factura_sri(factura)
        except Exception as e:
            venta.cliente = cliente_original
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'factura': FacturaSerializer(factura, context={'request': request}).data,
            'sri': sri_result,
        })

    def _reconciliar_venta_factura(self, venta):
        from apps.facturacion.services.factura_service import (
            MENSAJE_FACTURA_PENDIENTE_REDONDEO,
            aplicar_ajuste_centavos_factura,
            normalizar_precios_unitarios_factura,
            recalcular_totales_factura_desde_detalles,
        )

        if not venta.factura_id:
            return {
                'venta_id': venta.id,
                'numero_venta': venta.numero_venta,
                'reconciliada': False,
                'mensaje': 'La venta no tiene factura vinculada.',
            }

        factura = venta.factura
        comprobante = getattr(factura, 'comprobante', None)

        total_venta = Decimal(str(venta.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_factura_antes = Decimal(str(factura.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        aplicar_ajuste_centavos_factura(factura, total_venta)
        normalizar_precios_unitarios_factura(factura)
        recalcular_totales_factura_desde_detalles(factura)

        total_factura_despues = Decimal(str(factura.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        diferencia = (total_venta - total_factura_despues).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        reconciliada = diferencia == Decimal('0.00')

        if comprobante:
            if reconciliada:
                if str(comprobante.mensajes_sri or '').startswith(MENSAJE_FACTURA_PENDIENTE_REDONDEO):
                    comprobante.mensajes_sri = ''
                if comprobante.estado == 'BORRADOR':
                    comprobante.save(update_fields=['mensajes_sri'])
                else:
                    comprobante.save(update_fields=['mensajes_sri'])
            else:
                comprobante.estado = 'BORRADOR'
                comprobante.mensajes_sri = (
                    f"{MENSAJE_FACTURA_PENDIENTE_REDONDEO} "
                    f"Total cobrado: {total_venta}. Total fiscal calculado: {total_factura_despues}."
                )
                comprobante.save(update_fields=['estado', 'mensajes_sri'])

        return {
            'venta_id': venta.id,
            'numero_venta': venta.numero_venta,
            'factura_id': venta.factura_id,
            'total_venta': total_venta,
            'total_factura_antes': total_factura_antes,
            'total_factura_despues': total_factura_despues,
            'diferencia': diferencia,
            'reconciliada': reconciliada,
            'estado_factura': getattr(comprobante, 'estado', None),
        }

    @action(detail=True, methods=['post'], url_path='reconciliar-factura')
    @transaction.atomic
    def reconciliar_factura(self, request, pk=None):
        """
        Reconciliar una venta facturada contra su total cobrado sin enviar al SRI.
        """
        venta = self.get_object()
        result = self._reconciliar_venta_factura(venta)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='reconciliar-inconsistencias')
    @transaction.atomic
    def reconciliar_inconsistencias(self, request):
        """
        Reconciliar en lote ventas con factura cuyo total no coincide con el total cobrado.
        """
        ventas_facturadas = self.get_queryset().filter(estado='COMPLETADA', factura__isnull=False).select_related('factura', 'factura__comprobante')

        procesadas = 0
        reconciliadas = 0
        pendientes = 0
        resultados = []

        for venta in ventas_facturadas:
            total_venta = Decimal(str(venta.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            total_factura = Decimal(str(venta.factura.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if total_venta == total_factura:
                continue

            procesadas += 1
            result = self._reconciliar_venta_factura(venta)
            resultados.append(result)

            if result.get('reconciliada'):
                reconciliadas += 1
            else:
                pendientes += 1

        return Response({
            'resumen': {
                'procesadas': procesadas,
                'reconciliadas': reconciliadas,
                'pendientes': pendientes,
            },
            'resultados': resultados,
        })

    @action(detail=False, methods=['get'], url_path='notas-venta')
    def notas_venta(self, request):
        """
        Apartado de notas de venta:
        ventas completadas sin comprobante electrónico (sin factura vinculada).
        """
        qs = self.get_queryset().filter(
            estado='COMPLETADA',
            factura__isnull=True,
        )

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='coherencia-facturacion')
    def coherencia_facturacion(self, request):
        """
        Valida coherencia entre total de venta y total facturado para ventas que sí tienen factura.
        """
        solo_inconsistentes = (request.query_params.get('solo_inconsistentes') or '').lower() in ('1', 'true', 'si', 'yes')
        tolerancia = Decimal(str(request.query_params.get('tolerancia', '0.00'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        ventas_facturadas = self.get_queryset().filter(factura__isnull=False).select_related('factura')

        resultados = []
        coherentes = 0
        inconsistentes = 0

        for venta in ventas_facturadas:
            total_venta = Decimal(str(venta.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            total_factura = Decimal(str(venta.factura.total or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            diferencia = (total_venta - total_factura).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            es_coherente = abs(diferencia) <= tolerancia

            if es_coherente:
                coherentes += 1
            else:
                inconsistentes += 1

            if solo_inconsistentes and es_coherente:
                continue

            resultados.append({
                'venta_id': venta.id,
                'numero_venta': venta.numero_venta,
                'factura_id': venta.factura_id,
                'numero_factura': getattr(getattr(venta.factura, 'comprobante', None), 'numero_comprobante', None),
                'total_venta': total_venta,
                'total_factura': total_factura,
                'diferencia': diferencia,
                'coherente': es_coherente,
                'estado_factura': getattr(getattr(venta.factura, 'comprobante', None), 'estado', None),
                'fecha_venta': venta.fecha_venta,
            })

        return Response({
            'resumen': {
                'ventas_facturadas': ventas_facturadas.count(),
                'coherentes': coherentes,
                'inconsistentes': inconsistentes,
                'tolerancia': tolerancia,
            },
            'resultados': resultados,
        })

    @action(detail=True, methods=['get'], url_path='nota-venta')
    def nota_venta(self, request, pk=None):
        """
        Devuelve el payload imprimible de nota de venta para una venta no facturada.
        """
        venta = self.get_object()
        if venta.factura_id:
            return Response(
                {'error': 'Esta venta ya tiene factura electrónica; no aplica nota de venta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = self.get_serializer(venta).data
        return Response({
            'tipo_documento': 'NOTA_VENTA',
            'venta': data,
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
        ).values('forma_pago', 'cuenta_bancaria__banco', 'cuenta_bancaria__numero_cuenta').annotate(
            total=Sum('monto')
        )
        costo_total = Decimal('0.00')
        subtotal_total = Decimal('0.00')
        for venta in queryset.prefetch_related('detalles'):
            subtotal_total += Decimal(str(venta.subtotal or 0))
            for detalle in venta.detalles.all():
                costo_total += Decimal(str(detalle.costo_unitario or 0)) * Decimal(str(detalle.cantidad or 0))
        utilidad_bruta = subtotal_total - costo_total
        
        return Response({
            'totales': totales,
            'por_metodo_pago': pagos_resumen,
            'rentabilidad': {
                'subtotal': subtotal_total.quantize(Decimal('0.01')),
                'costo_total': costo_total.quantize(Decimal('0.01')),
                'utilidad_bruta': utilidad_bruta.quantize(Decimal('0.01')),
                'margen_bruto': (
                    (utilidad_bruta / subtotal_total * Decimal('100')).quantize(Decimal('0.01'))
                    if subtotal_total > 0 else Decimal('0.00')
                ),
            },
        })


class MovimientoCajaViewSet(viewsets.ModelViewSet):
    serializer_class = MovimientoCajaSerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = ['ventas', 'pos']
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
