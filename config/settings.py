"""
Django settings for SRI Facturación Electrónica Multi-Tenant
"""

import os
import sys
from pathlib import Path
from decouple import config
from datetime import timedelta

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security settings ──────────────────────────────────────────────────────────
# SECRET_KEY MUST come from environment. No insecure defaults.
_secret = config('SECRET_KEY', default='')
if not _secret:
    if 'test' in sys.argv or 'collectstatic' in sys.argv:
        _secret = 'test-only-insecure-key-never-use-in-prod'
    else:
        raise RuntimeError(
            'FATAL: SECRET_KEY environment variable is not set. '
            'Set it before running the server.'
        )
SECRET_KEY = _secret

# DEBUG defaults to False — must be explicitly enabled
DEBUG = config('DEBUG', default=False, cast=bool)

# ALLOWED_HOSTS must be configured in production
_hosts = config('ALLOWED_HOSTS', default='').strip()
ALLOWED_HOSTS = [h.strip() for h in _hosts.split(',') if h.strip()] if _hosts else (['*'] if DEBUG else ['localhost', '127.0.0.1'])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'django_extensions',
    'django_celery_beat',
    'django_celery_results',
    
    # Local apps
    'apps.core',
    'apps.usuarios',
    'apps.empresas',
    'apps.suscripciones',
    'apps.facturacion',
    'apps.productos',
    'apps.clientes',
    'apps.inventarios',
    'apps.ventas',
    'apps.proveedores',
    'apps.pedidos',
    'apps.cartera',
    'apps.declaraciones',
    'apps.cotizaciones',
    'apps.contabilidad',
    'apps.bancos',
    'apps.nomina',
    'apps.firmas',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.empresas.middleware.TenantMiddleware',  # Multi-tenant middleware
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
# Soporte para DATABASE_URL (Neon, Heroku, etc.) o configuración manual
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=config(
            'DATABASE_URL',
            default=f"postgresql://{config('DB_USER', default='postgres')}:{config('DB_PASSWORD', default='postgres')}@{config('DB_HOST', default='localhost')}:{config('DB_PORT', default='5432')}/{config('DB_NAME', default='facturacion_sri')}"
        ),
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=True if 'neon.tech' in config('DB_HOST', default='') else False
    )
}

# Custom User Model
AUTH_USER_MODEL = 'usuarios.Usuario'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'es-ec'
TIME_ZONE = 'America/Guayaquil'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Configuración comercial
KIT_EMPRENDEDOR_PRICE = config('KIT_EMPRENDEDOR_PRICE', default='79.99')

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DATETIME_FORMAT': '%Y-%m-%d %H:%M:%S',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '200/hour',
        'user': '2000/hour',
        'login': '5/minute',
    },
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS/CSRF Settings - lee dominios adicionales de producción desde env
_cors_extra = config('CORS_ALLOWED_ORIGINS', default='')
_cors_extra_list = [o.strip() for o in _cors_extra.split(',') if o.strip()]
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:8080",
    "https://facturaof1.of1solutions.com",
    "https://facturaof1-back.of1solutions.com",
] + _cors_extra_list
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.of1solutions\.com$",
]
CORS_ALLOW_CREDENTIALS = True

_csrf_extra = config('CSRF_TRUSTED_ORIGINS', default='')
_csrf_extra_list = [o.strip() for o in _csrf_extra.split(',') if o.strip()]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:8080",
    "https://facturaof1.of1solutions.com",
    "https://facturaof1-back.of1solutions.com",
] + _csrf_extra_list

# Celery Configuration
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'django-cache'
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Email Configuration
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
# cast=bool via decouple no es fiable cuando Railway pasa los valores con comillas literales.
# Usamos comparación explícita de cadena para garantizar el comportamiento correcto.
_email_use_tls_raw = config('EMAIL_USE_TLS', default='True').strip().strip('"\'')
_email_use_ssl_raw = config('EMAIL_USE_SSL', default='False').strip().strip('"\'')
EMAIL_USE_TLS = _email_use_tls_raw.lower() in ('true', '1', 'yes')
EMAIL_USE_SSL = _email_use_ssl_raw.lower() in ('true', '1', 'yes')
# Zoho puerto 465 requiere SSL=True, TLS=False. Ambos True es inválido.
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    EMAIL_USE_TLS = False  # SSL tiene prioridad cuando el puerto es 465
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)
EMAIL_TIMEOUT = 10  # segundos — evita que send_mail bloquee workers de gunicorn

# Resend API (reemplaza SMTP bloqueado por Railway)
RESEND_API_KEY = config('RESEND_API_KEY', default='')

# URL pública del backend (usada por keepalive ping en Render free tier)
APP_URL = config('APP_URL', default='')

# SRI Configuration
SRI_AMBIENTE = config('SRI_AMBIENTE', default='PRUEBAS')  # PRUEBAS o PRODUCCION
SRI_PRUEBAS_RECEPCION_URL = config(
    'SRI_PRUEBAS_RECEPCION_URL',
    default='https://celarium.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl'
)
SRI_PRUEBAS_AUTORIZACION_URL = config(
    'SRI_PRUEBAS_AUTORIZACION_URL',
    default='https://celarium.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
)
SRI_PRODUCCION_RECEPCION_URL = config(
    'SRI_PRODUCCION_RECEPCION_URL',
    default='https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl'
)
SRI_PRODUCCION_AUTORIZACION_URL = config(
    'SRI_PRODUCCION_AUTORIZACION_URL',
    default='https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
)

# File Upload Settings
# El flujo público de firmas puede subir varios documentos de hasta 15 MB.
FILE_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 120 * 1024 * 1024

# ── Seguridad extra en producción (DEBUG=False) ────────────────────────────────
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000          # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # SECURE_SSL_REDIRECT lo maneja Railway a nivel de proxy, no Django
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # Feature flags (rollout seguro; desactivadas por defecto)
    FEATURE_FLAGS = {
        'CONTROL_POLICY_ENGINE_ENABLED': config('CONTROL_POLICY_ENGINE_ENABLED', default=False, cast=bool),
        'CONTROL_WORKFLOW_ENGINE_ENABLED': config('CONTROL_WORKFLOW_ENGINE_ENABLED', default=False, cast=bool),
        'CONTROL_AUDIT_ENGINE_ENABLED': config('CONTROL_AUDIT_ENGINE_ENABLED', default=False, cast=bool),
        'CONTROL_ALERT_ENGINE_ENABLED': config('CONTROL_ALERT_ENGINE_ENABLED', default=False, cast=bool),
        'CONTROL_SRI_ENGINE_ENABLED': config('CONTROL_SRI_ENGINE_ENABLED', default=False, cast=bool),
    }

# ── Logging ────────────────────────────────────────────────────────────────────
# Deshabilitamos AdminEmailHandler (default de Django en DEBUG=False) porque
# intenta enviar emails en cada error 500, lo que crashea el worker de gunicorn
# si el servidor SMTP no está disponible.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        # Logger de la app — muestra INFO (incluye password temporal en logs de Railway)
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
