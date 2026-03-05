"""
Celery configuration for background tasks
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Periodic Tasks
app.conf.beat_schedule = {
    'verificar-suscripciones-vencidas': {
        'task': 'apps.suscripciones.tasks.verificar_suscripciones_vencidas',
        'schedule': crontab(hour=0, minute=0),  # Diario a medianoche
    },
    'verificar-suscripciones-por-vencer': {
        'task': 'apps.suscripciones.tasks.verificar_suscripciones_por_vencer',
        'schedule': crontab(hour=9, minute=0),  # Diario a las 9 AM
    },
    'verificar-autorizaciones-pendientes': {
        'task': 'apps.facturacion.tasks.verificar_autorizaciones_pendientes',
        'schedule': crontab(minute='*/10'),  # Cada 10 minutos
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
