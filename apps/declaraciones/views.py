"""
Declaraciones SRI — Form 104 (IVA), Form 103 (Retenciones), ATS XML.

Todos los endpoints son de solo lectura y computan los datos en tiempo real
a partir de las facturas, retenciones y órdenes de compra del periodo solicitado.
"""
from decimal import Decimal
from io import BytesIO
import xml.etree.ElementTree as ET
from xml.dom.minidom import parseString

from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from apps.core.permissions import IsAuthenticated, IsTenantUser
from apps.facturacion.models import Factura, Retencion, ImpuestoRetencion, ComprobanteElectronico
from apps.proveedores.models import OrdenCompra


def _get_params(request):
    """Extrae y valida anio/mes de los query params."""
    try:
        anio = int(request.query_params.get('anio', 0))
        mes  = int(request.query_params.get('mes', 0))
    except (TypeError, ValueError):
        return None, None, Response(
            {'error': 'Los parámetros anio y mes deben ser enteros'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not (1 <= mes <= 12) or anio < 2000:
        return None, None, Response(
            {'error': 'Parámetros anio/mes inválidos'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return anio, mes, None


# ── Form 104 — IVA ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def form104(request):
    """
    Resumen de IVA para el formulario 104 del período solicitado.

    GET /api/declaraciones/form104/?anio=2025&mes=3
    """
    anio, mes, err = _get_params(request)
    if err:
        return err

    empresa = request.user.empresa

    # ── Ventas autorizadas del período ─────────────────────────────────────
    facturas = Factura.objects.filter(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    ).exclude(comprobante__estado='ANULADO')

    ventas_agg = facturas.aggregate(
        total_ventas=Sum('total'),
        subtotal_0=Sum('subtotal_0'),
        subtotal_12=Sum('subtotal_12'),
        subtotal_15=Sum('subtotal_15'),
        iva_12_cobrado=Sum('iva_12'),
        iva_15_cobrado=Sum('iva_15'),
        total_descuento=Sum('total_descuento'),
        num_comprobantes=Count('id'),
    )
    iva_ventas = (ventas_agg['iva_12_cobrado'] or Decimal('0')) + (ventas_agg['iva_15_cobrado'] or Decimal('0'))

    # ── Compras del período (desde órdenes de compra confirmadas) ────────────
    compras = OrdenCompra.objects.filter(
        empresa=empresa,
        estado__in=['RECIBIDA', 'PARCIAL'],
        fecha_orden__year=anio,
        fecha_orden__month=mes,
    )
    compras_agg = compras.aggregate(
        total_compras=Sum('total'),
        iva_compras=Sum('iva'),
        subtotal_compras=Sum('subtotal'),
        num_compras=Count('id'),
    )
    iva_compras = compras_agg['iva_compras'] or Decimal('0')

    # ── Retenciones IVA emitidas en el período (código 2) ──────────────────
    iva_retenido = ImpuestoRetencion.objects.filter(
        retencion__comprobante__empresa=empresa,
        retencion__comprobante__estado='AUTORIZADO',
        retencion__comprobante__fecha_emision__year=anio,
        retencion__comprobante__fecha_emision__month=mes,
        codigo='2',
    ).aggregate(total=Sum('valor_retenido'))['total'] or Decimal('0')

    credito_tributario = iva_compras - iva_retenido
    iva_a_pagar = max(Decimal('0'), iva_ventas - credito_tributario)

    MESES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    return Response({
        'periodo': {'anio': anio, 'mes': mes, 'mes_nombre': MESES[mes]},
        'empresa': {
            'ruc': empresa.ruc,
            'razon_social': empresa.razon_social,
        },
        'ventas': {
            'num_comprobantes': ventas_agg['num_comprobantes'] or 0,
            'subtotal_0': ventas_agg['subtotal_0'] or 0,
            'subtotal_12': ventas_agg['subtotal_12'] or 0,
            'subtotal_15': ventas_agg['subtotal_15'] or 0,
            'total_descuento': ventas_agg['total_descuento'] or 0,
            'iva_12': ventas_agg['iva_12_cobrado'] or 0,
            'iva_15': ventas_agg['iva_15_cobrado'] or 0,
            'iva_total': iva_ventas,
            'total_ventas_neto': ventas_agg['total_ventas'] or 0,
        },
        'compras': {
            'num_ordenes': compras_agg['num_compras'] or 0,
            'subtotal': compras_agg['subtotal_compras'] or 0,
            'iva_compras': iva_compras,
            'total_compras': compras_agg['total_compras'] or 0,
        },
        'retenciones_iva': iva_retenido,
        'credito_tributario': credito_tributario,
        'iva_a_pagar': iva_a_pagar,
        'nota': 'Las compras se basan en Órdenes de Compra (estado RECIBIDA/PARCIAL). Para mayor precisión registre las facturas de proveedor.',
    })


# ── Form 103 — Retenciones en la Fuente IR ───────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def form103(request):
    """
    Detalle de retenciones en la fuente para el formulario 103.

    GET /api/declaraciones/form103/?anio=2025&mes=3
    """
    anio, mes, err = _get_params(request)
    if err:
        return err

    empresa = request.user.empresa

    impuestos_renta = ImpuestoRetencion.objects.filter(
        retencion__comprobante__empresa=empresa,
        retencion__comprobante__estado='AUTORIZADO',
        retencion__comprobante__fecha_emision__year=anio,
        retencion__comprobante__fecha_emision__month=mes,
        codigo='1',  # Solo Renta
    ).values('codigo_porcentaje', 'tarifa').annotate(
        base_total=Sum('base_imponible'),
        retenido_total=Sum('valor_retenido'),
        num_retenciones=Count('id'),
    ).order_by('codigo_porcentaje')

    impuestos_iva = ImpuestoRetencion.objects.filter(
        retencion__comprobante__empresa=empresa,
        retencion__comprobante__estado='AUTORIZADO',
        retencion__comprobante__fecha_emision__year=anio,
        retencion__comprobante__fecha_emision__month=mes,
        codigo='2',  # IVA
    ).values('codigo_porcentaje', 'tarifa').annotate(
        base_total=Sum('base_imponible'),
        retenido_total=Sum('valor_retenido'),
        num_retenciones=Count('id'),
    ).order_by('codigo_porcentaje')

    totales_renta = ImpuestoRetencion.objects.filter(
        retencion__comprobante__empresa=empresa,
        retencion__comprobante__estado='AUTORIZADO',
        retencion__comprobante__fecha_emision__year=anio,
        retencion__comprobante__fecha_emision__month=mes,
        codigo='1',
    ).aggregate(
        total_base=Sum('base_imponible'),
        total_retenido=Sum('valor_retenido'),
    )

    MESES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    return Response({
        'periodo': {'anio': anio, 'mes': mes, 'mes_nombre': MESES[mes]},
        'empresa': {
            'ruc': empresa.ruc,
            'razon_social': empresa.razon_social,
        },
        'retenciones_renta': list(impuestos_renta),
        'retenciones_iva': list(impuestos_iva),
        'totales': {
            'base_imponible_total': totales_renta['total_base'] or 0,
            'total_retenido_renta': totales_renta['total_retenido'] or 0,
        },
    })


# ── ATS — Anexo Transaccional Simplificado ────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def ats(request):
    """
    Genera el XML del Anexo Transaccional Simplificado (ATS).

    GET /api/declaraciones/ats/?anio=2025&mes=3
    Retorna el XML con Content-Type application/xml para su descarga.
    """
    anio, mes, err = _get_params(request)
    if err:
        return err

    empresa = request.user.empresa

    facturas = Factura.objects.filter(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    ).select_related(
        'comprobante', 'cliente'
    ).prefetch_related('detalles')

    retenciones = Retencion.objects.filter(
        comprobante__empresa=empresa,
        comprobante__estado='AUTORIZADO',
        comprobante__fecha_emision__year=anio,
        comprobante__fecha_emision__month=mes,
    ).select_related('comprobante', 'proveedor').prefetch_related('impuestos')

    # ── Build XML ─────────────────────────────────────────────────────────────
    root = ET.Element('iva')

    # TipoIDInformante
    ET.SubElement(root, 'TipoIDInformante').text = 'R'  # RUC
    ET.SubElement(root, 'IdInformante').text = empresa.ruc
    ET.SubElement(root, 'razonSocial').text = empresa.razon_social
    ET.SubElement(root, 'Anio').text = str(anio)
    ET.SubElement(root, 'Mes').text = str(mes).zfill(2)
    ET.SubElement(root, 'numEstabRuc').text = '001'
    ET.SubElement(root, 'totalVentas').text = str(
        sum(f.total for f in facturas)
    )

    # ── Ventas ────────────────────────────────────────────────────────────────
    ventas_el = ET.SubElement(root, 'ventas')
    for f in facturas:
        comp = f.comprobante
        cli  = f.cliente
        det  = ET.SubElement(ventas_el, 'detalleVentas')
        ET.SubElement(det, 'tpIdCliente').text    = cli.tipo_identificacion
        ET.SubElement(det, 'idCliente').text       = cli.identificacion
        ET.SubElement(det, 'parteRel').text        = 'NO'
        ET.SubElement(det, 'tipoComprobante').text = '18'  # 18 = Factura
        ET.SubElement(det, 'tipoEm').text          = 'E'   # Electrónica
        ET.SubElement(det, 'numeroComprobantes').text = '1'
        ET.SubElement(det, 'baseNoGraIva').text    = str(f.subtotal_0)
        ET.SubElement(det, 'baseImponible').text   = str(f.subtotal_sin_impuestos - f.subtotal_0)
        ET.SubElement(det, 'baseImpGrav').text     = str(f.subtotal_12 + f.subtotal_15)
        ET.SubElement(det, 'montoIva').text        = str(f.iva_12 + f.iva_15)
        ET.SubElement(det, 'montoIce').text        = '0.00'
        ET.SubElement(det, 'valorRetIva').text     = '0.00'
        ET.SubElement(det, 'valorRetRenta').text   = '0.00'

    # ── Retenciones emitidas ──────────────────────────────────────────────────
    ret_el = ET.SubElement(root, 'retenciones')
    for r in retenciones:
        comp = r.comprobante
        prov = r.proveedor
        for imp in r.impuestos.all():
            det = ET.SubElement(ret_el, 'detalleRetenciones')
            ET.SubElement(det, 'tpIdProv').text      = prov.tipo_identificacion
            ET.SubElement(det, 'idProv').text         = prov.identificacion
            ET.SubElement(det, 'tipoComprobante').text = '01'  # Factura
            ET.SubElement(det, 'parteRel').text        = 'NO'
            ET.SubElement(det, 'fechaEmisionDoc').text = str(imp.fecha_emision_doc_sustento)
            ET.SubElement(det, 'numeroComprobante').text = imp.num_doc_sustento
            ET.SubElement(det, 'baseImponible').text  = str(imp.base_imponible)
            ET.SubElement(det, 'codRetAir').text      = imp.codigo_porcentaje
            ET.SubElement(det, 'baseImpAir').text     = str(imp.base_imponible)
            ET.SubElement(det, 'porcentajeAir').text  = str(imp.tarifa)
            ET.SubElement(det, 'valRetAir').text      = str(imp.valor_retenido)

    # Pretty-print XML
    raw = ET.tostring(root, encoding='unicode', xml_declaration=False)
    pretty = parseString(f'<?xml version="1.0" encoding="UTF-8"?>{raw}').toprettyxml(
        indent='  ', encoding='UTF-8'
    )

    filename = f'ATS_{empresa.ruc}_{str(anio)}_{str(mes).zfill(2)}.xml'
    response = HttpResponse(pretty, content_type='application/xml; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
