import zipfile
from io import BytesIO
from xml.etree import ElementTree as ET

import django_filters
from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasModuleAccess

from .models import DocumentoRecibidoDetalle, DocumentoRecibidoImpuesto, DocumentoRecibidoSRI
from .serializers import DocumentoRecibidoSRISerializer
from .services.xml_parser import parse_sri_xml


class DocumentoRecibidoSRIFilter(django_filters.FilterSet):
    fecha_desde = django_filters.DateFilter(field_name='fecha_emision', lookup_expr='gte')
    fecha_hasta = django_filters.DateFilter(field_name='fecha_emision', lookup_expr='lte')

    class Meta:
        model = DocumentoRecibidoSRI
        fields = ['tipo_comprobante', 'estado_interno', 'estado_sri', 'ruc_emisor']


def _get_empresa_from_request(request):
    empresa = getattr(request, 'tenant', None)
    if not empresa and request.user.is_authenticated:
        empresa = getattr(request.user, 'empresa', None)
    return empresa


class DocumentoRecibidoSRIViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DocumentoRecibidoSRISerializer
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'facturacion'
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = DocumentoRecibidoSRIFilter
    search_fields = ['clave_acceso', 'numero_comprobante', 'ruc_emisor', 'razon_social_emisor']
    ordering_fields = ['fecha_emision', 'fecha_creacion', 'total']
    ordering = ['-fecha_emision', '-fecha_creacion']

    def get_queryset(self):
        empresa = _get_empresa_from_request(self.request)
        if not empresa:
            return DocumentoRecibidoSRI.objects.none()
        return (
            DocumentoRecibidoSRI.objects
            .filter(empresa=empresa)
            .prefetch_related('detalles', 'impuestos')
        )

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        empresa = _get_empresa_from_request(request)
        if not empresa:
            return Response({'error': 'No hay empresa configurada para este usuario.'}, status=status.HTTP_400_BAD_REQUEST)

        archivos = request.FILES.getlist('archivos') or request.FILES.getlist('archivo')
        if not archivos:
            return Response({'error': 'Debes subir al menos un XML o ZIP.'}, status=status.HTTP_400_BAD_REQUEST)

        resultado = {'creados': 0, 'duplicados': 0, 'errores': 0, 'documentos': []}
        for archivo in archivos:
            for nombre, contenido in _expandir_archivo(archivo):
                item = self._importar_xml(empresa, request.user, nombre, contenido)
                resultado[item['resultado']] += 1
                resultado['documentos'].append(item)

        return Response(resultado, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def _importar_xml(self, empresa, usuario, nombre_archivo, xml_text):
        try:
            data = parse_sri_xml(xml_text)
        except (ET.ParseError, UnicodeDecodeError, ValueError) as exc:
            return {
                'resultado': 'errores',
                'nombre_archivo': nombre_archivo,
                'error': f'No se pudo leer el XML: {exc}',
            }

        if not data.clave_acceso:
            return {
                'resultado': 'errores',
                'nombre_archivo': nombre_archivo,
                'error': 'El XML no contiene clave de acceso.',
            }

        existente = DocumentoRecibidoSRI.objects.filter(
            empresa=empresa,
            clave_acceso=data.clave_acceso,
        ).first()
        if existente:
            return {
                'resultado': 'duplicados',
                'id': existente.id,
                'nombre_archivo': nombre_archivo,
                'clave_acceso': data.clave_acceso,
                'numero_comprobante': existente.numero_comprobante,
            }

        estado_interno = DocumentoRecibidoSRI.EstadoInternoChoices.RECIBIDO
        errores = list(data.errores)
        empresa_ruc = (getattr(empresa, 'ruc', '') or '').strip()
        if empresa_ruc and data.ruc_receptor and data.ruc_receptor != empresa_ruc:
            estado_interno = DocumentoRecibidoSRI.EstadoInternoChoices.REQUIERE_REVISION
            errores.append('El receptor del XML no coincide con el RUC de la empresa activa.')

        documento = DocumentoRecibidoSRI.objects.create(
            empresa=empresa,
            usuario_creador=usuario,
            tipo_comprobante=data.tipo_comprobante,
            clave_acceso=data.clave_acceso,
            numero_autorizacion=data.numero_autorizacion,
            numero_comprobante=data.numero_comprobante,
            ruc_emisor=data.ruc_emisor,
            razon_social_emisor=data.razon_social_emisor,
            ruc_receptor=data.ruc_receptor,
            razon_social_receptor=data.razon_social_receptor,
            fecha_emision=data.fecha_emision,
            fecha_autorizacion=timezone.make_aware(data.fecha_autorizacion) if data.fecha_autorizacion and timezone.is_naive(data.fecha_autorizacion) else data.fecha_autorizacion,
            estado_sri=data.estado_sri,
            estado_interno=estado_interno,
            subtotal_0=data.subtotal_0,
            subtotal_iva=data.subtotal_iva,
            subtotal_no_objeto=data.subtotal_no_objeto,
            subtotal_exento=data.subtotal_exento,
            iva=data.iva,
            ice=data.ice,
            total=data.total,
            nombre_archivo=nombre_archivo,
            xml_original=xml_text,
            errores=errores,
            metadata=data.metadata,
        )

        DocumentoRecibidoDetalle.objects.bulk_create([
            DocumentoRecibidoDetalle(documento=documento, **detalle)
            for detalle in data.detalles
        ])
        DocumentoRecibidoImpuesto.objects.bulk_create([
            DocumentoRecibidoImpuesto(documento=documento, **impuesto)
            for impuesto in data.impuestos
        ])

        return {
            'resultado': 'creados',
            'id': documento.id,
            'nombre_archivo': nombre_archivo,
            'clave_acceso': documento.clave_acceso,
            'numero_comprobante': documento.numero_comprobante,
            'estado_interno': documento.estado_interno,
        }


def _expandir_archivo(archivo):
    nombre = archivo.name
    contenido = archivo.read()
    if nombre.lower().endswith('.zip'):
        with zipfile.ZipFile(BytesIO(contenido)) as zip_file:
            for item in zip_file.infolist():
                if item.is_dir() or not item.filename.lower().endswith('.xml'):
                    continue
                yield item.filename, _decode_bytes(zip_file.read(item))
    else:
        yield nombre, _decode_bytes(contenido)


def _decode_bytes(contenido: bytes) -> str:
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            return contenido.decode(encoding)
        except UnicodeDecodeError:
            continue
    return contenido.decode('utf-8', errors='replace')
