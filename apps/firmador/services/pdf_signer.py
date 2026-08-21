import hashlib
import os
import tempfile
from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ValidationError


PDF_HEADER = b'%PDF-'


@dataclass
class SignedPdfResult:
    content: bytes
    original_hash: str
    signed_hash: str
    signed_file_name: str


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def validate_pdf_upload(file, max_size):
    if file.size > max_size:
        raise ValidationError(f'El PDF supera el tamaño máximo permitido de {max_size // 1024 // 1024} MB.')
    name = (getattr(file, 'name', '') or '').lower()
    content_type = (getattr(file, 'content_type', '') or '').lower()
    if not name.endswith('.pdf') or content_type not in ('', 'application/pdf', 'application/x-pdf'):
        raise ValidationError('Sube un archivo PDF válido.')
    current = file.tell() if hasattr(file, 'tell') else None
    head = file.read(5)
    if current is not None:
        file.seek(current)
    if head != PDF_HEADER:
        raise ValidationError('El archivo no parece ser un PDF válido.')


def validate_certificate_upload(file):
    max_cert_size = int(getattr(settings, 'FIRMADOR_MAX_CERT_SIZE_BYTES', 2 * 1024 * 1024))
    if file.size > max_cert_size:
        raise ValidationError('El certificado no puede superar 2 MB.')
    name = (getattr(file, 'name', '') or '').lower()
    if not name.endswith(('.p12', '.pfx')):
        raise ValidationError('Sube un certificado .p12 o .pfx válido.')


def _read_file(file) -> bytes:
    current = file.tell() if hasattr(file, 'tell') else None
    content = file.read()
    if current is not None:
        file.seek(current)
    return content


def sign_pdf_with_pkcs12(
    *,
    pdf_file,
    certificate_file,
    certificate_password,
    reason='Firmado electrónicamente',
    location='Ecuador',
    visible_signature=False,
) -> SignedPdfResult:
    try:
        from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
        from pyhanko.sign import fields, signers
    except ImportError as exc:
        raise RuntimeError('El firmador PDF requiere instalar pyHanko en el backend.') from exc

    pdf_content = _read_file(pdf_file)
    cert_content = _read_file(certificate_file)
    original_hash = sha256_bytes(pdf_content)
    original_name = os.path.basename(getattr(pdf_file, 'name', '') or 'documento.pdf')
    base_name, _ = os.path.splitext(original_name)
    signed_file_name = f'{base_name}-firmado.pdf'

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as pdf_tmp:
        pdf_tmp.write(pdf_content)
        pdf_path = pdf_tmp.name
    with tempfile.NamedTemporaryFile(suffix='.p12', delete=False) as cert_tmp:
        cert_tmp.write(cert_content)
        cert_path = cert_tmp.name
    out_fd, out_path = tempfile.mkstemp(suffix='.pdf')
    os.close(out_fd)

    try:
        signer = signers.SimpleSigner.load_pkcs12(
            pfx_file=cert_path,
            passphrase=(certificate_password or '').encode(),
        )
        field_name = 'FirmaOF1'
        with open(pdf_path, 'rb') as inf:
            writer = IncrementalPdfFileWriter(inf)
            if visible_signature:
                fields.append_signature_field(
                    writer,
                    sig_field_spec=fields.SigFieldSpec(
                        sig_field_name=field_name,
                        box=(36, 36, 260, 100),
                        on_page=0,
                    ),
                )
            meta = signers.PdfSignatureMetadata(
                field_name=field_name,
                reason=reason or 'Firmado electrónicamente',
                location=location or 'Ecuador',
            )
            with open(out_path, 'wb') as outf:
                signers.sign_pdf(writer, signature_meta=meta, signer=signer, output=outf)

        with open(out_path, 'rb') as signed_file:
            signed_content = signed_file.read()

        return SignedPdfResult(
            content=signed_content,
            original_hash=original_hash,
            signed_hash=sha256_bytes(signed_content),
            signed_file_name=signed_file_name,
        )
    finally:
        for path in (pdf_path, cert_path, out_path):
            try:
                os.remove(path)
            except OSError:
                pass
