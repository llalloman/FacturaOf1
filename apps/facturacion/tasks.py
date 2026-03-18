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
                
        except Exception as e:
            logger.error("Error al verificar autorización de %s: %s", comprobante.clave_acceso, e)
            continue
    
    return f"Autorizados: {count_autorizados}, Rechazados: {count_rechazados}"


@shared_task
def reintentar_comprobantes_fallidos():
    """
    Reintenta automáticamente los comprobantes RECHAZADOS o NO_AUTORIZADOS
    que fueron emitidos el mismo día (fecha_emision == hoy).

    Para comprobantes de días anteriores solo se crea una notificación de advertencia
    solicitando reenvío manual (el usuario debe confirmar el cambio de fecha).
    """
    from apps.facturacion.services.factura_service import procesar_factura_sri

    today = timezone.localdate()
    estados_fallidos = [
        ComprobanteElectronico.EstadoChoices.RECHAZADO,
        ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO,
    ]

    # Solo tipo FACTURA (01) para el reintento automático
    comprobantes = ComprobanteElectronico.objects.filter(
        estado__in=estados_fallidos,
        tipo_comprobante='01',
    ).select_related('empresa')

    count_reintentados = 0
    count_alertados = 0

    for comp in comprobantes:
        empresa = comp.empresa

        # Sin certificado digital no hay nada que hacer
        if not empresa.certificado_digital:
            continue

        fecha_emision_local = timezone.localtime(comp.fecha_emision).date()

        if fecha_emision_local == today:
            # Mismo día → reintentar automáticamente
            try:
                from apps.facturacion.models import Factura
                factura = Factura.objects.filter(comprobante=comp).first()
                if not factura:
                    continue
                result = procesar_factura_sri(factura)
                count_reintentados += 1
                if result.get('success'):
                    logger.info("Reintento exitoso: %s → %s", comp.numero_comprobante, result.get('estado'))
            except Exception as e:
                logger.error("Error en reintento de %s: %s", comp.numero_comprobante, e)
        else:
            # Día anterior → solo notificar (requiere acción manual)
            # Evitar notificaciones duplicadas (máx 1 por comprobante por día)
            from apps.empresas.models import Notificacion
            ya_notificado = Notificacion.objects.filter(
                empresa=empresa,
                titulo__contains=comp.numero_comprobante,
                fecha_creacion__date=today,
            ).exists()
            if not ya_notificado:
                _notif(
                    empresa, 'ADVERTENCIA',
                    f'Factura pendiente requiere reenvío: {comp.numero_comprobante}',
                    (
                        f'La factura {comp.numero_comprobante} (estado: {comp.estado}) fue emitida el '
                        f'{fecha_emision_local} y no pudo autorizarse. '
                        f'El SRI solo acepta facturas del día actual. '
                        f'Ingresa a Facturación y usa "Reprocesar" para reenviarla con la fecha de hoy.'
                    ),
                    '/facturacion',
                )
                count_alertados += 1

    return f"Reintentados: {count_reintentados}, Alertados (fecha anterior): {count_alertados}"


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


@shared_task
def verificar_autorizaciones_pendientes():
    """
    Verifica comprobantes enviados al SRI que están pendientes de autorización
    """
    # Buscar comprobantes enviados hace más de 1 minuto
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
            
            # Procesar respuesta
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
                
                comprobante.respuesta_sri = {
                    'estado': autorizacion.estado,
                    'numeroAutorizacion': autorizacion.numeroAutorizacion if hasattr(autorizacion, 'numeroAutorizacion') else None,
                    'fechaAutorizacion': str(autorizacion.fechaAutorizacion) if hasattr(autorizacion, 'fechaAutorizacion') else None,
                }
                
                if hasattr(autorizacion, 'mensajes'):
                    mensajes = []
                    for mensaje in autorizacion.mensajes.mensaje:
                        mensajes.append(f"{mensaje.tipo}: {mensaje.mensaje}")
                    comprobante.mensajes_sri = '\n'.join(mensajes)
                
                comprobante.save()
                
        except Exception as e:
            print(f"Error al verificar autorización de {comprobante.clave_acceso}: {str(e)}")
            continue
    
    return f"Autorizados: {count_autorizados}, Rechazados: {count_rechazados}"


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
