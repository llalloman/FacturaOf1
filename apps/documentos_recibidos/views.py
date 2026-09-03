import zipfile
from datetime import timedelta
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
from apps.proveedores.models import CuentaPorPagar, Proveedor

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
            .select_related('proveedor', 'cuenta_por_pagar')
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
            try:
                items = list(_expandir_archivo(archivo))
            except zipfile.BadZipFile:
                resultado['errores'] += 1
                resultado['documentos'].append({
                    'resultado': 'errores',
                    'nombre_archivo': archivo.name,
                    'error': 'El ZIP no es válido o está dañado.',
                })
                continue

            for nombre, contenido in items:
                item = self._importar_xml(empresa, request.user, nombre, contenido)
                resultado[item['resultado']] += 1
                resultado['documentos'].append(item)

        return Response(resultado, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='convertir-cxp')
    @transaction.atomic
    def convertir_cxp(self, request, pk=None):
        empresa = _get_empresa_from_request(request)
        if not empresa:
            return Response({'error': 'No hay empresa configurada para este usuario.'}, status=status.HTTP_400_BAD_REQUEST)

        documento = (
            self.get_queryset()
            .select_for_update()
            .filter(pk=pk)
            .first()
        )
        if not documento:
            return Response({'error': 'Documento recibido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if documento.cuenta_por_pagar_id:
            return Response(self.get_serializer(documento).data, status=status.HTTP_200_OK)

        tipos_convertibles = {
            DocumentoRecibidoSRI.TipoComprobanteChoices.FACTURA,
            DocumentoRecibidoSRI.TipoComprobanteChoices.LIQUIDACION_COMPRA,
            DocumentoRecibidoSRI.TipoComprobanteChoices.NOTA_DEBITO,
        }
        if documento.tipo_comprobante not in tipos_convertibles:
            return Response(
                {'error': 'Solo facturas, liquidaciones de compra y notas de débito pueden convertirse en cuenta por pagar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if documento.total <= 0:
            return Response({'error': 'El documento no tiene un total válido para cuenta por pagar.'}, status=status.HTTP_400_BAD_REQUEST)

        if not documento.ruc_emisor:
            return Response({'error': 'El XML no contiene RUC del proveedor.'}, status=status.HTTP_400_BAD_REQUEST)

        if any('receptor del XML no coincide' in str(error) for error in documento.errores):
            return Response(
                {'error': 'El receptor del XML no coincide con la empresa activa. Revisa el documento antes de convertir.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        proveedor, proveedor_creado = Proveedor.objects.get_or_create(
            empresa=empresa,
            identificacion=documento.ruc_emisor,
            defaults={
                'tipo_identificacion': Proveedor.TipoIdentificacionChoices.RUC if len(documento.ruc_emisor) == 13 else Proveedor.TipoIdentificacionChoices.CEDULA,
                'razon_social': documento.razon_social_emisor or documento.ruc_emisor,
                'nombre_comercial': documento.razon_social_emisor or '',
                'notas': 'Creado automáticamente desde Bandeja Tributaria.',
            },
        )

        fecha_emision = documento.fecha_emision or timezone.localdate()
        dias_credito = max(proveedor.dias_credito or 0, 0)
        numero_cuenta = _generar_numero_cuenta(empresa, documento)
        cuenta = CuentaPorPagar.objects.create(
            empresa=empresa,
            proveedor=proveedor,
            numero_cuenta=numero_cuenta,
            fecha_emision=fecha_emision,
            fecha_vencimiento=fecha_emision + timedelta(days=dias_credito),
            monto_total=documento.total,
            monto_pagado=0,
            saldo=documento.total,
            estado=CuentaPorPagar.EstadoChoices.PENDIENTE,
            notas=(
                f'Generada desde documento recibido SRI {documento.numero_comprobante or documento.clave_acceso}. '
                f'Clave de acceso: {documento.clave_acceso}.'
            ),
        )

        metadata = dict(documento.metadata or {})
        metadata['conversion_cxp'] = {
            'proveedor_creado': proveedor_creado,
            'usuario_id': request.user.id,
            'fecha': timezone.now().isoformat(),
        }
        documento.proveedor = proveedor
        documento.cuenta_por_pagar = cuenta
        documento.estado_interno = DocumentoRecibidoSRI.EstadoInternoChoices.CONVERTIDO
        documento.fecha_conversion = timezone.now()
        documento.metadata = metadata
        documento.save(update_fields=[
            'proveedor', 'cuenta_por_pagar', 'estado_interno',
            'fecha_conversion', 'metadata', 'fecha_modificacion',
        ])

        return Response(self.get_serializer(documento).data, status=status.HTTP_201_CREATED)

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


def _generar_numero_cuenta(empresa, documento):
    base = documento.numero_comprobante or f'DOC-{documento.id}'
    numero = f'DR-{empresa.id}-{base}'[:50]
    if not CuentaPorPagar.objects.filter(empresa=empresa, numero_cuenta=numero).exists():
        return numero

    suffix = 2
    while True:
        candidate = f'{numero[:45]}-{suffix:02d}'
        if not CuentaPorPagar.objects.filter(empresa=empresa, numero_cuenta=candidate).exists():
            return candidate
        suffix += 1


def _decode_bytes(contenido: bytes) -> str:
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            return contenido.decode(encoding)
        except UnicodeDecodeError:
            continue
    return contenido.decode('utf-8', errors='replace')
