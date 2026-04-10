"""
Tarea de keepalive para evitar que Render (free tier) duerma el web service.
Se ejecuta cada 10 minutos vía Celery Beat y hace un GET al health endpoint propio.
"""
import logging
import requests
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True)
def keepalive_ping():
    """
    Hace un GET a /api/health/ del propio servidor para que Render
    no lo hiberne por inactividad (free tier duerme tras 15 min sin tráfico HTTP).
    Requiere APP_URL en las variables de entorno, ej:
        APP_URL=https://mi-app.onrender.com
    """
    app_url = getattr(settings, 'APP_URL', '').rstrip('/')
    if not app_url:
        logger.debug("keepalive_ping: APP_URL no configurada, se omite el ping.")
        return

    url = f"{app_url}/api/health/"
    try:
        resp = requests.get(url, timeout=10)
        logger.debug("keepalive_ping: %s → %s", url, resp.status_code)
    except Exception as exc:
        logger.warning("keepalive_ping falló: %s", exc)
