"""
Unified Dashboard API — returns all KPIs in a single request.

GET /api/dashboard/
  → Tenant users: ventas_mes, facturas, productos, clientes, ultimos_meses, declaraciones
  → SUPER_ADMIN:  empresas, usuarios, suscripciones overview
"""

from calendar import monthrange
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user

    if _is_super_admin(user):
        return _dashboard_super_admin(request)
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
    from apps.facturacion.models import Factura, ComprobanteElectronico
    from apps.productos.models import Producto
    from apps.clientes.models import Cliente
    from apps.ventas.models import Venta

    empresa = getattr(request.user, 'empresa', None)
    if not empresa:
        return Response({'error': 'Sin empresa asignada.'}, status=400)

    ahora = timezone.now()
    mes, anio = ahora.month, ahora.year

    # ── Ventas del mes ────────────────────────────────────────────────────────
    inicio_mes, fin_mes = _month_range(anio, mes)
    ventas_mes_qs = Venta.objects.filter(
        empresa=empresa, estado='COMPLETADA',
        fecha_venta__gte=inicio_mes, fecha_venta__lte=fin_mes,
    )
    ventas_mes_agg = ventas_mes_qs.aggregate(
        total=Sum('total'), cantidad=Count('id'),
    )

    # ── Facturas ──────────────────────────────────────────────────────────────
    facturas_qs = Factura.objects.filter(comprobante__empresa=empresa)
    facturas_por_estado = dict(
        facturas_qs.values_list('comprobante__estado')
        .annotate(c=Count('id'))
        .values_list('comprobante__estado', 'c')
    )
    facturas_emitidas = facturas_por_estado.get('AUTORIZADO', 0) + facturas_por_estado.get('ENVIADO', 0)
    facturas_enviadas = facturas_por_estado.get('ENVIADO', 0)

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

    # Top productos por precio (activos)
    top_productos = list(
        productos_qs.filter(activo=True)
        .order_by('-precio')[:4]
        .values('id', 'nombre', 'precio', 'stock_actual')
    )
    top_productos = [
        {**p, 'precio': float(p['precio'] or 0), 'stock_actual': float(p['stock_actual'] or 0)}
        for p in top_productos
    ]

    # ── Clientes ──────────────────────────────────────────────────────────────
    clientes_activos = Cliente.objects.filter(empresa=empresa, activo=True).count()

    # ── Últimos 6 meses ──────────────────────────────────────────────────────
    from dateutil.relativedelta import relativedelta
    ultimos_meses = []
    for i in range(5, -1, -1):
        fecha = ahora - relativedelta(months=i)
        m, a = fecha.month, fecha.year
        ini, fin = _month_range(a, m)
        agg = Venta.objects.filter(
            empresa=empresa, estado='COMPLETADA',
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

    return Response({
        'tipo': 'tenant',
        # KPIs
        'ventas_mes': float(ventas_mes_agg['total'] or 0),
        'ventas_mes_cantidad': ventas_mes_agg['cantidad'] or 0,
        'facturas_emitidas': facturas_emitidas,
        'facturas_enviadas': facturas_enviadas,
        'facturas_por_estado': facturas_por_estado,
        'productos_activos': productos_activos,
        'clientes_activos': clientes_activos,
        # Lists
        'facturas_recientes': facturas_recientes,
        'top_productos': top_productos,
        'stock_bajo': stock_bajo,
        'ultimos_meses': ultimos_meses,
        'proximas_declaraciones': proximas_declaraciones,
    })
