web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
worker: celery -A config.celery worker --loglevel=info --concurrency=2
beat: celery -A config.celery beat --loglevel=info
