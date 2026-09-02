from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from xml.etree import ElementTree as ET


TIPOS_POR_TAG = {
    'factura': '01',
    'liquidacionCompra': '03',
    'notaCredito': '04',
    'notaDebito': '05',
    'guiaRemision': '06',
    'comprobanteRetencion': '07',
}


@dataclass
class DocumentoParseado:
    tipo_comprobante: str = '00'
    clave_acceso: str = ''
    numero_autorizacion: str = ''
    numero_comprobante: str = ''
    ruc_emisor: str = ''
    razon_social_emisor: str = ''
    ruc_receptor: str = ''
    razon_social_receptor: str = ''
    fecha_emision: Any = None
    fecha_autorizacion: Any = None
    estado_sri: str = 'SIN_VALIDAR'
    subtotal_0: Decimal = Decimal('0.00')
    subtotal_iva: Decimal = Decimal('0.00')
    subtotal_no_objeto: Decimal = Decimal('0.00')
    subtotal_exento: Decimal = Decimal('0.00')
    iva: Decimal = Decimal('0.00')
    ice: Decimal = Decimal('0.00')
    total: Decimal = Decimal('0.00')
    detalles: list[dict[str, Any]] = field(default_factory=list)
    impuestos: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    errores: list[str] = field(default_factory=list)


def parse_sri_xml(xml_text: str) -> DocumentoParseado:
    xml_text = _clean_xml(xml_text)
    root = ET.fromstring(xml_text)
    documento_xml = xml_text
    autorizacion = _parse_autorizacion(root)

    if autorizacion.get('comprobante'):
        documento_xml = _clean_xml(autorizacion['comprobante'])
        root = ET.fromstring(documento_xml)

    root_tag = _strip_ns(root.tag)
    data = DocumentoParseado(tipo_comprobante=TIPOS_POR_TAG.get(root_tag, '00'))
    data.metadata['root_tag'] = root_tag

    if autorizacion:
        data.numero_autorizacion = autorizacion.get('numero_autorizacion', '')
        data.fecha_autorizacion = _parse_datetime(autorizacion.get('fecha_autorizacion'))
        estado = autorizacion.get('estado', '').upper()
        if estado:
            data.estado_sri = 'AUTORIZADO' if estado == 'AUTORIZADO' else 'NO_AUTORIZADO'
            data.metadata['estado_autorizacion'] = estado

    info_tributaria = _child(root, 'infoTributaria')
    if info_tributaria is not None:
        data.clave_acceso = _text(info_tributaria, 'claveAcceso')
        data.ruc_emisor = _text(info_tributaria, 'ruc')
        data.razon_social_emisor = _text(info_tributaria, 'razonSocial')
        data.numero_comprobante = '-'.join(
            part for part in [
                _text(info_tributaria, 'estab'),
                _text(info_tributaria, 'ptoEmi'),
                _text(info_tributaria, 'secuencial'),
            ] if part
        )
        data.tipo_comprobante = _text(info_tributaria, 'codDoc') or data.tipo_comprobante

    info_doc = _find_info_documento(root, root_tag)
    if info_doc is not None:
        data.fecha_emision = _parse_date(_text(info_doc, 'fechaEmision'))
        data.ruc_receptor = (
            _text(info_doc, 'identificacionComprador')
            or _text(info_doc, 'identificacionSujetoRetenido')
            or _text(info_doc, 'identificacionDestinatario')
        )
        data.razon_social_receptor = (
            _text(info_doc, 'razonSocialComprador')
            or _text(info_doc, 'razonSocialSujetoRetenido')
            or _text(info_doc, 'razonSocialDestinatario')
        )
        data.total = (
            _decimal(_text(info_doc, 'importeTotal'))
            or _decimal(_text(info_doc, 'valorTotal'))
            or _decimal(_text(info_doc, 'totalSinImpuestos'))
        )

    for impuesto in _iter_total_impuestos(root):
        item = {
            'codigo': _text(impuesto, 'codigo'),
            'codigo_porcentaje': _text(impuesto, 'codigoPorcentaje'),
            'tarifa': _decimal(_text(impuesto, 'tarifa')),
            'base_imponible': _decimal(_text(impuesto, 'baseImponible')),
            'valor': _decimal(_text(impuesto, 'valor')),
        }
        data.impuestos.append(item)
        _acumular_totales(data, item)

    for detalle in _iter_detalles(root):
        detalle_data = _parse_detalle(detalle)
        data.detalles.append(detalle_data)

    if not data.clave_acceso:
        data.errores.append('El XML no contiene clave de acceso.')
    if not data.ruc_emisor:
        data.errores.append('El XML no contiene RUC del emisor.')

    return data


def _clean_xml(xml_text: str) -> str:
    return xml_text.strip().lstrip('\ufeff')


def _strip_ns(tag: str) -> str:
    return tag.split('}', 1)[-1] if '}' in tag else tag


def _children(node, name: str):
    return [child for child in list(node) if _strip_ns(child.tag) == name]


def _child(node, name: str):
    matches = _children(node, name)
    return matches[0] if matches else None


def _find(node, name: str):
    for child in node.iter():
        if _strip_ns(child.tag) == name:
            return child
    return None


def _text(node, name: str) -> str:
    found = _find(node, name)
    return (found.text or '').strip() if found is not None and found.text else ''


def _decimal(value: str | None) -> Decimal:
    if not value:
        return Decimal('0.00')
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def _parse_date(value: str | None):
    if not value:
        return None
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_datetime(value: str | None):
    if not value:
        return None
    raw = value.strip().replace('T', ' ')
    for fmt in ('%d/%m/%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y'):
        try:
            return datetime.strptime(raw[:19], fmt)
        except ValueError:
            continue
    return None


def _parse_autorizacion(root) -> dict[str, str]:
    if _strip_ns(root.tag) != 'autorizacion':
        return {}
    return {
        'estado': _text(root, 'estado'),
        'numero_autorizacion': _text(root, 'numeroAutorizacion'),
        'fecha_autorizacion': _text(root, 'fechaAutorizacion'),
        'comprobante': _text(root, 'comprobante'),
    }


def _find_info_documento(root, root_tag: str):
    names = {
        'factura': 'infoFactura',
        'liquidacionCompra': 'infoLiquidacionCompra',
        'notaCredito': 'infoNotaCredito',
        'notaDebito': 'infoNotaDebito',
        'guiaRemision': 'infoGuiaRemision',
        'comprobanteRetencion': 'infoCompRetencion',
    }
    return _child(root, names.get(root_tag, ''))


def _iter_total_impuestos(root):
    for total_con_impuestos in root.iter():
        if _strip_ns(total_con_impuestos.tag) != 'totalConImpuestos':
            continue
        for impuesto in total_con_impuestos.iter():
            if _strip_ns(impuesto.tag) == 'totalImpuesto':
                yield impuesto


def _iter_detalles(root):
    for parent in root.iter():
        if _strip_ns(parent.tag) not in {'detalles', 'docsSustento'}:
            continue
        for child in list(parent):
            if _strip_ns(child.tag) in {'detalle', 'docSustento'}:
                yield child


def _parse_detalle(detalle) -> dict[str, Any]:
    base = (
        _decimal(_text(detalle, 'precioTotalSinImpuesto'))
        or _decimal(_text(detalle, 'baseImponible'))
    )
    iva = Decimal('0.00')
    ice = Decimal('0.00')
    for impuesto in detalle.iter():
        if _strip_ns(impuesto.tag) != 'impuesto':
            continue
        codigo = _text(impuesto, 'codigo')
        valor = _decimal(_text(impuesto, 'valor'))
        if codigo == '2':
            iva += valor
        elif codigo == '3':
            ice += valor
    return {
        'codigo_principal': _text(detalle, 'codigoPrincipal') or _text(detalle, 'codDocSustento'),
        'descripcion': _text(detalle, 'descripcion') or _text(detalle, 'numDocSustento') or 'Documento recibido',
        'cantidad': _decimal(_text(detalle, 'cantidad')) or Decimal('1.00'),
        'precio_unitario': _decimal(_text(detalle, 'precioUnitario')),
        'descuento': _decimal(_text(detalle, 'descuento')),
        'base_imponible': base,
        'iva': iva,
        'ice': ice,
        'total': base + iva + ice,
    }


def _acumular_totales(data: DocumentoParseado, item: dict[str, Any]) -> None:
    codigo = item['codigo']
    codigo_porcentaje = item['codigo_porcentaje']
    base = item['base_imponible']
    valor = item['valor']
    if codigo == '2':
        data.iva += valor
        if codigo_porcentaje == '0':
            data.subtotal_0 += base
        elif codigo_porcentaje == '6':
            data.subtotal_no_objeto += base
        elif codigo_porcentaje == '7':
            data.subtotal_exento += base
        else:
            data.subtotal_iva += base
    elif codigo == '3':
        data.ice += valor
