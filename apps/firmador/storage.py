from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import FileSystemStorage, Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class FirmadorDocumentStorage(Storage):
    def __init__(self):
        self._wrapped = None

    @property
    def wrapped(self):
        if self._wrapped is None:
            self._wrapped = self._build_storage()
        return self._wrapped

    def _build_storage(self):
        backend = getattr(settings, 'FIRMADOR_DOCUMENTS_STORAGE', '').strip().lower()
        if not backend:
            backend = getattr(settings, 'SIGNATURE_DOCUMENTS_STORAGE', 'local').strip().lower()
        if backend != 's3':
            return FileSystemStorage(location=settings.MEDIA_ROOT, base_url=settings.MEDIA_URL)

        try:
            from storages.backends.s3boto3 import S3Boto3Storage
        except ImportError:
            try:
                from storages.backends.s3 import S3Storage as S3Boto3Storage
            except ImportError as exc:
                raise ImproperlyConfigured(
                    'FIRMADOR_DOCUMENTS_STORAGE=s3 requiere instalar django-storages y boto3.'
                ) from exc

        required = {
            'access_key': getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
            'secret_key': getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
            'bucket_name': getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''),
            'endpoint_url': getattr(settings, 'AWS_S3_ENDPOINT_URL', ''),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ImproperlyConfigured(
                'Faltan variables para documentos del firmador: '
                + ', '.join(missing)
                + '. Revisa AWS_ACCESS_KEY_ID/R2_ACCESS_KEY_ID, '
                'AWS_SECRET_ACCESS_KEY/R2_SECRET_ACCESS_KEY, '
                'AWS_STORAGE_BUCKET_NAME/R2_BUCKET_NAME y AWS_S3_ENDPOINT_URL/R2_ACCOUNT_ID.'
            )

        return S3Boto3Storage(
            access_key=required['access_key'],
            secret_key=required['secret_key'],
            bucket_name=required['bucket_name'],
            endpoint_url=required['endpoint_url'],
            region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'auto'),
            signature_version=getattr(settings, 'AWS_S3_SIGNATURE_VERSION', 's3v4'),
            addressing_style=getattr(settings, 'AWS_S3_ADDRESSING_STYLE', 'path'),
            custom_domain=getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None) or None,
            default_acl=getattr(settings, 'AWS_DEFAULT_ACL', None),
            file_overwrite=True,
            querystring_auth=getattr(settings, 'AWS_QUERYSTRING_AUTH', True),
            object_parameters=getattr(settings, 'AWS_S3_OBJECT_PARAMETERS', {}),
        )

    def _open(self, name, mode='rb'):
        return self.wrapped.open(name, mode)

    def _save(self, name, content):
        return self.wrapped.save(name, content)

    def delete(self, name):
        return self.wrapped.delete(name)

    def exists(self, name):
        return self.wrapped.exists(name)

    def listdir(self, path):
        return self.wrapped.listdir(path)

    def size(self, name):
        return self.wrapped.size(name)

    def url(self, name):
        return self.wrapped.url(name)

    def get_available_name(self, name, max_length=None):
        backend = getattr(settings, 'FIRMADOR_DOCUMENTS_STORAGE', '').strip().lower()
        if not backend:
            backend = getattr(settings, 'SIGNATURE_DOCUMENTS_STORAGE', 'local').strip().lower()
        if backend == 's3':
            return name
        return self.wrapped.get_available_name(name, max_length=max_length)

    def path(self, name):
        return self.wrapped.path(name)

