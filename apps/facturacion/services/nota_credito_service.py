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


def _enviar_nota_credito_email(nota_credito):
    """
    Envia la Nota de Credito autorizada al correo del cliente con XML firmado y RIDE PDF.
    """
    from django.conf import settings
    from django.core.mail import EmailMessage
    from apps.facturacion.services.ride_service import generar_ride_nota_credito_pdf

    factura = nota_credito.factura_origen
    cliente = factura.cliente
    destino = getattr(cliente, 'email', None)
    comp = nota_credito.comprobante

    if not destino:
        logger.info(
            "Cliente %s sin email - NC %s no enviada por correo",
            getattr(cliente, 'identificacion', ''),
            comp.numero_comprobante,
        )
        return {'enviado': False, 'mensaje': 'El cliente no tiene email registrado.'}

    empresa = comp.empresa
    num_doc = comp.numero_comprobante
    num_aut = comp.numero_autorizacion or ''
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@of1solutions.com')

    asunto = f"Nota de Credito Electronica {num_doc} - {empresa.razon_social}"
    cuerpo = (
        f"Estimado/a {cliente.razon_social},\n\n"
        f"Adjunto encontrará su nota de credito electronica:\n"
        f"  - Numero: {num_doc}\n"
        f"  - Factura modificada: {factura.comprobante.numero_comprobante}\n"
        f"  - Autorizacion SRI: {num_aut}\n"
        f"  - Motivo: {nota_credito.motivo}\n\n"
        f"Se adjuntan el comprobante en formato XML y el RIDE (PDF).\n\n"
        f"Saludos,\n{empresa.razon_social}"
    )

    email = EmailMessage(subject=asunto, body=cuerpo, from_email=from_email, to=[destino])

    if comp.xml_firmado:
        email.attach(f"{num_doc}.xml", comp.xml_firmado.encode('utf-8'), "application/xml")

    try:
        pdf_bytes = generar_ride_nota_credito_pdf(nota_credito)
        email.attach(f"RIDE-NC-{num_doc}.pdf", pdf_bytes, "application/pdf")
    except Exception as ride_err:
        logger.warning("No se pudo generar RIDE para email de NC %s: %s", num_doc, ride_err)

    try:
        email.send(fail_silently=False)
    except Exception as email_err:
        logger.warning("No se pudo enviar email de NC %s: %s", num_doc, email_err)
        return {
            'enviado': False,
            'mensaje': f'No se pudo enviar el email: {email_err}',
        }

    logger.info("Nota de Credito %s enviada por email a %s", num_doc, destino)
    return {'enviado': True, 'mensaje': f'Email enviado a {destino}'}


def finalizar_nota_credito_autorizada(nota_credito, usuario=None, enviar_email=True):
    """
    Aplica los efectos locales de una NC ya AUTORIZADA.
    Idempotente: puede ejecutarse si el SRI autorizo la NC pero la factura quedo AUTORIZADA.
    """
    from apps.facturacion.models import ComprobanteElectronico
    from apps.facturacion.services.anulacion_service import aplicar_anulacion_factura_autorizada

    comp = nota_credito.comprobante
    if comp.estado != ComprobanteElectronico.EstadoChoices.AUTORIZADO:
        return {
            'finalizada': False,
            'mensaje': f'La Nota de Credito no esta AUTORIZADA. Estado actual: {comp.estado}',
        }

    reversal = aplicar_anulacion_factura_autorizada(
        nota_credito.factura_origen,
        nota_credito,
        usuario=usuario,
    )
    result = {
        'finalizada': True,
        'reversion_financiera': reversal,
    }

    if enviar_email:
        try:
            result['email'] = _enviar_nota_credito_email(nota_credito)
        except Exception as email_err:
            logger.warning(
                "No se pudo enviar email de NC %s: %s",
                comp.numero_comprobante,
                email_err,
            )
            result['email'] = {
                'enviado': False,
                'mensaje': f'No se pudo enviar el email: {email_err}',
            }

    return result
