"""
Tareas automáticas de Celery para facturación
"""
from celery import shared_task
from django.utils import timezone
from .models import ComprobanteElectronico
from .services.sri_service import SRIService


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
