"""
Declaraciones SRI — Form 104 (IVA), Form 103 (Retenciones), ATS XML.

Endpoints de solo lectura computan datos en tiempo real.
Endpoints de gestión permiten crear/guardar/marcar como presentada una declaración.
"""
import logging
from decimal import Decimal
import xml.etree.ElementTree as ET
from xml.dom.minidom import parseString

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from apps.core.permissions import IsAuthenticated, IsTenantUser
from apps.facturacion.models import Factura, Retencion

from .models import DeclaracionMensual
from .serializers import DeclaracionMensualSerializer, MarcarPresentadaSerializer
from .services import calcular_form104, calcular_form103, calcular_calendario, calcular_fecha_limite


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


def _get_empresa(request):
    """Obtiene la empresa del tenant o del usuario autenticado."""
    empresa = getattr(request, 'tenant', None)
    if not empresa and request.user.is_authenticated:
        empresa = getattr(request.user, 'empresa', None)
    return empresa


# ── Form 104 — IVA (lectura en tiempo real) ──────────────────────────────────

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

    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    try:
        datos = calcular_form104(empresa, anio, mes)
    except Exception as e:
        logging.getLogger(__name__).exception('Error en calcular_form104')
        return Response(
            {'error': f'{type(e).__name__}: {e}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    MESES = DeclaracionMensual.MESES
    datos['periodo']['mes_nombre'] = MESES[mes]
    datos['empresa'] = {'ruc': empresa.ruc, 'razon_social': empresa.razon_social}

    return Response(datos)


# ── Form 103 — Retenciones en la Fuente IR (lectura) ─────────────────────────

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

    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    datos = calcular_form103(empresa, anio, mes)

    MESES = DeclaracionMensual.MESES
    datos['periodo']['mes_nombre'] = MESES[mes]
    datos['empresa'] = {'ruc': empresa.ruc, 'razon_social': empresa.razon_social}

    return Response(datos)


# ── Calendario de obligaciones ────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def calendario(request):
    """
    Calendario de obligaciones tributarias del año.
    GET /api/declaraciones/calendario/?anio=2025
    """
    try:
        anio = int(request.query_params.get('anio', timezone.localdate().year))
    except (TypeError, ValueError):
        return Response({'error': 'Parámetro anio inválido'}, status=status.HTTP_400_BAD_REQUEST)

    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    obligaciones = calcular_calendario(empresa, anio)
    return Response({
        'anio': anio,
        'empresa': {'ruc': empresa.ruc, 'razon_social': empresa.razon_social},
        'obligaciones': obligaciones,
    })


# ── Próximas obligaciones (widget para dashboard) ────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def proximas_obligaciones(request):
    """
    Las 5 próximas obligaciones pendientes (para widget de dashboard).
    GET /api/declaraciones/proximas/
    """
    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    hoy = timezone.localdate()
    anio = hoy.year
    obligaciones = calcular_calendario(empresa, anio)

    proximas = [
        o for o in obligaciones
        if o['estado'] in ('pendiente', 'vencida') and o['fecha_limite'] >= hoy.isoformat()
    ]
    # Also include overdue from current year
    vencidas = [
        o for o in obligaciones
        if o['estado'] == 'vencida'
    ]

    resultado = sorted(vencidas + proximas, key=lambda x: x['fecha_limite'])[:5]

    return Response({'proximas': resultado})


# ── CRUD de Declaraciones persistentes ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def listar_declaraciones(request):
    """
    Lista declaraciones de la empresa. Filtros opcionales: ?anio=2025&tipo=104
    GET /api/declaraciones/
    """
    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    qs = DeclaracionMensual.objects.filter(empresa=empresa)

    anio = request.query_params.get('anio')
    if anio:
        qs = qs.filter(anio=int(anio))

    tipo = request.query_params.get('tipo')
    if tipo:
        qs = qs.filter(tipo_formulario=tipo)

    serializer = DeclaracionMensualSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTenantUser])
def calcular_y_guardar(request):
    """
    Calcula los datos del período y los guarda como DeclaracionMensual.
    POST /api/declaraciones/calcular/  { "tipo": "104", "anio": 2025, "mes": 3 }
    Si ya existe, recalcula los datos actualizados.
    """
    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    tipo = request.data.get('tipo', '104')
    try:
        anio = int(request.data.get('anio', 0))
        mes = int(request.data.get('mes', 0))
    except (TypeError, ValueError):
        return Response({'error': 'anio y mes requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    if not (1 <= mes <= 12) or anio < 2000:
        return Response({'error': 'Parámetros anio/mes inválidos'}, status=status.HTTP_400_BAD_REQUEST)

    if tipo not in ('104', '103'):
        return Response({'error': 'tipo debe ser 104 o 103'}, status=status.HTTP_400_BAD_REQUEST)

    # Calcular datos
    if tipo == '104':
        datos = calcular_form104(empresa, anio, mes)
        liq = datos.get('liquidacion', {})
        defaults = {
            'datos_json': datos,
            'estado': DeclaracionMensual.Estado.CALCULADA,
            'total_ventas': Decimal(liq.get('total_ventas_neto', '0')),
            'total_compras': Decimal(datos.get('compras', {}).get('total', '0')),
            'iva_ventas': Decimal(liq.get('iva_ventas_neto', '0')),
            'iva_compras': Decimal(datos.get('compras', {}).get('iva', '0')),
            'impuesto_a_pagar': Decimal(liq.get('iva_a_pagar', '0')),
            'credito_tributario': Decimal(liq.get('credito_tributario_favor', '0')),
            'fecha_limite': calcular_fecha_limite(empresa.ruc, anio, mes),
        }
    else:
        datos = calcular_form103(empresa, anio, mes)
        totales = datos.get('totales', {})
        defaults = {
            'datos_json': datos,
            'estado': DeclaracionMensual.Estado.CALCULADA,
            'total_retenido': Decimal(totales.get('total_retenido_renta', '0'))
                            + Decimal(totales.get('total_retenido_iva', '0')),
            'fecha_limite': calcular_fecha_limite(empresa.ruc, anio, mes),
        }

    decl, created = DeclaracionMensual.objects.update_or_create(
        empresa=empresa,
        tipo_formulario=tipo,
        anio=anio,
        mes=mes,
        defaults=defaults,
    )

    serializer = DeclaracionMensualSerializer(decl)
    http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(serializer.data, status=http_status)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def detalle_declaracion(request, pk):
    """
    Detalle de una declaración guardada.
    GET /api/declaraciones/<id>/
    """
    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    try:
        decl = DeclaracionMensual.objects.get(pk=pk, empresa=empresa)
    except DeclaracionMensual.DoesNotExist:
        return Response({'error': 'Declaración no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    serializer = DeclaracionMensualSerializer(decl)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTenantUser])
def marcar_presentada(request, pk):
    """
    Marca una declaración como presentada al SRI.
    POST /api/declaraciones/<id>/presentar/
    { "numero_formulario_sri": "12345678", "notas": "Presentado vía web SRI" }
    """
    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

    try:
        decl = DeclaracionMensual.objects.get(pk=pk, empresa=empresa)
    except DeclaracionMensual.DoesNotExist:
        return Response({'error': 'Declaración no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    if decl.estado == 'PRESENTADA':
        return Response({'mensaje': 'La declaración ya fue marcada como presentada.'})

    ser = MarcarPresentadaSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    decl.estado = DeclaracionMensual.Estado.PRESENTADA
    decl.fecha_presentacion = timezone.now()
    decl.numero_formulario_sri = ser.validated_data.get('numero_formulario_sri', '')
    if ser.validated_data.get('notas'):
        decl.notas = ser.validated_data['notas']
    decl.save()

    return Response(DeclaracionMensualSerializer(decl).data)


# ── ATS — Anexo Transaccional Simplificado ────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantUser])
def ats(request):
    """
    Genera el XML del Anexo Transaccional Simplificado (ATS).
    GET /api/declaraciones/ats/?anio=2025&mes=3
    """
    anio, mes, err = _get_params(request)
    if err:
        return err

    empresa = _get_empresa(request)
    if not empresa:
        return Response({'error': 'Sin empresa asociada'}, status=status.HTTP_403_FORBIDDEN)

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

    ET.SubElement(root, 'TipoIDInformante').text = 'R'
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
        cli = f.cliente
        det = ET.SubElement(ventas_el, 'detalleVentas')
        ET.SubElement(det, 'tpIdCliente').text        = cli.tipo_identificacion
        ET.SubElement(det, 'idCliente').text           = cli.identificacion
        ET.SubElement(det, 'parteRel').text            = 'NO'
        ET.SubElement(det, 'tipoComprobante').text     = '18'
        ET.SubElement(det, 'tipoEm').text              = 'E'
        ET.SubElement(det, 'numeroComprobantes').text  = '1'
        ET.SubElement(det, 'baseNoGraIva').text        = str(f.subtotal_0)
        ET.SubElement(det, 'baseImponible').text       = str(f.subtotal_sin_impuestos - f.subtotal_0)
        ET.SubElement(det, 'baseImpGrav').text         = str(f.subtotal_12 + f.subtotal_15)
        ET.SubElement(det, 'montoIva').text            = str(f.iva_12 + f.iva_15)
        ET.SubElement(det, 'montoIce').text            = '0.00'
        ET.SubElement(det, 'valorRetIva').text         = '0.00'
        ET.SubElement(det, 'valorRetRenta').text       = '0.00'

    # ── Retenciones emitidas ──────────────────────────────────────────────────
    ret_el = ET.SubElement(root, 'retenciones')
    for r in retenciones:
        prov = r.proveedor
        for imp in r.impuestos.all():
            det = ET.SubElement(ret_el, 'detalleRetenciones')
            ET.SubElement(det, 'tpIdProv').text          = prov.tipo_identificacion
            ET.SubElement(det, 'idProv').text             = prov.identificacion
            ET.SubElement(det, 'tipoComprobante').text    = '01'
            ET.SubElement(det, 'parteRel').text           = 'NO'
            ET.SubElement(det, 'fechaEmisionDoc').text    = str(imp.fecha_emision_doc_sustento)
            ET.SubElement(det, 'numeroComprobante').text  = imp.num_doc_sustento
            ET.SubElement(det, 'baseImponible').text      = str(imp.base_imponible)
            ET.SubElement(det, 'codRetAir').text          = imp.codigo_porcentaje
            ET.SubElement(det, 'baseImpAir').text         = str(imp.base_imponible)
            ET.SubElement(det, 'porcentajeAir').text      = str(imp.tarifa)
            ET.SubElement(det, 'valRetAir').text          = str(imp.valor_retenido)

    raw = ET.tostring(root, encoding='unicode', xml_declaration=False)
    pretty = parseString(f'<?xml version="1.0" encoding="UTF-8"?>{raw}').toprettyxml(
        indent='  ', encoding='UTF-8'
    )

    filename = f'ATS_{empresa.ruc}_{str(anio)}_{str(mes).zfill(2)}.xml'
    response = HttpResponse(pretty, content_type='application/xml; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
