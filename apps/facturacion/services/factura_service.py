"""
Servicio de creación y procesamiento de Facturas electrónicas.
Convierte una Venta en una Factura + ComprobanteElectronico y orquesta el
envío al SRI (generar XML → firmar → enviar → consultar autorización).
"""
import logging
from decimal import Decimal
from django.db import transaction

logger = logging.getLogger(__name__)

# Mapeo FormaPago POS → código SRI
FORMA_PAGO_MAP = {
    'EFECTIVO': '01',
    'TARJETA_DEBITO': '16',
    'TARJETA_CREDITO': '19',
    'TRANSFERENCIA': '20',
    'CHEQUE': '21',
    'CREDITO': '20',
}

# Mapeo porcentaje_iva Producto → (tarifa Decimal, codigo_porcentaje SRI)
IVA_MAP = {
    '0': (Decimal('0.00'),  '0'),
    '2': (Decimal('12.00'), '2'),
    '4': (Decimal('15.00'), '4'),
    '6': (Decimal('0.00'),  '6'),
    '7': (Decimal('0.00'),  '7'),
}


@transaction.atomic
def crear_factura_desde_venta(venta):
    """
    Crea un ComprobanteElectronico + Factura + DetalleFactura a partir de una Venta.
    Vincula venta.factura al nuevo objeto y retorna la Factura creada.
    """
    from apps.facturacion.models import (
        Factura, DetalleFactura, ComprobanteElectronico, Secuencial,
    )

    empresa = venta.empresa
    estab = (empresa.establecimiento_codigo or '001').zfill(3)
    pemi  = (empresa.punto_emision_codigo  or '001').zfill(3)

    # Secuencial atómico
    secuencial_obj, _ = Secuencial.objects.get_or_create(
        empresa=empresa,
        tipo_comprobante='01',
        establecimiento=estab,
        punto_emision=pemi,
        defaults={'secuencial_actual': 0},
    )
    siguiente = secuencial_obj.get_siguiente()
    numero_comprobante = f"{estab}-{pemi}-{siguiente}"

    comprobante = ComprobanteElectronico.objects.create(
        empresa=empresa,
        usuario_creador=venta.usuario,
        tipo_comprobante='01',
        establecimiento=estab,
        punto_emision=pemi,
        secuencial=siguiente,
        numero_comprobante=numero_comprobante,
        fecha_emision=venta.fecha_venta,
        estado=ComprobanteElectronico.EstadoChoices.BORRADOR,
    )

    # Forma de pago SRI — usa el primer pago de la venta
    pago = venta.pagos.first()
    forma_pago_sri = FORMA_PAGO_MAP.get(pago.forma_pago, '20') if pago else '20'

    # Subtotales por tarifa
    sub_12 = Decimal(str(venta.subtotal_12)).quantize(Decimal('0.01'))
    sub_15 = Decimal(str(venta.subtotal_15)).quantize(Decimal('0.01'))

    factura = Factura.objects.create(
        comprobante=comprobante,
        cliente=venta.cliente,
        subtotal_sin_impuestos=Decimal(str(venta.subtotal)).quantize(Decimal('0.01')),
        subtotal_0=Decimal(str(venta.subtotal_0)).quantize(Decimal('0.01')),
        subtotal_12=sub_12,
        subtotal_15=sub_15,
        iva_12=(sub_12 * Decimal('0.12')).quantize(Decimal('0.01')),
        iva_15=(sub_15 * Decimal('0.15')).quantize(Decimal('0.01')),
        total_descuento=Decimal(str(venta.descuento)).quantize(Decimal('0.01')),
        total=Decimal(str(venta.total)).quantize(Decimal('0.01')),
        forma_pago=forma_pago_sri,
        observaciones=venta.observaciones,
    )

    # Detalles
    for dv in venta.detalles.all():
        producto = dv.producto
        pct = getattr(producto, 'porcentaje_iva', '2') if producto else '2'
        tarifa, codigo_porcentaje = IVA_MAP.get(str(pct), (Decimal('15.00'), '4'))
        base    = Decimal(str(dv.subtotal)).quantize(Decimal('0.01'))
        iva_val = (base * tarifa / 100).quantize(Decimal('0.01'))

        DetalleFactura.objects.create(
            factura=factura,
            producto=producto,
            codigo_principal=producto.codigo_principal if producto else 'SIN-COD',
            descripcion=producto.nombre if producto else 'Ítem',
            cantidad=dv.cantidad,
            precio_unitario=dv.precio_unitario,
            descuento=dv.descuento,
            precio_total_sin_impuesto=base,
            tarifa=tarifa,
            codigo_porcentaje=codigo_porcentaje,
            valor_impuesto=iva_val,
        )

    # Vincular venta → factura
    venta.factura = factura
    venta.save(update_fields=['factura'])

    return factura


def procesar_factura_sri(factura):
    """
    Orquesta el flujo completo hacia el SRI:
      1. Generar XML
      2. Firmar con certificado digital (.p12)
      3. Enviar al SRI (recepción)
      4. Consultar autorización

    Si la empresa no tiene certificado, deja la factura en BORRADOR con XML generado.
    Retorna un dict: { success, estado, mensaje }
    """
    import time
    from apps.facturacion.models import ComprobanteElectronico
    from apps.facturacion.services.sri_service import SRIService

    comprobante = factura.comprobante
    empresa = comprobante.empresa
    sri = SRIService(empresa)
    result = {
        'success': False,
        'estado': comprobante.estado,
        'mensaje': '',
        'numero_comprobante': comprobante.numero_comprobante,
    }

    # Si ya está autorizada no hay nada que hacer
    if comprobante.estado == ComprobanteElectronico.EstadoChoices.AUTORIZADO:
        result['success'] = True
        result['mensaje'] = f"Ya autorizada: {comprobante.numero_autorizacion}"
        return result

    try:
        # 1. Generar XML
        sri.generar_xml_factura(factura)

        # 2. Firmar — requiere certificado digital
        if not empresa.certificado_digital:
            result['mensaje'] = (
                'XML generado en estado BORRADOR. '
                'Configure el certificado digital en Configuración → Firma Digital para enviar al SRI.'
            )
            result['estado'] = ComprobanteElectronico.EstadoChoices.BORRADOR
            return result

        xml_firmado = sri.firmar_xml(comprobante.xml_generado)
        comprobante.xml_firmado = xml_firmado
        comprobante.estado = ComprobanteElectronico.EstadoChoices.FIRMADO
        comprobante.save(update_fields=['xml_firmado', 'estado'])

        # 3. Enviar al SRI
        response = sri.enviar_comprobante_sri(comprobante)

        recibida = (
            hasattr(response, 'estado') and response.estado == 'RECIBIDA'
        )
        if recibida:
            comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
            comprobante.respuesta_sri = {'estado': response.estado}
            comprobante.save(update_fields=['estado', 'respuesta_sri'])

            # 4. Consultar autorización con reintentos (SRI puede tardar varios segundos)
            _MAX_RETRIES = 6
            _RETRY_DELAY = 5  # segundos entre intentos
            aut_obj = None
            for attempt in range(_MAX_RETRIES):
                if attempt > 0:
                    time.sleep(_RETRY_DELAY)
                auth = sri.autorizar_comprobante_sri(comprobante.clave_acceso)
                if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                    aut_obj = auth.autorizaciones.autorizacion[0]
                    if aut_obj.estado in ('AUTORIZADO', 'NO_AUTORIZADO'):
                        break
                    aut_obj = None  # estado transitorio, reintentar
            else:
                # Agotados todos los intentos sin resolución → tarea periódica lo recogerá
                result['success'] = True
                result['mensaje'] = 'Enviado al SRI. Autorización pendiente (se actualizará automáticamente).'
                result['estado'] = comprobante.estado
                return result

            if aut_obj and aut_obj.estado == 'AUTORIZADO':
                comprobante.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                comprobante.numero_autorizacion = getattr(aut_obj, 'numeroAutorizacion', '')
                comprobante.fecha_autorizacion  = getattr(aut_obj, 'fechaAutorizacion', None)
                comprobante.mensajes_sri = ''  # limpiar errores de intentos anteriores
                result['success'] = True
                result['mensaje'] = f"Autorizada: {comprobante.numero_autorizacion}"
            else:
                comprobante.estado = ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO
                mensajes = _extraer_mensajes_autorizacion(aut_obj) if aut_obj else []
                comprobante.mensajes_sri = '\n'.join(mensajes)
                result['mensaje'] = ' | '.join(mensajes) or 'No autorizado por el SRI'

            comprobante.save()

            # 5. Enviar email al cliente si quedó autorizada
            if comprobante.estado == ComprobanteElectronico.EstadoChoices.AUTORIZADO:
                try:
                    _enviar_factura_email(factura)
                except Exception as email_err:
                    logger.warning("No se pudo enviar email de factura %s: %s", comprobante.numero_comprobante, email_err)

        else:
            # Recepción no aceptada — revisar si es error 43 (ya registrada = consultar autorización)
            mensajes = _extraer_mensajes_recepcion(response)
            mensaje_str = ' | '.join(mensajes)
            ya_registrada = any(
                getattr(m, 'identificador', None) in ('43', '70') or
                str(getattr(m, 'identificador', '')) in ('43', '70')
                for m in (getattr(response, 'comprobantes', None) and
                           getattr(response.comprobantes, 'comprobante', []) or [])
            ) or '43' in mensaje_str or '70' in mensaje_str

            if ya_registrada:
                # Error 43: la clave ya fue registrada — consultar directamente autorización
                comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
                comprobante.save(update_fields=['estado'])
                auth = sri.autorizar_comprobante_sri(comprobante.clave_acceso)
                if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                    aut = auth.autorizaciones.autorizacion[0]
                    if aut.estado == 'AUTORIZADO':
                        comprobante.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                        comprobante.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
                        comprobante.fecha_autorizacion  = getattr(aut, 'fechaAutorizacion', None)
                        comprobante.mensajes_sri = ''
                        comprobante.save()
                        result['success'] = True
                        result['mensaje'] = f"Autorizada: {comprobante.numero_autorizacion}"
                        result['estado'] = comprobante.estado
                        return result
                # Si aún no está autorizada, dejar como ENVIADO para que la tarea periódica la recoja
                result['success'] = True
                result['mensaje'] = 'Clave ya registrada en SRI. Autorización pendiente.'
                result['estado'] = comprobante.estado
                return result
            else:
                comprobante.estado = ComprobanteElectronico.EstadoChoices.RECHAZADO
                comprobante.mensajes_sri = mensaje_str
                comprobante.save(update_fields=['estado', 'mensajes_sri'])
                result['mensaje'] = mensaje_str or 'Rechazado por el SRI en recepción'

        result['estado'] = comprobante.estado

    except Exception as e:
        result['mensaje'] = str(e)
        result['estado'] = comprobante.estado

    return result


# ─── Helpers privados ──────────────────────────────────────────────────────────

def _extraer_mensajes_autorizacion(autorizacion):
    mensajes = []
    if hasattr(autorizacion, 'mensajes') and autorizacion.mensajes:
        for m in autorizacion.mensajes.mensaje:
            tipo = getattr(m, 'tipo', '')
            msg  = getattr(m, 'mensaje', '')
            info = getattr(m, 'informacionAdicional', '') or ''
            mensajes.append(f"{tipo}: {msg}" + (f" ({info})" if info else ""))
    return mensajes


def _extraer_mensajes_recepcion(response):
    mensajes = []
    if hasattr(response, 'comprobantes') and response.comprobantes:
        for comp in response.comprobantes.comprobante:
            if hasattr(comp, 'mensajes') and comp.mensajes:
                for m in comp.mensajes.mensaje:
                    mensajes.append(
                        f"{getattr(m, 'identificador', '')}: {getattr(m, 'mensaje', '')}"
                    )
    return mensajes


def _enviar_factura_email(factura):
    """
    Envía la factura autorizada al correo del cliente adjuntando el XML firmado y el RIDE PDF.
    No lanza excepción si el cliente no tiene email — simplemente hace log y retorna.
    """
    from django.core.mail import EmailMessage
    from django.conf import settings
    from apps.facturacion.services.ride_service import generar_ride_pdf

    cliente = factura.cliente
    destino = cliente.email
    if not destino:
        logger.info("Cliente %s sin email — factura %s no enviada por correo",
                    cliente.identificacion, factura.comprobante.numero_comprobante)
        return

    comp       = factura.comprobante
    empresa    = comp.empresa
    num_doc    = comp.numero_comprobante
    num_aut    = comp.numero_autorizacion
    remitente  = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@localhost')

    asunto = f"Factura Electrónica {num_doc} — {empresa.razon_social}"
    cuerpo = (
        f"Estimado/a {cliente.razon_social},\n\n"
        f"Adjunto encontrará su factura electrónica:\n"
        f"  • Número: {num_doc}\n"
        f"  • Autorización SRI: {num_aut}\n\n"
        f"Se adjuntan el comprobante en formato XML y el RIDE (PDF).\n\n"
        f"Saludos,\n{empresa.razon_social}"
    )

    email = EmailMessage(
        subject=asunto,
        body=cuerpo,
        from_email=remitente,
        to=[destino],
    )
    # Adjuntar XML firmado
    xml_bytes = comp.xml_firmado.encode('utf-8') if comp.xml_firmado else b''
    if xml_bytes:
        email.attach(f"{num_doc}.xml", xml_bytes, 'application/xml')

    # Adjuntar RIDE PDF
    try:
        pdf_bytes = generar_ride_pdf(factura)
        email.attach(f"RIDE-{num_doc}.pdf", pdf_bytes, 'application/pdf')
    except Exception as ride_err:
        logger.warning("No se pudo generar RIDE para email de %s: %s", num_doc, ride_err)

    email.send(fail_silently=False)
    logger.info("Factura %s enviada por email a %s", num_doc, destino)

