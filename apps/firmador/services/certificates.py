import base64
import hashlib
from datetime import timezone as dt_timezone
from dataclasses import dataclass

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import pkcs12
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone


@dataclass
class CertificateInfo:
    encrypted_content: bytes
    fingerprint: str
    subject: str
    issuer: str
    expires_at: object


def _fernet():
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_certificate(content: bytes) -> bytes:
    return _fernet().encrypt(content)


def decrypt_certificate(content: bytes) -> bytes:
    return _fernet().decrypt(content)


def parse_and_encrypt_certificate(content: bytes, password: str) -> CertificateInfo:
    try:
        private_key, certificate, _additional = pkcs12.load_key_and_certificates(
            content,
            (password or '').encode(),
        )
    except ValueError as exc:
        raise ValidationError('No se pudo abrir el certificado. Verifica el archivo y la contraseña.') from exc

    if private_key is None or certificate is None:
        raise ValidationError('El certificado no contiene una clave privada válida.')

    subject = certificate.subject.rfc4514_string()
    issuer = certificate.issuer.rfc4514_string()
    expires_at = certificate.not_valid_after
    if timezone.is_naive(expires_at):
        expires_at = timezone.make_aware(expires_at, timezone=dt_timezone.utc)

    return CertificateInfo(
        encrypted_content=encrypt_certificate(content),
        fingerprint=certificate.fingerprint(hashes.SHA256()).hex(),
        subject=subject,
        issuer=issuer,
        expires_at=expires_at,
    )
