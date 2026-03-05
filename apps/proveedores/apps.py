from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class ProveedoresConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.proveedores'
    verbose_name = _('Proveedores')
    
    def ready(self):
        import apps.proveedores.signals  # noqa
