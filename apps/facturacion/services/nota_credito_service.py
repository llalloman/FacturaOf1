"""
Servicio de Nota de Crédito Electrónica (codDoc=04).
Modelo: anulación total de una Factura autorizada por el SRI.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.facturacion.services.factura_service import (
    _extraer_mensajes_autorizacion,
    _extraer_mensajes_recepcion,
    _consultar_autorizacion_inmediata,
)

logger = logging.getLogger(__name__)


@transaction.atomic
def crear_nota_credito_desde_factura(factura, motivo: str = 'Anulación de factura'):
    """
    Crea un ComprobanteElectronico + NotaCredito + DetalleNotaCredito copiando
    todos los ítems de la factura de origen.
    Retorna la NotaCredito creada (aún en estado BORRADOR).
    """
    from apps.facturacion.models import (
        NotaCredito, DetalleNotaCredito, ComprobanteElectronico, Secuencial,
    )

    comp_orig = factura.comprobante
    empresa   = comp_orig.empresa
    estab     = comp_orig.establecimiento
    pemi      = comp_orig.punto_emision

    # Secuencial independiente para NC (tipo_comprobante='04')
    secuencial_obj, _ = Secuencial.objects.get_or_create(
        empresa=empresa,
        tipo_comprobante='04',
        establecimiento=estab,
        punto_emision=pemi,
        defaults={'secuencial_actual': 0},
    )
    siguiente = secuencial_obj.get_siguiente()
    numero = f"{estab}-{pemi}-{siguiente}"

    comprobante = ComprobanteElectronico.objects.create(
        empresa=empresa,
        usuario_creador=comp_orig.usuario_creador,
        tipo_comprobante='04',
        establecimiento=estab,
        punto_emision=pemi,
        secuencial=siguiente,
        numero_comprobante=numero,
        fecha_emision=timezone.now(),
        estado=ComprobanteElectronico.EstadoChoices.BORRADOR,
    )

    nota = NotaCredito.objects.create(
        comprobante=comprobante,
        factura_origen=factura,
        motivo=motivo[:300],
        subtotal_sin_impuestos=factura.subtotal_sin_impuestos,
        total_descuento=factura.total_descuento,
        total=factura.total,
    )

    for df in factura.detalles.all():
        DetalleNotaCredito.objects.create(
            nota_credito=nota,
            codigo_principal=df.codigo_principal,
            descripcion=df.descripcion,
            cantidad=df.cantidad,
            precio_unitario=df.precio_unitario,
            descuento=df.descuento,
            precio_total_sin_impuesto=df.precio_total_sin_impuesto,
            codigo_impuesto=df.codigo_impuesto,
            codigo_porcentaje=df.codigo_porcentaje,
            tarifa=df.tarifa,
            valor_impuesto=df.valor_impuesto,
        )

    return nota


def procesar_nota_credito_sri(nota_credito):
    """
    Genera XML → firma → envía → consulta autorización (con reintentos).
    Retorna dict: { success, estado, mensaje, numero_comprobante }
    """
    from apps.facturacion.models import ComprobanteElectronico
    from apps.facturacion.services.sri_service import SRIService

    comprobante = nota_credito.comprobante
    empresa     = comprobante.empresa
    sri         = SRIService(empresa)

    result = {
        'success': False,
        'estado': comprobante.estado,
        'mensaje': '',
        'numero_comprobante': comprobante.numero_comprobante,
    }

    try:
        # 1. Generar XML
        sri.generar_xml_nota_credito(nota_credito)

        # 2. Firmar
        if not empresa.certificado_digital:
            result['mensaje'] = 'NC generada en BORRADOR. Configure el certificado digital.'
            result['estado']  = ComprobanteElectronico.EstadoChoices.BORRADOR
            return result

        xml_firmado = sri.firmar_xml(comprobante.xml_generado)
        comprobante.xml_firmado = xml_firmado
        comprobante.estado      = ComprobanteElectronico.EstadoChoices.FIRMADO
        comprobante.save(update_fields=['xml_firmado', 'estado'])

        # 3. Enviar
        response = sri.enviar_comprobante_sri(comprobante)
        recibida = hasattr(response, 'estado') and response.estado == 'RECIBIDA'

        if recibida:
            comprobante.estado      = ComprobanteElectronico.EstadoChoices.ENVIADO
            comprobante.respuesta_sri = {'estado': response.estado}
            comprobante.save(update_fields=['estado', 'respuesta_sri'])

            # 4. Consulta inmediata de autorización (sin bloqueo)
            return _consultar_autorizacion_inmediata(sri, comprobante, result)

        else:
            mensajes = _extraer_mensajes_recepcion(response)
            mensaje_str = ' | '.join(mensajes)
            ya_registrada = '43' in mensaje_str or '70' in mensaje_str

            if ya_registrada:
                comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
                comprobante.save(update_fields=['estado'])
                result['success'] = True
                result['mensaje'] = 'Clave ya registrada en SRI. Autorización pendiente.'
            else:
                comprobante.estado = ComprobanteElectronico.EstadoChoices.RECHAZADO
                comprobante.mensajes_sri = '\n'.join(mensajes)
                comprobante.save(update_fields=['estado', 'mensajes_sri'])
                result['mensaje'] = mensaje_str or 'NC Rechazada en recepción SRI'

        result['estado'] = comprobante.estado

    except Exception as e:
        logger.exception("Error procesando NC %s", comprobante.numero_comprobante)
        result['mensaje'] = str(e)
        result['estado']  = comprobante.estado

    return result
