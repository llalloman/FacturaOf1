"""
Unified Dashboard API — returns all KPIs in a single request.

GET /api/dashboard/
  → Tenant users: ventas_mes, facturas, productos, clientes, ultimos_meses, declaraciones
  → SUPER_ADMIN:  empresas, usuarios, suscripciones overview
"""

from calendar import monthrange
from datetime import timedelta, time
from decimal import Decimal

from django.db.models import Sum, Count, Q, F
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.core.permissions import user_has_module_access

MESES = [
    '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]


def _is_super_admin(user):
    return user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'


# ─── Helper: month boundaries ────────────────────────────────────────────────
def _month_range(anio, mes):
    _, ultimo = monthrange(anio, mes)
    tz = timezone.get_current_timezone()
    inicio = timezone.datetime(anio, mes, 1, tzinfo=tz)
    fin = timezone.datetime(anio, mes, ultimo, 23, 59, 59, tzinfo=tz)
    return inicio, fin


def _parse_dashboard_range(request, fallback_date):
    fecha_desde = parse_date(request.query_params.get('fecha_desde', '') or '')
    fecha_hasta = parse_date(request.query_params.get('fecha_hasta', '') or '')

    if not fecha_desde:
        fecha_desde = fallback_date.replace(day=1)
    if not fecha_hasta:
        fecha_hasta = fallback_date
    if fecha_desde > fecha_hasta:
        fecha_desde, fecha_hasta = fecha_hasta, fecha_desde

    tz = timezone.get_current_timezone()
    inicio = timezone.make_aware(timezone.datetime.combine(fecha_desde, time.min), tz)
    fin = timezone.make_aware(timezone.datetime.combine(fecha_hasta, time.max), tz)
    return fecha_desde, fecha_hasta, inicio, fin


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user

    if _is_super_admin(user):
        return _dashboard_super_admin(request)
    if not user_has_module_access(user, 'dashboard'):
        return Response({'detail': 'Este módulo no está incluido en tu plan actual.'}, status=403)
    return _dashboard_tenant(request)


# ─────────────────────────────────────────────────────────────────────────────
#  SUPER ADMIN dashboard
# ─────────────────────────────────────────────────────────────────────────────

def _dashboard_super_admin(request):
    from apps.empresas.models import Empresa
    from apps.usuarios.models import Usuario
    from apps.suscripciones.models import Suscripcion

    empresas_qs = Empresa.objects.all()
    usuarios_qs = Usuario.objects.all()

    empresas_total = empresas_qs.count()
    empresas_activas = empresas_qs.filter(activa=True).count()
    usuarios_total = usuarios_qs.count()
    admins_empresa = usuarios_qs.filter(rol='ADMIN_EMPRESA').count()

    # Suscripciones resumen
    suscripciones_activas = Suscripcion.objects.filter(estado='ACTIVA').count()

    # Empresas list (lightweight)
    empresas_list = list(
        empresas_qs.order_by('-fecha_creacion')[:20]
        .values('id', 'razon_social', 'ruc', 'email', 'activa')
    )

    return Response({
        'tipo': 'super_admin',
        'empresas_total': empresas_total,
        'empresas_activas': empresas_activas,
        'usuarios_total': usuarios_total,
        'admins_empresa': admins_empresa,
        'suscripciones_activas': suscripciones_activas,
        'empresas': empresas_list,
    })


# ─────────────────────────────────────────────────────────────────────────────
#  TENANT dashboard
# ─────────────────────────────────────────────────────────────────────────────

def _dashboard_tenant(request):
    from apps.facturacion.models import Factura, ComprobanteElectronico, NotaCredito
    from apps.productos.models import Producto
    from apps.clientes.models import Cliente
    from apps.ventas.models import Venta, PagoVenta, AperturaCaja, DetalleVenta
    from apps.cartera.models import CuentaPorCobrar
    from apps.inventarios.models import MovimientoInventario

    empresa = getattr(request, 'tenant', None) or getattr(request.user, 'empresa', None)
    if not empresa:
        return Response({'error': 'Sin empresa asignada.'}, status=400)

    ahora = timezone.now()
    hoy = timezone.localdate()
    mes, anio = ahora.month, ahora.year
    fecha_desde, fecha_hasta, inicio_periodo, fin_periodo = _parse_dashboard_range(request, hoy)
    inicio_mes, fin_mes = _month_range(anio, mes)

    ventas_cerradas_q = Q(empresa=empresa, estado='COMPLETADA') & ~Q(factura__comprobante__estado='ANULADO')
    ventas_anuladas_q = Q(empresa=empresa) & (Q(estado='ANULADA') | Q(factura__comprobante__estado='ANULADO'))

    # ── Ventas del período ────────────────────────────────────────────────────
    ventas_periodo_qs = Venta.objects.filter(
        ventas_cerradas_q,
        fecha_venta__gte=inicio_periodo,
        fecha_venta__lte=fin_periodo,
    )
    ventas_periodo_agg = ventas_periodo_qs.aggregate(
        total=Sum('total'), cantidad=Count('id'),
    )
    ventas_hoy_qs = Venta.objects.filter(
        ventas_cerradas_q,
        fecha_venta__date=hoy,
    )
    ventas_hoy_agg = ventas_hoy_qs.aggregate(
        total=Sum('total'), cantidad=Count('id'),
    )
    ventas_anuladas_periodo_qs = Venta.objects.filter(
        ventas_anuladas_q,
        fecha_venta__gte=inicio_periodo,
        fecha_venta__lte=fin_periodo,
    ).distinct()
    ventas_anuladas_periodo_agg = ventas_anuladas_periodo_qs.aggregate(
        total=Sum('total'), cantidad=Count('id'),
    )
    cobrado_hoy = PagoVenta.objects.filter(
        venta__empresa=empresa,
        venta__estado='COMPLETADA',
    ).exclude(
        venta__factura__comprobante__estado='ANULADO',
    ).filter(
        fecha_pago__date=hoy,
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
    cobrado_periodo = PagoVenta.objects.filter(
        venta__empresa=empresa,
        venta__estado='COMPLETADA',
    ).exclude(
        venta__factura__comprobante__estado='ANULADO',
    ).filter(
        fecha_pago__gte=inicio_periodo,
        fecha_pago__lte=fin_periodo,
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
    cobrado_mes = PagoVenta.objects.filter(
        venta__empresa=empresa,
        venta__estado='COMPLETADA',
    ).exclude(
        venta__factura__comprobante__estado='ANULADO',
    ).filter(
        fecha_pago__gte=inicio_mes,
        fecha_pago__lte=fin_mes,
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
    ticket_promedio_periodo = (
        (ventas_periodo_agg['total'] or Decimal('0.00')) / (ventas_periodo_agg['cantidad'] or 1)
        if (ventas_periodo_agg['cantidad'] or 0) > 0 else Decimal('0.00')
    )
    ticket_promedio_mes = (
        (Venta.objects.filter(
            ventas_cerradas_q,
            fecha_venta__gte=inicio_mes,
            fecha_venta__lte=fin_mes,
        ).aggregate(total=Sum('total'), cantidad=Count('id'))['total'] or Decimal('0.00'))
        / (
            Venta.objects.filter(
                ventas_cerradas_q,
                fecha_venta__gte=inicio_mes,
                fecha_venta__lte=fin_mes,
            ).count() or 1
        )
        if Venta.objects.filter(
            ventas_cerradas_q,
            fecha_venta__gte=inicio_mes,
            fecha_venta__lte=fin_mes,
        ).count() > 0 else Decimal('0.00')
    )

    # ── Facturas ──────────────────────────────────────────────────────────────
    facturas_qs = Factura.objects.filter(comprobante__empresa=empresa)
    facturas_por_estado = dict(
        facturas_qs.values_list('comprobante__estado')
        .annotate(c=Count('id'))
        .values_list('comprobante__estado', 'c')
    )
    facturas_emitidas = facturas_por_estado.get('AUTORIZADO', 0) + facturas_por_estado.get('ENVIADO', 0)
    facturas_autorizadas = facturas_por_estado.get('AUTORIZADO', 0)
    facturas_enviadas = facturas_por_estado.get('ENVIADO', 0)
    facturas_anuladas = facturas_por_estado.get('ANULADO', 0)
    facturas_rechazadas = facturas_por_estado.get('RECHAZADO', 0) + facturas_por_estado.get('NO_AUTORIZADO', 0)
    notas_credito_qs = NotaCredito.objects.filter(comprobante__empresa=empresa)
    notas_credito_pendientes = notas_credito_qs.filter(comprobante__estado='ENVIADO').count()
    notas_credito_hoy = notas_credito_qs.filter(comprobante__fecha_emision__date=hoy).count()

    facturas_emitidas_periodo_qs = facturas_qs.filter(
        comprobante__fecha_emision__gte=inicio_periodo,
        comprobante__fecha_emision__lte=fin_periodo,
    ).filter(
        Q(comprobante__estado='AUTORIZADO') |
        Q(comprobante__estado='ANULADO', notas_credito__comprobante__estado='AUTORIZADO')
    ).distinct()
    facturas_emitidas_mes_qs = facturas_qs.filter(
        comprobante__fecha_emision__gte=inicio_mes,
        comprobante__fecha_emision__lte=fin_mes,
    ).filter(
        Q(comprobante__estado='AUTORIZADO') |
        Q(comprobante__estado='ANULADO', notas_credito__comprobante__estado='AUTORIZADO')
    ).distinct()
    facturas_emitidas_hoy_qs = facturas_qs.filter(
        comprobante__fecha_emision__date=hoy,
    ).filter(
        Q(comprobante__estado='AUTORIZADO') |
        Q(comprobante__estado='ANULADO', notas_credito__comprobante__estado='AUTORIZADO')
    ).distinct()
    facturas_anuladas_con_nc_periodo_qs = facturas_emitidas_periodo_qs.filter(
        comprobante__estado='ANULADO',
        notas_credito__comprobante__estado='AUTORIZADO',
    ).distinct()
    facturas_directas_periodo_qs = facturas_emitidas_periodo_qs.filter(venta__isnull=True)
    notas_credito_autorizadas_periodo_qs = notas_credito_qs.filter(
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__gte=inicio_periodo,
        comprobante__fecha_emision__lte=fin_periodo,
    )
    facturado_periodo = facturas_emitidas_periodo_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    facturado_mes = facturas_emitidas_mes_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    facturado_hoy = facturas_emitidas_hoy_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    facturado_anulado_periodo = facturas_anuladas_con_nc_periodo_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    facturado_directo_periodo = facturas_directas_periodo_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    notas_credito_periodo = notas_credito_autorizadas_periodo_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    facturado_neto_periodo = facturado_periodo - notas_credito_periodo

    # Facturas recientes
    facturas_recientes = list(
        facturas_qs
        .select_related('comprobante', 'cliente')
        .order_by('-comprobante__fecha_emision')[:5]
        .values(
            'id',
            'comprobante__numero_comprobante',
            'comprobante__estado',
            'total',
            'cliente__razon_social',
        )
    )
    facturas_recientes = [
        {
            'id': f['id'],
            'numero_factura': f['comprobante__numero_comprobante'],
            'estado': f['comprobante__estado'],
            'total': float(f['total'] or 0),
            'cliente_nombre': f['cliente__razon_social'] or 'Cliente',
        }
        for f in facturas_recientes
    ]

    # ── Productos ─────────────────────────────────────────────────────────────
    productos_qs = Producto.objects.filter(empresa=empresa)
    productos_activos = productos_qs.filter(activo=True).count()

    # Stock bajo
    stock_bajo = list(
        productos_qs.filter(
            activo=True, maneja_inventario=True,
            stock_actual__lte=F('stock_minimo'),
        ).order_by('stock_actual')[:5]
        .values('id', 'nombre', 'stock_actual', 'stock_minimo')
    )
    stock_bajo_count = productos_qs.filter(
        activo=True, maneja_inventario=True,
        stock_actual__lte=F('stock_minimo'),
    ).count()

    # Top productos por ventas
    top_productos = list(
        DetalleVenta.objects.filter(
            venta__empresa=empresa,
            venta__estado='COMPLETADA',
            venta__fecha_venta__gte=inicio_periodo,
            venta__fecha_venta__lte=fin_periodo,
        )
        .exclude(venta__factura__comprobante__estado='ANULADO')
        .values('producto__id', 'producto__nombre')
        .annotate(
            cantidad_vendida=Sum('cantidad'),
            ingreso=Sum('total'),
        )
        .order_by('-ingreso')[:5]
    )
    top_productos = [
        {
            'id': p['producto__id'],
            'nombre': p['producto__nombre'],
            'cantidad_vendida': float(p['cantidad_vendida'] or 0),
            'ingreso': float(p['ingreso'] or 0),
        }
        for p in top_productos
    ]

    # ── Clientes ──────────────────────────────────────────────────────────────
    clientes_activos = Cliente.objects.filter(empresa=empresa, activo=True).count()
    top_clientes = list(
        Venta.objects.filter(
            ventas_cerradas_q,
            fecha_venta__gte=inicio_periodo,
            fecha_venta__lte=fin_periodo,
        )
        .values('cliente__id', 'cliente__razon_social')
        .annotate(
            total=Sum('total'),
            cantidad=Count('id'),
        )
        .order_by('-total')[:5]
    )
    top_clientes = [
        {
            'id': c['cliente__id'],
            'nombre': c['cliente__razon_social'] or 'Cliente',
            'total': float(c['total'] or 0),
            'cantidad': c['cantidad'] or 0,
        }
        for c in top_clientes
    ]

    ventas_por_metodo = list(
        PagoVenta.objects.filter(
            venta__empresa=empresa,
            venta__estado='COMPLETADA',
            venta__fecha_venta__gte=inicio_periodo,
            venta__fecha_venta__lte=fin_periodo,
        ).exclude(
            venta__factura__comprobante__estado='ANULADO',
        ).values('forma_pago').annotate(total=Sum('monto')).order_by('-total')
    )
    ventas_por_metodo = [
        {'forma_pago': p['forma_pago'], 'total': float(p['total'] or 0)}
        for p in ventas_por_metodo
    ]

    cartera_qs = CuentaPorCobrar.objects.filter(empresa=empresa)
    cuentas_pendientes = cartera_qs.filter(
        estado__in=['PENDIENTE', 'PARCIAL', 'VENCIDA']
    )
    total_por_cobrar = cuentas_pendientes.aggregate(total=Sum('saldo'))['total'] or Decimal('0.00')
    cuentas_vencidas_qs = cartera_qs.filter(
        estado__in=['PENDIENTE', 'PARCIAL', 'VENCIDA'],
        fecha_vencimiento__lt=hoy,
    )
    total_vencido = cuentas_vencidas_qs.aggregate(total=Sum('saldo'))['total'] or Decimal('0.00')

    cajas_abiertas = AperturaCaja.objects.filter(
        caja__empresa=empresa,
        estado='ABIERTA',
    ).count()

    pedidos_abiertos = 0
    try:
        from apps.pedidos.models import Pedido
        pedidos_abiertos = Pedido.objects.filter(
            empresa=empresa,
            estado__in=['ABIERTO', 'EN_PREPARACION', 'LISTO'],
        ).count()
    except Exception:
        pass

    alertas_operativas = [
        {
            'key': 'facturas_enviadas',
            'label': 'Facturas pendientes SRI',
            'valor': facturas_enviadas,
            'ruta': '/facturacion',
        },
        {
            'key': 'facturas_rechazadas',
            'label': 'Comprobantes con error SRI',
            'valor': facturas_rechazadas,
            'ruta': '/facturacion',
        },
        {
            'key': 'notas_credito_pendientes',
            'label': 'Notas de crédito pendientes',
            'valor': notas_credito_pendientes,
            'ruta': '/notas-credito',
        },
        {
            'key': 'cuentas_vencidas',
            'label': 'Cuentas por cobrar vencidas',
            'valor': cuentas_vencidas_qs.count(),
            'ruta': '/cartera',
        },
        {
            'key': 'stock_bajo',
            'label': 'Productos con stock bajo',
            'valor': stock_bajo_count,
            'ruta': '/inventarios',
        },
    ]

    # ── Últimos 6 meses ──────────────────────────────────────────────────────
    from dateutil.relativedelta import relativedelta
    ultimos_meses = []
    for i in range(5, -1, -1):
        fecha = ahora - relativedelta(months=i)
        m, a = fecha.month, fecha.year
        ini, fin = _month_range(a, m)
        agg = Venta.objects.filter(
            ventas_cerradas_q,
            fecha_venta__gte=ini, fecha_venta__lte=fin,
        ).aggregate(total=Sum('total'), cantidad=Count('id'))
        ultimos_meses.append({
            'mes': m, 'anio': a,
            'label': f'{MESES[m]} {a}' if a != anio else MESES[m],
            'total_ventas': float(agg['total'] or 0),
            'cantidad_ventas': agg['cantidad'] or 0,
        })

    # ── Próximas declaraciones (si aplica) ────────────────────────────────────
    proximas_declaraciones = []
    try:
        from apps.declaraciones.services import calcular_fecha_limite
        ruc = empresa.ruc
        hoy = ahora.date()
        # Check current + next month
        for offset in (0, 1):
            f = ahora - relativedelta(months=-offset)
            target_mes, target_anio = f.month, f.year
            fecha_lim = calcular_fecha_limite(ruc, target_anio, target_mes)
            if fecha_lim and fecha_lim >= hoy:
                proximas_declaraciones.append({
                    'tipo': 'Form 104 - IVA',
                    'periodo': f'{MESES[target_mes]} {target_anio}',
                    'fecha_limite': str(fecha_lim),
                    'dias_restantes': (fecha_lim - hoy).days,
                })
    except Exception:
        pass  # Declaraciones module may not be fully set up

    certificado_cargado = bool(getattr(empresa, 'certificado_digital', None) or getattr(empresa, 'certificado_data', None))
    secuenciales_configurados = False
    firma_solicitada = False
    try:
        from apps.facturacion.models import Secuencial
        secuenciales_configurados = Secuencial.objects.filter(empresa=empresa, configurado=True).exists()
    except Exception:
        pass
    try:
        from apps.firmas.models import SolicitudFirmaElectronica
        firma_solicitada = SolicitudFirmaElectronica.objects.filter(company=empresa).exclude(status='ANULADA').exists()
    except Exception:
        pass

    primer_comprobante_emitido = facturas_qs.filter(comprobante__estado='AUTORIZADO').exists()
    progreso_configuracion = [
        {'key': 'empresa_registrada', 'label': 'Empresa registrada', 'completed': True},
        {'key': 'firma_solicitada', 'label': 'Firma electrónica cargada o solicitada', 'completed': certificado_cargado or firma_solicitada},
        {'key': 'secuenciales_configurados', 'label': 'Secuenciales configurados', 'completed': secuenciales_configurados},
        {'key': 'certificado_cargado', 'label': 'Certificado cargado', 'completed': certificado_cargado},
        {'key': 'primer_comprobante_emitido', 'label': 'Primer comprobante emitido', 'completed': primer_comprobante_emitido},
    ]
    configuracion_incompleta = any(not step['completed'] for step in progreso_configuracion)

    return Response({
        'tipo': 'tenant',
        # KPIs
        'fecha_desde': str(fecha_desde),
        'fecha_hasta': str(fecha_hasta),
        'ventas_periodo': float(ventas_periodo_agg['total'] or 0),
        'ventas_periodo_cantidad': ventas_periodo_agg['cantidad'] or 0,
        'ventas_anuladas_periodo': float(ventas_anuladas_periodo_agg['total'] or 0),
        'ventas_anuladas_periodo_cantidad': ventas_anuladas_periodo_agg['cantidad'] or 0,
        'cobrado_periodo': float(cobrado_periodo),
        'ticket_promedio_periodo': float(ticket_promedio_periodo),
        'ventas_mes': float(Venta.objects.filter(
            ventas_cerradas_q,
            fecha_venta__gte=inicio_mes,
            fecha_venta__lte=fin_mes,
        ).aggregate(total=Sum('total'))['total'] or 0),
        'ventas_mes_cantidad': Venta.objects.filter(
            ventas_cerradas_q,
            fecha_venta__gte=inicio_mes,
            fecha_venta__lte=fin_mes,
        ).count(),
        'ventas_hoy': float(ventas_hoy_agg['total'] or 0),
        'ventas_hoy_cantidad': ventas_hoy_agg['cantidad'] or 0,
        'cobrado_hoy': float(cobrado_hoy),
        'cobrado_mes': float(cobrado_mes),
        'ticket_promedio_mes': float(ticket_promedio_mes),
        'facturas_emitidas': facturas_emitidas,
        'facturas_autorizadas': facturas_autorizadas,
        'facturas_enviadas': facturas_enviadas,
        'facturas_anuladas': facturas_anuladas,
        'facturas_rechazadas': facturas_rechazadas,
        'facturas_por_estado': facturas_por_estado,
        'facturado_periodo': float(facturado_periodo),
        'facturado_periodo_cantidad': facturas_emitidas_periodo_qs.count(),
        'facturado_mes': float(facturado_mes),
        'facturado_hoy': float(facturado_hoy),
        'facturado_anulado_periodo': float(facturado_anulado_periodo),
        'facturado_anulado_cantidad': facturas_anuladas_con_nc_periodo_qs.count(),
        'facturado_directo_periodo': float(facturado_directo_periodo),
        'facturado_directo_cantidad': facturas_directas_periodo_qs.count(),
        'notas_credito_periodo': float(notas_credito_periodo),
        'notas_credito_periodo_cantidad': notas_credito_autorizadas_periodo_qs.count(),
        'facturado_neto_periodo': float(facturado_neto_periodo),
        'notas_credito_pendientes': notas_credito_pendientes,
        'notas_credito_hoy': notas_credito_hoy,
        'productos_activos': productos_activos,
        'clientes_activos': clientes_activos,
        'stock_bajo_count': stock_bajo_count,
        'cajas_abiertas': cajas_abiertas,
        'pedidos_abiertos': pedidos_abiertos,
        'total_por_cobrar': float(total_por_cobrar),
        'total_vencido': float(total_vencido),
        'cuentas_vencidas': cuentas_vencidas_qs.count(),
        # Lists
        'alertas_operativas': alertas_operativas,
        'facturas_recientes': facturas_recientes,
        'top_productos': top_productos,
        'top_clientes': top_clientes,
        'ventas_por_metodo': ventas_por_metodo,
        'stock_bajo': stock_bajo,
        'ultimos_meses': ultimos_meses,
        'proximas_declaraciones': proximas_declaraciones,
        'configuracion_incompleta': configuracion_incompleta,
        'progreso_configuracion': progreso_configuracion,
    })
