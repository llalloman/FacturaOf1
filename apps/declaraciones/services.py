"""
Declaraciones SRI — Servicios de cálculo y generación.

Centraliza toda la lógica de agregación de facturas, retenciones y compras
para los formularios 104, 103 y ATS.
"""
from datetime import date, timedelta

from django.utils import timezone as tz
from decimal import Decimal
from django.db.models import Sum, Count, Q, F

from apps.facturacion.models import (
    Factura, Retencion, ImpuestoRetencion, NotaCredito, NotaDebito,
)
from apps.proveedores.models import OrdenCompra


# ── Tabla de vencimientos SRI según 9° dígito del RUC ─────────────────────
# Día del mes siguiente en el que vence la declaración mensual.
VENCIMIENTO_POR_DIGITO = {
    1: 10, 2: 12, 3: 14, 4: 16, 5: 18,
    6: 20, 7: 22, 8: 24, 9: 26, 0: 28,
}


def calcular_fecha_limite(ruc: str, anio: int, mes: int) -> date:
    """
    Calcula la fecha límite de presentación de la declaración mensual
    según la tabla del SRI (9° dígito del RUC).
    """
    digito = int(ruc[8]) if len(ruc) >= 9 else 0
    dia = VENCIMIENTO_POR_DIGITO.get(digito, 28)

    # Mes siguiente
    if mes == 12:
        mes_sig, anio_sig = 1, anio + 1
    else:
        mes_sig, anio_sig = mes + 1, anio

    # Ajustar si el día excede el máximo del mes
    import calendar
    max_dia = calendar.monthrange(anio_sig, mes_sig)[1]
    dia = min(dia, max_dia)

    return date(anio_sig, mes_sig, dia)


# ── Cálculo Form 104 — IVA ───────────────────────────────────────────────

def calcular_form104(empresa, anio: int, mes: int) -> dict:
    """
    Agrega todos los datos necesarios para el Formulario 104 (IVA Mensual).
    Retorna un dict listo para almacenar en datos_json.
    """
    base_filter = Q(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    )

    # ── Ventas ─────────────────────────────────────────────────────────────
    facturas = Factura.objects.filter(base_filter).exclude(
        comprobante__estado='ANULADO'
    )
    ventas_agg = facturas.aggregate(
        total_ventas=Sum('total'),
        subtotal_sin_imp=Sum('subtotal_sin_impuestos'),
        subtotal_0=Sum('subtotal_0'),
        subtotal_12=Sum('subtotal_12'),
        subtotal_15=Sum('subtotal_15'),
        iva_12=Sum('iva_12'),
        iva_15=Sum('iva_15'),
        total_descuento=Sum('total_descuento'),
        num_facturas=Count('id'),
    )

    # ── Notas de Crédito (reducen ventas) ──────────────────────────────────
    nc_filter = Q(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    )
    nc_agg = NotaCredito.objects.filter(nc_filter).aggregate(
        total_nc=Sum('total'),
        iva_nc=Sum('iva'),
        num_nc=Count('id'),
    )

    # ── Notas de Débito (aumentan ventas) ──────────────────────────────────
    nd_filter = Q(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    )
    nd_agg = NotaDebito.objects.filter(nd_filter).aggregate(
        total_nd=Sum('total'),
        num_nd=Count('id'),
    )

    # ── Compras (Órdenes de compra confirmadas) ───────────────────────────
    compras = OrdenCompra.objects.filter(
        empresa=empresa,
        estado__in=['RECIBIDA', 'PARCIAL'],
        fecha_orden__year=anio,
        fecha_orden__month=mes,
    )
    compras_agg = compras.aggregate(
        total_compras=Sum('total'),
        subtotal_compras=Sum('subtotal'),
        iva_compras=Sum('iva'),
        num_compras=Count('id'),
    )

    # ── Retenciones IVA emitidas ──────────────────────────────────────────
    ret_iva = ImpuestoRetencion.objects.filter(
        retencion__comprobante__empresa=empresa,
        retencion__comprobante__estado='AUTORIZADO',
        retencion__comprobante__fecha_emision__year=anio,
        retencion__comprobante__fecha_emision__month=mes,
        codigo='2',  # IVA
    ).aggregate(
        total=Sum('valor_retenido'),
        base_total=Sum('base_imponible'),
    )

    # ── Retenciones IVA recibidas (que nos hicieron) ──────────────────────
    # Nota: esto requeriría un modelo aparte. Por ahora = 0
    iva_retenido_recibido = Decimal('0.00')

    # ── Cálculos finales ────────────────────────────────────────────────────
    iva_ventas = (ventas_agg['iva_12'] or Decimal('0')) + (ventas_agg['iva_15'] or Decimal('0'))
    iva_nc = nc_agg.get('iva_nc') or Decimal('0')
    iva_ventas_neto = iva_ventas - iva_nc

    iva_compras_total = compras_agg['iva_compras'] or Decimal('0')
    iva_retenido_emitido = ret_iva['total'] or Decimal('0')

    # Crédito tributario = IVA pagado en compras
    credito_tributario = iva_compras_total

    # IVA causado = IVA ventas neto - crédito tributario
    iva_causado = iva_ventas_neto - credito_tributario

    # Si negativo = crédito tributario a favor
    if iva_causado < 0:
        credito_tributario_favor = abs(iva_causado)
        iva_a_pagar = Decimal('0.00')
    else:
        credito_tributario_favor = Decimal('0.00')
        iva_a_pagar = iva_causado - iva_retenido_recibido

    iva_a_pagar = max(Decimal('0.00'), iva_a_pagar)

    total_ventas_neto = (ventas_agg['total_ventas'] or Decimal('0')) \
        - (nc_agg['total_nc'] or Decimal('0')) \
        + (nd_agg['total_nd'] or Decimal('0'))

    fecha_limite = calcular_fecha_limite(empresa.ruc, anio, mes)

    return {
        'periodo': {'anio': anio, 'mes': mes},
        'fecha_limite': fecha_limite.isoformat(),
        'ventas': {
            'num_facturas': ventas_agg['num_facturas'] or 0,
            'subtotal_sin_impuestos': str(ventas_agg['subtotal_sin_imp'] or 0),
            'subtotal_0': str(ventas_agg['subtotal_0'] or 0),
            'subtotal_12': str(ventas_agg['subtotal_12'] or 0),
            'subtotal_15': str(ventas_agg['subtotal_15'] or 0),
            'iva_12': str(ventas_agg['iva_12'] or 0),
            'iva_15': str(ventas_agg['iva_15'] or 0),
            'total_descuento': str(ventas_agg['total_descuento'] or 0),
            'total_ventas_bruto': str(ventas_agg['total_ventas'] or 0),
        },
        'notas_credito': {
            'cantidad': nc_agg['num_nc'] or 0,
            'total': str(nc_agg['total_nc'] or 0),
            'iva': str(iva_nc),
        },
        'notas_debito': {
            'cantidad': nd_agg['num_nd'] or 0,
            'total': str(nd_agg['total_nd'] or 0),
        },
        'compras': {
            'num_ordenes': compras_agg['num_compras'] or 0,
            'subtotal': str(compras_agg['subtotal_compras'] or 0),
            'iva': str(iva_compras_total),
            'total': str(compras_agg['total_compras'] or 0),
        },
        'retenciones_iva_emitidas': {
            'base_imponible': str(ret_iva['base_total'] or 0),
            'valor_retenido': str(iva_retenido_emitido),
        },
        'liquidacion': {
            'iva_ventas_neto': str(iva_ventas_neto),
            'credito_tributario': str(credito_tributario),
            'iva_causado': str(iva_causado),
            'credito_tributario_favor': str(credito_tributario_favor),
            'iva_a_pagar': str(iva_a_pagar),
            'total_ventas_neto': str(total_ventas_neto),
        },
        'nota': (
            'Las compras se basan en Órdenes de Compra (estado RECIBIDA/PARCIAL). '
            'Las retenciones de IVA que le hicieron a la empresa aún no se registran automáticamente.'
        ),
    }


# ── Cálculo Form 103 — Retenciones en la Fuente ─────────────────────────

def calcular_form103(empresa, anio: int, mes: int) -> dict:
    """
    Agrega datos de retenciones en la fuente del IR para el formulario 103.
    """
    base_filter = Q(
        retencion__comprobante__empresa=empresa,
        retencion__comprobante__estado='AUTORIZADO',
        retencion__comprobante__fecha_emision__year=anio,
        retencion__comprobante__fecha_emision__month=mes,
    )

    ret_renta = ImpuestoRetencion.objects.filter(
        base_filter, codigo='1',
    ).values('codigo_porcentaje', 'tarifa').annotate(
        base_total=Sum('base_imponible'),
        retenido_total=Sum('valor_retenido'),
        num_retenciones=Count('id'),
    ).order_by('codigo_porcentaje')

    ret_iva = ImpuestoRetencion.objects.filter(
        base_filter, codigo='2',
    ).values('codigo_porcentaje', 'tarifa').annotate(
        base_total=Sum('base_imponible'),
        retenido_total=Sum('valor_retenido'),
        num_retenciones=Count('id'),
    ).order_by('codigo_porcentaje')

    totales_renta = ImpuestoRetencion.objects.filter(
        base_filter, codigo='1',
    ).aggregate(
        total_base=Sum('base_imponible'),
        total_retenido=Sum('valor_retenido'),
    )

    totales_iva = ImpuestoRetencion.objects.filter(
        base_filter, codigo='2',
    ).aggregate(
        total_base=Sum('base_imponible'),
        total_retenido=Sum('valor_retenido'),
    )

    # Total de retenciones (comprobantes únicos)
    num_retenciones = Retencion.objects.filter(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    ).count()

    fecha_limite = calcular_fecha_limite(empresa.ruc, anio, mes)

    return {
        'periodo': {'anio': anio, 'mes': mes},
        'fecha_limite': fecha_limite.isoformat(),
        'num_comprobantes_retencion': num_retenciones,
        'retenciones_renta': [
            {
                'codigo_porcentaje': r['codigo_porcentaje'],
                'tarifa': str(r['tarifa']),
                'base_imponible': str(r['base_total']),
                'valor_retenido': str(r['retenido_total']),
                'cantidad': r['num_retenciones'],
            }
            for r in ret_renta
        ],
        'retenciones_iva': [
            {
                'codigo_porcentaje': r['codigo_porcentaje'],
                'tarifa': str(r['tarifa']),
                'base_imponible': str(r['base_total']),
                'valor_retenido': str(r['retenido_total']),
                'cantidad': r['num_retenciones'],
            }
            for r in ret_iva
        ],
        'totales': {
            'base_imponible_renta': str(totales_renta['total_base'] or 0),
            'total_retenido_renta': str(totales_renta['total_retenido'] or 0),
            'base_imponible_iva': str(totales_iva['total_base'] or 0),
            'total_retenido_iva': str(totales_iva['total_retenido'] or 0),
        },
    }


# ── Calendario de obligaciones ────────────────────────────────────────────

def calcular_calendario(empresa, anio: int) -> list[dict]:
    """
    Retorna las 12 obligaciones mensuales del año con sus fechas límite
    y estado (pendiente/presentada/vencida).
    """
    from .models import DeclaracionMensual
    hoy = tz.localdate()
    resultado = []

    declaraciones = {
        (d.tipo_formulario, d.mes): d
        for d in DeclaracionMensual.objects.filter(
            empresa=empresa, anio=anio,
        )
    }

    for mes in range(1, 13):
        fecha_limite = calcular_fecha_limite(empresa.ruc, anio, mes)

        for tipo, nombre in [('104', 'IVA (Form 104)'), ('103', 'Retenciones (Form 103)')]:
            decl = declaraciones.get((tipo, mes))
            if decl and decl.estado == 'PRESENTADA':
                estado = 'presentada'
            elif fecha_limite < hoy:
                estado = 'vencida' if not decl or decl.estado != 'PRESENTADA' else 'presentada'
            else:
                estado = 'pendiente'

            resultado.append({
                'mes': mes,
                'tipo_formulario': tipo,
                'nombre': nombre,
                'fecha_limite': fecha_limite.isoformat(),
                'estado': estado,
                'declaracion_id': decl.id if decl else None,
            })

    return resultado
