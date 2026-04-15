"""
Tareas automáticas de Celery para facturación
"""
import logging
from celery import shared_task
from django.utils import timezone
from .models import ComprobanteElectronico
from .services.sri_service import SRIService

logger = logging.getLogger(__name__)


def _notif(empresa, tipo, titulo, mensaje, url=''):
    """Crea notificación en-app (falla silenciosa)."""
    try:
        from apps.empresas.models import Notificacion
        Notificacion.objects.create(empresa=empresa, tipo=tipo, titulo=titulo, mensaje=mensaje, url=url)
    except Exception as e:
        logger.warning("No se pudo crear notificación: %s", e)


@shared_task
def verificar_autorizaciones_pendientes():
    """
    Verifica comprobantes en estado ENVIADO que aún no tienen respuesta del SRI.
    Se ejecuta periódicamente (ej. cada 2 min). Si el SRI responde NO_AUTORIZADO
    crea una notificación de error.
    """
    tiempo_limite = timezone.now() - timezone.timedelta(minutes=1)
    
    comprobantes_pendientes = ComprobanteElectronico.objects.filter(
        estado=ComprobanteElectronico.EstadoChoices.ENVIADO,
        fecha_modificacion__lte=tiempo_limite
    )
    
    count_autorizados = 0
    count_rechazados = 0
    
    for comprobante in comprobantes_pendientes:
        try:
            sri_service = SRIService(comprobante.empresa)
            response = sri_service.autorizar_comprobante_sri(comprobante.clave_acceso)
            
            if hasattr(response, 'autorizaciones') and response.autorizaciones:
                autorizacion = response.autorizaciones.autorizacion[0]
                
                if autorizacion.estado == 'AUTORIZADO':
                    comprobante.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
                    comprobante.numero_autorizacion = autorizacion.numeroAutorizacion
                    comprobante.fecha_autorizacion = autorizacion.fechaAutorizacion
                    count_autorizados += 1
                else:
                    comprobante.estado = ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO
                    count_rechazados += 1
                    mensajes = []
                    if hasattr(autorizacion, 'mensajes'):
                        for m in autorizacion.mensajes.mensaje:
                            mensajes.append(f"{m.tipo}: {m.mensaje}")
                    comprobante.mensajes_sri = '\n'.join(mensajes)
                    _notif(
                        comprobante.empresa, 'ERROR',
                        f'Factura no autorizada: {comprobante.numero_comprobante}',
                        comprobante.mensajes_sri or 'El SRI no autorizó el comprobante.',
                        '/facturacion',
                    )
                
                comprobante.respuesta_sri = {
                    'estado': autorizacion.estado,
                    'numeroAutorizacion': getattr(autorizacion, 'numeroAutorizacion', None),
                    'fechaAutorizacion': str(autorizacion.fechaAutorizacion) if hasattr(autorizacion, 'fechaAutorizacion') else None,
                }
                comprobante.save()

                if (
                    autorizacion.estado == 'AUTORIZADO'
                    and comprobante.tipo_comprobante == '04'
                    and hasattr(comprobante, 'nota_credito')
                ):
                    from apps.facturacion.services.anulacion_service import aplicar_anulacion_factura_autorizada
                    aplicar_anulacion_factura_autorizada(
                        comprobante.nota_credito.factura_origen,
                        comprobante.nota_credito,
                    )
                
        except Exception as e:
            logger.error("Error al verificar autorización de %s: %s", comprobante.clave_acceso, e)
            continue
    
    return f"Autorizados: {count_autorizados}, Rechazados: {count_rechazados}"


@shared_task
def reintentar_comprobantes_fallidos():
    """
    Reintenta automáticamente los comprobantes pendientes de envío al SRI,
    procesándolos en orden estricto de secuencial por empresa/establecimiento/
    punto_emision para evitar saltos en la numeración autorizada.

    Estados que se reintentan:
      - BORRADOR  : facturas creadas pero nunca enviadas (error de redondeo resuelto,
                    certificado ya configurado, fallo de red en la creación, etc.)
      - RECHAZADO / NO_AUTORIZADO : respuesta negativa del SRI en intento previo.

    Lógica de orden:
      Para cada grupo (empresa, establecimiento, punto_emision) se obtiene el
      secuencial más bajo en estado pendiente.  Si ese secuencial es el «siguiente
      esperable» (no hay ningún hueco anterior sin autorizar) se procesa; de lo
      contrario se bloquea hasta que el hueco se resuelva.

    Para comprobantes de días anteriores se sigue necesitando la actualización de
    fecha que ya implementa procesar_factura_sri(), pero si el usuario no tiene
    certificado se notifica en lugar de reintentar.
    """
    from apps.facturacion.models import Factura
    from apps.facturacion.services.factura_service import procesar_factura_sri
    from django.db.models import Min

    today = timezone.localdate()
    estados_pendientes = [
        ComprobanteElectronico.EstadoChoices.BORRADOR,
        ComprobanteElectronico.EstadoChoices.RECHAZADO,
        ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO,
    ]

    # Obtener todos los grupos que tienen facturas pendientes (solo tipo 01 = Factura)
    grupos = (
        ComprobanteElectronico.objects
        .filter(estado__in=estados_pendientes, tipo_comprobante='01')
        .values('empresa_id', 'establecimiento', 'punto_emision')
        .distinct()
    )

    count_reintentados = 0
    count_bloqueados = 0
    count_alertados = 0

    for grupo in grupos:
        empresa_id  = grupo['empresa_id']
        estab       = grupo['establecimiento']
        pemi        = grupo['punto_emision']

        # --- Verificar si hay huecos: secuenciales anteriores al primer pendiente
        #     que todavía no están autorizados.
        # El menor secuencial pendiente de este grupo:
        primer_pendiente = (
            ComprobanteElectronico.objects
            .filter(
                empresa_id=empresa_id,
                establecimiento=estab,
                punto_emision=pemi,
                tipo_comprobante='01',
                estado__in=estados_pendientes,
            )
            .order_by('secuencial')
            .values_list('secuencial', flat=True)
            .first()
        )
        if not primer_pendiente:
            continue

        # ¿Hay algún comprobante con secuencial MENOR que no esté autorizado ni anulado?
        # (excluyendo los propios estados pendientes ya considerados arriba)
        estados_resueltos = [
            ComprobanteElectronico.EstadoChoices.AUTORIZADO,
            ComprobanteElectronico.EstadoChoices.ANULADO,
        ]
        hueco_anterior = (
            ComprobanteElectronico.objects
            .filter(
                empresa_id=empresa_id,
                establecimiento=estab,
                punto_emision=pemi,
                tipo_comprobante='01',
                secuencial__lt=primer_pendiente,
            )
            .exclude(estado__in=estados_resueltos)
            .exists()
        )
        if hueco_anterior:
            # Hay secuenciales anteriores aún sin resolver — bloquear este grupo
            # para no crear más huecos y esperar a que el cron del siguiente ciclo
            # resuelva el hueco primero.
            count_bloqueados += 1
            logger.info(
                "Grupo empresa=%s %s-%s bloqueado: existe secuencial anterior sin autorizar antes de %s",
                empresa_id, estab, pemi, primer_pendiente,
            )
            continue

        # Procesar los comprobantes de este grupo en orden ascendente de secuencial
        comprobantes = (
            ComprobanteElectronico.objects
            .filter(
                empresa_id=empresa_id,
                establecimiento=estab,
                punto_emision=pemi,
                tipo_comprobante='01',
                estado__in=estados_pendientes,
            )
            .select_related('empresa')
            .order_by('secuencial')
        )

        for comp in comprobantes:
            empresa = comp.empresa

            # Sin certificado digital → no se puede enviar; notificar si es de día anterior
            if not empresa.certificado_digital:
                fecha_emision_local = timezone.localtime(comp.fecha_emision).date()
                if fecha_emision_local < today:
                    from apps.empresas.models import Notificacion
                    ya_notificado = Notificacion.objects.filter(
                        empresa=empresa,
                        titulo__contains=comp.numero_comprobante,
                        fecha_creacion__date=today,
                    ).exists()
                    if not ya_notificado:
                        _notif(
                            empresa, 'ADVERTENCIA',
                            f'Factura pendiente sin certificado: {comp.numero_comprobante}',
                            (
                                f'La factura {comp.numero_comprobante} (estado: {comp.estado}) '
                                f'no puede enviarse porque la empresa no tiene certificado digital '
                                f'configurado. Configúralo en Configuración → Firma Digital.'
                            ),
                            '/configuracion',
                        )
                        count_alertados += 1
                # Si no tiene certificado detenemos el grupo: no tiene sentido procesar
                # los siguientes si este va a quedar sin enviar
                break

            factura = Factura.objects.filter(comprobante=comp).first()
            if not factura:
                logger.warning("Comprobante %s sin Factura asociada, se omite.", comp.numero_comprobante)
                continue

            try:
                result = procesar_factura_sri(factura)
                logger.info(
                    "Reintento %s → éxito=%s estado=%s msg=%s",
                    comp.numero_comprobante,
                    result.get('success'),
                    result.get('estado'),
                    result.get('mensaje'),
                )
                if result.get('success'):
                    count_reintentados += 1
                else:
                    # Este comprobante falló de nuevo; detener el grupo para no
                    # desordenar los siguientes secuenciales.
                    logger.warning(
                        "Reintento fallido para %s: %s — se detiene el grupo para mantener orden.",
                        comp.numero_comprobante, result.get('mensaje'),
                    )
                    break
            except Exception as e:
                logger.error("Error en reintento de %s: %s", comp.numero_comprobante, e)
                # Detener el grupo ante error inesperado
                break

    return (
        f"Reintentados: {count_reintentados}, "
        f"Grupos bloqueados por hueco: {count_bloqueados}, "
        f"Alertados (sin certificado): {count_alertados}"
    )


@shared_task
def firmar_y_enviar_comprobante(comprobante_id):
    """
    Firma electrónicamente y envía un comprobante al SRI
    """
    try:
        comprobante = ComprobanteElectronico.objects.get(id=comprobante_id)
        
        if comprobante.estado != ComprobanteElectronico.EstadoChoices.BORRADOR:
            return f"El comprobante {comprobante.numero_comprobante} no está en estado BORRADOR"
        
        sri_service = SRIService(comprobante.empresa)
        
        # Firmar XML
        xml_firmado = sri_service.firmar_xml(comprobante.xml_generado)
        comprobante.xml_firmado = xml_firmado
        comprobante.estado = ComprobanteElectronico.EstadoChoices.FIRMADO
        comprobante.save()
        
        # Enviar al SRI
        response = sri_service.enviar_comprobante_sri(comprobante)
        
        # Procesar respuesta
        if hasattr(response, 'estado') and response.estado == 'RECIBIDA':
            comprobante.estado = ComprobanteElectronico.EstadoChoices.ENVIADO
            comprobante.respuesta_sri = {
                'estado': response.estado,
                'comprobantes': response.comprobantes if hasattr(response, 'comprobantes') else None
            }
        else:
            comprobante.estado = ComprobanteElectronico.EstadoChoices.RECHAZADO
            if hasattr(response, 'mensajes'):
                mensajes = []
                for mensaje in response.mensajes.mensaje:
                    mensajes.append(f"{mensaje.identificador}: {mensaje.mensaje}")
                comprobante.mensajes_sri = '\n'.join(mensajes)
        
        comprobante.save()
        
        return f"Comprobante {comprobante.numero_comprobante} procesado: {comprobante.estado}"
        
    except Exception as e:
        return f"Error al procesar comprobante {comprobante_id}: {str(e)}"


@shared_task
def generar_ride_pdf(comprobante_id):
    """
    Genera el PDF (RIDE) del comprobante electrónico
    """
    try:
        comprobante = ComprobanteElectronico.objects.get(id=comprobante_id)
        
        # TODO: Implementar generación de PDF con ReportLab
        # Por ahora solo retornamos un mensaje
        
        return f"RIDE generado para {comprobante.numero_comprobante}"
        
    except Exception as e:
        return f"Error al generar RIDE: {str(e)}"
