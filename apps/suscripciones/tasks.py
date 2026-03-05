"""
Tareas automáticas de Celery para suscripciones
"""
from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta
from .models import Suscripcion, PlanSuscripcion


@shared_task
def verificar_suscripciones_vencidas():
    """
    Tarea que se ejecuta diariamente para verificar y desactivar suscripciones vencidas
    """
    now = timezone.now()
    
    # Buscar suscripciones activas que ya vencieron
    suscripciones_vencidas = Suscripcion.objects.filter(
        estado=Suscripcion.EstadoChoices.ACTIVA,
        fecha_fin__lte=now
    )
    
    count = 0
    for suscripcion in suscripciones_vencidas:
        # Si tiene auto-renovar, intentar renovar
        if suscripcion.auto_renovar:
            try:
                suscripcion.renovar()
                # Enviar notificación de renovación
                enviar_notificacion_renovacion.delay(suscripcion.id)
            except Exception as e:
                # Si falla la renovación, marcar como vencida
                suscripcion.marcar_como_vencida()
                enviar_notificacion_vencimiento.delay(suscripcion.id)
        else:
            # Marcar como vencida
            suscripcion.marcar_como_vencida()
            enviar_notificacion_vencimiento.delay(suscripcion.id)
        
        # Desactivar la empresa
        suscripcion.empresa.activa = False
        suscripcion.empresa.save(update_fields=['activa'])
        
        count += 1
    
    return f"Se procesaron {count} suscripciones vencidas"


@shared_task
def verificar_suscripciones_por_vencer():
    """
    Tarea que se ejecuta diariamente para notificar sobre suscripciones próximas a vencer
    """
    suscripciones = Suscripcion.objects.filter(
        estado=Suscripcion.EstadoChoices.ACTIVA,
        notificado_por_vencer=False
    )
    
    count = 0
    for suscripcion in suscripciones:
        if suscripcion.esta_por_vencer():
            enviar_notificacion_proximo_vencimiento.delay(suscripcion.id)
            suscripcion.notificado_por_vencer = True
            suscripcion.save(update_fields=['notificado_por_vencer'])
            count += 1
    
    return f"Se enviaron {count} notificaciones de próximo vencimiento"


@shared_task
def enviar_notificacion_vencimiento(suscripcion_id):
    """
    Envía notificación de suscripción vencida
    """
    try:
        suscripcion = Suscripcion.objects.get(id=suscripcion_id)
        empresa = suscripcion.empresa
        
        # Obtener emails de administradores de la empresa
        emails = list(empresa.usuarios.filter(
            rol__in=['SUPER_ADMIN', 'ADMIN_EMPRESA'],
            is_active=True
        ).values_list('email', flat=True))
        
        if emails:
            send_mail(
                subject=f'Suscripción Vencida - {empresa.razon_social}',
                message=f"""
                Estimado usuario,
                
                Su suscripción al plan {suscripcion.plan.nombre} ha vencido.
                
                Para continuar utilizando el sistema de facturación electrónica,
                por favor renueve su suscripción.
                
                Detalles:
                - Empresa: {empresa.razon_social}
                - Plan: {suscripcion.plan.nombre}
                - Fecha de vencimiento: {suscripcion.fecha_fin.strftime('%d/%m/%Y')}
                
                Saludos,
                Sistema de Facturación Electrónica
                """,
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=emails,
                fail_silently=False,
            )
        
        return f"Notificación de vencimiento enviada para {empresa.razon_social}"
    except Exception as e:
        return f"Error al enviar notificación: {str(e)}"


@shared_task
def enviar_notificacion_proximo_vencimiento(suscripcion_id):
    """
    Envía notificación de suscripción próxima a vencer
    """
    try:
        suscripcion = Suscripcion.objects.get(id=suscripcion_id)
        empresa = suscripcion.empresa
        dias_restantes = suscripcion.dias_restantes()
        
        # Obtener emails de administradores
        emails = list(empresa.usuarios.filter(
            rol__in=['SUPER_ADMIN', 'ADMIN_EMPRESA'],
            is_active=True
        ).values_list('email', flat=True))
        
        if emails:
            send_mail(
                subject=f'Recordatorio: Su suscripción vence pronto - {empresa.razon_social}',
                message=f"""
                Estimado usuario,
                
                Le recordamos que su suscripción al plan {suscripcion.plan.nombre} 
                vencerá en {dias_restantes} días.
                
                Detalles:
                - Empresa: {empresa.razon_social}
                - Plan: {suscripcion.plan.nombre}
                - Fecha de vencimiento: {suscripcion.fecha_fin.strftime('%d/%m/%Y %H:%M')}
                - Días restantes: {dias_restantes}
                
                {'La suscripción se renovará automáticamente.' if suscripcion.auto_renovar else 'Por favor renueve su suscripción para continuar usando el servicio.'}
                
                Saludos,
                Sistema de Facturación Electrónica
                """,
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=emails,
                fail_silently=False,
            )
        
        return f"Notificación de próximo vencimiento enviada para {empresa.razon_social}"
    except Exception as e:
        return f"Error al enviar notificación: {str(e)}"


@shared_task
def enviar_notificacion_renovacion(suscripcion_id):
    """
    Envía notificación de renovación de suscripción
    """
    try:
        suscripcion = Suscripcion.objects.get(id=suscripcion_id)
        empresa = suscripcion.empresa
        
        emails = list(empresa.usuarios.filter(
            rol__in=['SUPER_ADMIN', 'ADMIN_EMPRESA'],
            is_active=True
        ).values_list('email', flat=True))
        
        if emails:
            send_mail(
                subject=f'Suscripción Renovada - {empresa.razon_social}',
                message=f"""
                Estimado usuario,
                
                Su suscripción al plan {suscripcion.plan.nombre} ha sido renovada exitosamente.
                
                Detalles:
                - Empresa: {empresa.razon_social}
                - Plan: {suscripcion.plan.nombre}
                - Nueva fecha de vencimiento: {suscripcion.fecha_fin.strftime('%d/%m/%Y')}
                - Monto: ${suscripcion.plan.precio}
                
                Saludos,
                Sistema de Facturación Electrónica
                """,
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=emails,
                fail_silently=False,
            )
        
        return f"Notificación de renovación enviada para {empresa.razon_social}"
    except Exception as e:
        return f"Error al enviar notificación: {str(e)}"
