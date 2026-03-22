"""
Servicio de creación y procesamiento de Facturas electrónicas.
Convierte una Venta en una Factura + ComprobanteElectronico y orquesta el
envío al SRI (generar XML → firmar → enviar → consultar autorización).
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

LIMITE_CONSUMIDOR_FINAL = Decimal('50.00')

MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE = (
    'No se puede emitir factura electronica SRI a CONSUMIDOR FINAL por montos mayores a 50. '
    'Registre la venta sin factura o seleccione un cliente identificado con cedula, RUC, '
    'pasaporte o identificacion del exterior.'
)


def cliente_es_consumidor_final(cliente):
    if not cliente:
        return False
    return (
        getattr(cliente, 'tipo_identificacion', '') == '07'
        or str(getattr(cliente, 'identificacion', '')).strip() == '9999999999999'
        or str(getattr(cliente, 'razon_social', '')).strip().upper() == 'CONSUMIDOR FINAL'
    )


def cliente_consumidor_final_supera_limite(cliente, total):
    if not cliente_es_consumidor_final(cliente):
        return False
    return Decimal(str(total or '0')) > LIMITE_CONSUMIDOR_FINAL


def _crear_notificacion(empresa, tipo, titulo, mensaje, url=''):
    """Crea una notificación en-app para la empresa (falla silenciosa)."""
    try:
        from apps.empresas.models import Notificacion
        Notificacion.objects.create(
            empresa=empresa,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            url=url,
        )
    except Exception as e:
        logger.warning("No se pudo crear notificación para empresa %s: %s", empresa.id, e)

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


def _consultar_autorizacion_inmediata(sri, comprobante, result):
    """
    Intenta una consulta de autorización inmediata (sin sleep).
    Si el SRI responde, actualiza el comprobante.
    Si no, deja el estado ENVIADO para que Celery lo resuelva.
    Retorna el result dict actualizado.
    """
    from apps.facturacion.models import ComprobanteElectronico
    aut_obj = None
    try:
        auth = sri.autorizar_comprobante_sri(comprobante.clave_acceso)
        if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
            aut_obj = auth.autorizaciones.autorizacion[0]
            if aut_obj.estado not in ('AUTORIZADO', 'NO_AUTORIZADO'):
                aut_obj = None
    except Exception as exc:
        logger.warning("Consulta autorización inmediata falló para %s: %s", comprobante.clave_acceso, exc)

    if not aut_obj:
        result['success'] = True
        result['mensaje'] = 'Enviado al SRI. Autorización pendiente (se actualizará automáticamente en segundos).'
        result['estado'] = comprobante.estado
        return result

    if aut_obj.estado == 'AUTORIZADO':
        comprobante.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
        comprobante.numero_autorizacion = getattr(aut_obj, 'numeroAutorizacion', '')
        comprobante.fecha_autorizacion = getattr(aut_obj, 'fechaAutorizacion', None)
        comprobante.mensajes_sri = ''
        result['success'] = True
        result['mensaje'] = f"Autorizada: {comprobante.numero_autorizacion}"
    else:
        comprobante.estado = ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO
        mensajes = _extraer_mensajes_autorizacion(aut_obj) if aut_obj else []
        comprobante.mensajes_sri = '\n'.join(mensajes)
        result['mensaje'] = ' | '.join(mensajes) or 'No autorizado por el SRI'

    comprobante.save()
    return result


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
    sub_0 = Decimal(str(venta.subtotal_0)).quantize(Decimal('0.01'))
    sub_12 = Decimal(str(venta.subtotal_12)).quantize(Decimal('0.01'))
    sub_15 = Decimal(str(venta.subtotal_15)).quantize(Decimal('0.01'))
    iva_12 = Decimal('0.00')
    iva_15 = Decimal('0.00')

    factura = Factura.objects.create(
        comprobante=comprobante,
        cliente=venta.cliente,
        subtotal_sin_impuestos=Decimal(str(venta.subtotal)).quantize(Decimal('0.01')),
        subtotal_0=sub_0,
        subtotal_12=sub_12,
        subtotal_15=sub_15,
        iva_12=Decimal('0.00'),
        iva_15=Decimal('0.00'),
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
        if codigo_porcentaje == '2':
            iva_12 += iva_val
        elif codigo_porcentaje == '4':
            iva_15 += iva_val

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

    factura.iva_12 = iva_12.quantize(Decimal('0.01'))
    factura.iva_15 = iva_15.quantize(Decimal('0.01'))
    factura.save(update_fields=['iva_12', 'iva_15'])

    # Vincular venta → factura
    venta.factura = factura
    venta.save(update_fields=['factura'])

    # Incrementar contador en la suscripción activa de la empresa
    try:
        suscripcion = venta.empresa.suscripciones.exclude(estado='CANCELADA').order_by('-fecha_inicio').first()
        if suscripcion:
            suscripcion.incrementar_contador_facturas()
    except Exception:
        pass  # No debe bloquear la facturación

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

    if cliente_consumidor_final_supera_limite(factura.cliente, factura.total):
        result['mensaje'] = MENSAJE_CLIENTE_CONSUMIDOR_FINAL_SUPERA_LIMITE
        return result

    # Si ya está autorizada no hay nada que hacer
    if comprobante.estado == ComprobanteElectronico.EstadoChoices.AUTORIZADO:
        result['success'] = True
        result['mensaje'] = f"Ya autorizada: {comprobante.numero_autorizacion}"
        return result

    # Si el comprobante fue rechazado o no autorizado, se reinicia el artefacto
    # XML/firma para forzar una regeneración completa en el reproceso.
    if comprobante.estado in (
        ComprobanteElectronico.EstadoChoices.RECHAZADO,
        ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO,
    ):
        comprobante.xml_generado = ''
        comprobante.xml_firmado = ''
        comprobante.mensajes_sri = ''
        comprobante.respuesta_sri = None
        comprobante.estado = ComprobanteElectronico.EstadoChoices.BORRADOR
        comprobante.save(update_fields=[
            'xml_generado',
            'xml_firmado',
            'mensajes_sri',
            'respuesta_sri',
            'estado',
        ])
        result['estado'] = comprobante.estado

    # ── Regla SRI: la fecha del comprobante debe ser la del día de envío ──────
    # Si la fecha de emisión es de un día anterior, actualizarla a hoy antes
    # de regenerar el XML, porque el SRI rechaza comprobantes con fecha pasada.
    today = timezone.localdate()
    fecha_emision_local = timezone.localtime(comprobante.fecha_emision).date()
    if fecha_emision_local < today:
        from datetime import datetime, time as dt_time
        tz = timezone.get_current_timezone()
        nueva_fecha = timezone.make_aware(
            datetime.combine(today, dt_time(0, 0, 0)), tz
        )
        comprobante.fecha_emision = nueva_fecha
        comprobante.clave_acceso  = ''  # forzar regeneración con nueva fecha
        comprobante.save(update_fields=['fecha_emision', 'clave_acceso'])
        logger.info(
            "Comprobante %s: fecha_emision actualizada a %s por regla SRI",
            comprobante.numero_comprobante, today,
        )

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

            # 4. Primer intento rápido de autorización (sin sleep)
            aut_obj = None
            auth = sri.autorizar_comprobante_sri(comprobante.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut_obj = auth.autorizaciones.autorizacion[0]
                if aut_obj.estado not in ('AUTORIZADO', 'NO_AUTORIZADO'):
                    aut_obj = None  # estado transitorio

            if not aut_obj:
                # SRI aún no resolvió → delegar al poller periódico de Celery.
                # NO bloqueamos el worker con time.sleep().
                result['success'] = True
                result['mensaje'] = 'Enviado al SRI. Autorización pendiente (se actualizará automáticamente en segundos).'
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
                _crear_notificacion(
                    empresa,
                    tipo='ERROR',
                    titulo=f'Factura no autorizada: {comprobante.numero_comprobante}',
                    mensaje=result['mensaje'],
                    url='/facturacion',
                )

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
                _crear_notificacion(
                    empresa,
                    tipo='ERROR',
                    titulo=f'Factura rechazada: {comprobante.numero_comprobante}',
                    mensaje=result['mensaje'],
                    url='/facturacion',
                )

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
    Usa la API HTTP de ZeptoMail (puerto 443) para evitar el bloqueo SMTP de Railway.
    No lanza excepción si el cliente no tiene email.
    """
    import base64
    import requests as http_requests
    from django.conf import settings
    from apps.facturacion.services.ride_service import generar_ride_pdf

    cliente = factura.cliente
    destino = cliente.email
    if not destino:
        logger.info("Cliente %s sin email — factura %s no enviada por correo",
                    cliente.identificacion, factura.comprobante.numero_comprobante)
        return

    comp    = factura.comprobante
    empresa = comp.empresa
    num_doc = comp.numero_comprobante
    num_aut = comp.numero_autorizacion

    resend_key = getattr(settings, 'RESEND_API_KEY', None)
    from_email  = getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@of1solutions.com')

    asunto = f"Factura Electrónica {num_doc} — {empresa.razon_social}"
    cuerpo = (
        f"Estimado/a {cliente.razon_social},\n\n"
        f"Adjunto encontrará su factura electrónica:\n"
        f"  • Número: {num_doc}\n"
        f"  • Autorización SRI: {num_aut}\n\n"
        f"Se adjuntan el comprobante en formato XML y el RIDE (PDF).\n\n"
        f"Saludos,\n{empresa.razon_social}"
    )

    attachments = []

    # Adjuntar XML firmado
    xml_bytes = comp.xml_firmado.encode('utf-8') if comp.xml_firmado else b''
    if xml_bytes:
        attachments.append({
            "filename": f"{num_doc}.xml",
            "content": base64.b64encode(xml_bytes).decode('utf-8'),
        })

    # Adjuntar RIDE PDF
    try:
        pdf_bytes = generar_ride_pdf(factura)
        attachments.append({
            "filename": f"RIDE-{num_doc}.pdf",
            "content": base64.b64encode(pdf_bytes).decode('utf-8'),
        })
    except Exception as ride_err:
        logger.warning("No se pudo generar RIDE para email de %s: %s", num_doc, ride_err)

    payload = {
        "from": f"{empresa.razon_social or 'OF1 Solutions'} <{from_email}>",
        "to": [destino],
        "subject": asunto,
        "text": cuerpo,
    }
    if attachments:
        payload["attachments"] = attachments

    resp = http_requests.post(
        'https://api.resend.com/emails',
        json=payload,
        headers={
            'Authorization': f'Bearer {resend_key}',
            'Content-Type': 'application/json',
        },
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        logger.error("Resend error enviando factura %s: %s %s", num_doc, resp.status_code, resp.text)
        raise Exception(f"Resend {resp.status_code}: {resp.text}")

    logger.info("Factura %s enviada por email a %s", num_doc, destino)


# ─── Retención en la fuente ────────────────────────────────────────────────────

@transaction.atomic
def crear_retencion(empresa, usuario, proveedor, periodo_fiscal, impuestos_data, fecha_emision=None):
    """
    Crea un ComprobanteElectronico + Retencion + ImpuestoRetencion.
    impuestos_data: lista de dicts con claves:
      codigo, codigo_porcentaje, tarifa, base_imponible,
      cod_doc_sustento, num_doc_sustento, fecha_emision_doc_sustento
    Retorna la Retencion creada.
    """
    from apps.facturacion.models import (
        ComprobanteElectronico, Secuencial, Retencion, ImpuestoRetencion,
    )
    from decimal import Decimal as _D
    from django.utils import timezone as tz

    estab = (empresa.establecimiento_codigo or '001').zfill(3)
    pemi  = (empresa.punto_emision_codigo  or '001').zfill(3)

    secuencial_obj, _ = Secuencial.objects.get_or_create(
        empresa=empresa,
        tipo_comprobante='07',
        establecimiento=estab,
        punto_emision=pemi,
        defaults={'secuencial_actual': 0},
    )
    siguiente = secuencial_obj.get_siguiente()
    numero_comprobante = f"{estab}-{pemi}-{siguiente}"
    fecha = fecha_emision or tz.now()

    comprobante = ComprobanteElectronico.objects.create(
        empresa=empresa,
        usuario_creador=usuario,
        tipo_comprobante='07',
        establecimiento=estab,
        punto_emision=pemi,
        secuencial=siguiente,
        numero_comprobante=numero_comprobante,
        fecha_emision=fecha,
        estado=ComprobanteElectronico.EstadoChoices.BORRADOR,
    )

    retencion = Retencion.objects.create(
        comprobante=comprobante,
        proveedor=proveedor,
        periodo_fiscal=periodo_fiscal,
    )

    for imp in impuestos_data:
        base = _D(str(imp['base_imponible']))
        tarifa = _D(str(imp['tarifa']))
        valor_retenido = (base * tarifa / 100).quantize(_D('0.01'))
        ImpuestoRetencion.objects.create(
            retencion=retencion,
            codigo=imp['codigo'],
            codigo_porcentaje=str(imp['codigo_porcentaje']),
            tarifa=tarifa,
            base_imponible=base,
            valor_retenido=valor_retenido,
            cod_doc_sustento=imp.get('cod_doc_sustento', '01'),
            num_doc_sustento=imp['num_doc_sustento'],
            fecha_emision_doc_sustento=imp['fecha_emision_doc_sustento'],
        )

    return retencion


def procesar_retencion_sri(retencion):
    """
    Genera XML, firma y envía la retención al SRI.
    Misma lógica que procesar_factura_sri.
    """
    from apps.facturacion.models import ComprobanteElectronico
    from apps.facturacion.services.sri_service import SRIService

    comprobante = retencion.comprobante
    empresa = comprobante.empresa
    sri = SRIService(empresa)
    result = {
        'success': False,
        'estado': comprobante.estado,
        'mensaje': '',
        'numero_comprobante': comprobante.numero_comprobante,
    }

    if comprobante.estado == ComprobanteElectronico.EstadoChoices.AUTORIZADO:
        result['success'] = True
        result['mensaje'] = f"Ya autorizada: {comprobante.numero_autorizacion}"
        return result

    try:
        sri.generar_xml_retencion(retencion)

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

        response = sri.enviar_comprobante_sri(comprobante)
        recibida = hasattr(response, 'estado') and response.estado == 'RECIBIDA'

        if recibida:
            comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
            comprobante.respuesta_sri = {'estado': response.estado}
            comprobante.save(update_fields=['estado', 'respuesta_sri'])

            result = _consultar_autorizacion_inmediata(sri, comprobante, result)
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
                comprobante.mensajes_sri = mensaje_str
                comprobante.save(update_fields=['estado', 'mensajes_sri'])
                result['mensaje'] = mensaje_str or 'Rechazado por el SRI'

        result['estado'] = comprobante.estado

    except Exception as e:
        result['mensaje'] = str(e)
        result['estado'] = comprobante.estado

    return result


# ─── Guía de Remisión ─────────────────────────────────────────────────────────

@transaction.atomic
def crear_guia_remision(
    empresa, usuario,
    ruc_transportista, razon_social_transportista, placa,
    fecha_inicio_transporte, fecha_fin_transporte, dir_partida,
    destinatarios_data,
    fecha_emision=None,
):
    """
    Crea un ComprobanteElectronico tipo '06' + GuiaRemision + DestinatarioGuia + DetalleGuiaRemision.
    destinatarios_data: lista de dicts con claves:
        identificacion_destinatario, razon_social_destinatario, dir_dest_destinatario,
        motorista_y_ca, ruta, cod_doc_sustento, num_doc_sustento,
        fecha_emision_doc_sust, num_autorizacion_doc_sust,
        detalles_input: [{ codigo_interno, descripcion, cantidad }]
    """
    from apps.facturacion.models import (
        ComprobanteElectronico, GuiaRemision,
        DestinatarioGuia, DetalleGuiaRemision, Secuencial,
    )
    from decimal import Decimal

    if not empresa:
        raise ValueError('No hay empresa configurada.')

    # ── Secuencial ────────────────────────────────────────────────────────────
    secuencial_obj, _ = Secuencial.objects.get_or_create(
        empresa=empresa,
        tipo_comprobante='06',
        establecimiento=empresa.establecimiento_codigo,
        punto_emision=empresa.punto_emision_codigo,
        defaults={'secuencial_actual': 0},
    )
    siguiente = secuencial_obj.get_siguiente()
    numero_comprobante = (
        f"{empresa.establecimiento_codigo}-"
        f"{empresa.punto_emision_codigo}-"
        f"{siguiente}"
    )

    # ── ComprobanteElectronico ────────────────────────────────────────────────
    if fecha_emision is None:
        from django.utils import timezone
        fecha_emision = timezone.now()

    comprobante = ComprobanteElectronico.objects.create(
        empresa=empresa,
        usuario_creador=usuario,
        tipo_comprobante='06',
        establecimiento=empresa.establecimiento_codigo,
        punto_emision=empresa.punto_emision_codigo,
        secuencial=siguiente,
        numero_comprobante=numero_comprobante,
        fecha_emision=fecha_emision,
        estado=ComprobanteElectronico.EstadoChoices.BORRADOR,
    )

    # ── GuiaRemision ──────────────────────────────────────────────────────────
    guia = GuiaRemision.objects.create(
        comprobante=comprobante,
        ruc_transportista=ruc_transportista,
        razon_social_transportista=razon_social_transportista,
        placa=placa,
        fecha_inicio_transporte=fecha_inicio_transporte,
        fecha_fin_transporte=fecha_fin_transporte,
        dir_partida=dir_partida,
    )

    # ── Destinatarios y detalles ──────────────────────────────────────────────
    for dest_data in destinatarios_data:
        detalles_input = dest_data.pop('detalles_input', [])
        dest = DestinatarioGuia.objects.create(guia=guia, **dest_data)
        for item in detalles_input:
            DetalleGuiaRemision.objects.create(
                destinatario=dest,
                codigo_interno=item.get('codigo_interno', 'SIN-COD'),
                descripcion=item.get('descripcion', ''),
                cantidad=Decimal(str(item.get('cantidad', 1))),
            )

    return guia


def procesar_guia_remision_sri(guia):
    """
    Genera XML, firma y envía la guía de remisión al SRI.
    """
    from apps.facturacion.models import ComprobanteElectronico
    from apps.facturacion.services.sri_service import SRIService

    comprobante = guia.comprobante
    empresa = comprobante.empresa
    sri = SRIService(empresa)
    result = {
        'success': False,
        'estado': comprobante.estado,
        'mensaje': '',
        'numero_comprobante': comprobante.numero_comprobante,
    }

    if comprobante.estado == ComprobanteElectronico.EstadoChoices.AUTORIZADO:
        result['success'] = True
        result['mensaje'] = f"Ya autorizada: {comprobante.numero_autorizacion}"
        return result

    try:
        sri.generar_xml_guia_remision(guia)

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

        response = sri.enviar_comprobante_sri(comprobante)
        recibida = hasattr(response, 'estado') and response.estado == 'RECIBIDA'

        if recibida:
            comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
            comprobante.respuesta_sri = {'estado': response.estado}
            comprobante.save(update_fields=['estado', 'respuesta_sri'])

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
                comprobante.mensajes_sri = mensaje_str
                comprobante.save(update_fields=['estado', 'mensajes_sri'])
                result['mensaje'] = mensaje_str or 'Rechazado por el SRI'

        result['estado'] = comprobante.estado

    except Exception as e:
        result['mensaje'] = str(e)
        result['estado'] = comprobante.estado

    return result


# ─── Nota de Débito ───────────────────────────────────────────────────────────

@transaction.atomic
def crear_nota_debito(
    empresa, usuario,
    cliente, motivo,
    detalles_data,
    factura_origen=None,
    fecha_emision=None,
):
    """
    Crea ComprobanteElectronico tipo '05' + NotaDebito + DetalleNotaDebito.
    detalles_data: lista de dicts con { razon, valor, aplica_iva (bool, optional) }
    """
    from apps.facturacion.models import (
        ComprobanteElectronico, NotaDebito, DetalleNotaDebito, Secuencial,
    )
    from decimal import Decimal

    if not empresa:
        raise ValueError('No hay empresa configurada.')

    secuencial_obj, _ = Secuencial.objects.get_or_create(
        empresa=empresa,
        tipo_comprobante='05',
        establecimiento=empresa.establecimiento_codigo,
        punto_emision=empresa.punto_emision_codigo,
        defaults={'secuencial_actual': 0},
    )
    siguiente = secuencial_obj.get_siguiente()
    numero_comprobante = (
        f"{empresa.establecimiento_codigo}-"
        f"{empresa.punto_emision_codigo}-"
        f"{siguiente}"
    )

    # ── ComprobanteElectronico ────────────────────────────────────────────────
    if fecha_emision is None:
        from django.utils import timezone
        fecha_emision = timezone.now()

    comprobante = ComprobanteElectronico.objects.create(
        empresa=empresa,
        usuario_creador=usuario,
        tipo_comprobante='05',
        establecimiento=empresa.establecimiento_codigo,
        punto_emision=empresa.punto_emision_codigo,
        secuencial=siguiente,
        numero_comprobante=numero_comprobante,
        fecha_emision=fecha_emision,
        estado=ComprobanteElectronico.EstadoChoices.BORRADOR,
    )

    # ── Cálculo de totales ────────────────────────────────────────────────────
    subtotal = Decimal('0.00')
    iva_total = Decimal('0.00')
    IVA_TARIFA = Decimal('15.00')

    for item in detalles_data:
        valor = Decimal(str(item.get('valor', '0')))
        subtotal += valor
        if item.get('aplica_iva', False):
            iva_total += (valor * IVA_TARIFA / Decimal('100')).quantize(Decimal('0.01'))

    total = subtotal + iva_total

    # ── NotaDebito ────────────────────────────────────────────────────────────
    nota = NotaDebito.objects.create(
        comprobante=comprobante,
        cliente=cliente,
        factura_origen=factura_origen,
        motivo=motivo,
        subtotal_sin_impuestos=subtotal,
        total=total,
    )

    # ── DetalleNotaDebito ─────────────────────────────────────────────────────
    for item in detalles_data:
        valor = Decimal(str(item.get('valor', '0')))
        aplica_iva = item.get('aplica_iva', False)
        valor_impuesto = (
            (valor * IVA_TARIFA / Decimal('100')).quantize(Decimal('0.01'))
            if aplica_iva else Decimal('0.00')
        )
        DetalleNotaDebito.objects.create(
            nota_debito=nota,
            razon=item.get('razon', ''),
            valor=valor,
            codigo_impuesto='2',
            codigo_porcentaje='4' if aplica_iva else '0',
            tarifa=IVA_TARIFA if aplica_iva else Decimal('0'),
            valor_impuesto=valor_impuesto,
        )

    return nota


def procesar_nota_debito_sri(nota):
    """
    Genera XML, firma y envía la nota de débito al SRI.
    """
    from apps.facturacion.models import ComprobanteElectronico
    from apps.facturacion.services.sri_service import SRIService

    comprobante = nota.comprobante
    empresa = comprobante.empresa
    sri = SRIService(empresa)
    result = {
        'success': False,
        'estado': comprobante.estado,
        'mensaje': '',
        'numero_comprobante': comprobante.numero_comprobante,
    }

    if comprobante.estado == ComprobanteElectronico.EstadoChoices.AUTORIZADO:
        result['success'] = True
        result['mensaje'] = f"Ya autorizada: {comprobante.numero_autorizacion}"
        return result

    try:
        sri.generar_xml_nota_debito(nota)

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

        response = sri.enviar_comprobante_sri(comprobante)
        recibida = hasattr(response, 'estado') and response.estado == 'RECIBIDA'

        if recibida:
            comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
            comprobante.respuesta_sri = {'estado': response.estado}
            comprobante.save(update_fields=['estado', 'respuesta_sri'])

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
                comprobante.mensajes_sri = mensaje_str
                comprobante.save(update_fields=['estado', 'mensajes_sri'])
                result['mensaje'] = mensaje_str or 'Rechazado por el SRI'

        result['estado'] = comprobante.estado

    except Exception as e:
        result['mensaje'] = str(e)
        result['estado'] = comprobante.estado

    return result
