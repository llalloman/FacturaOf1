from rest_framework import serializers

from .models import DocumentoRecibidoDetalle, DocumentoRecibidoImpuesto, DocumentoRecibidoSRI


class DocumentoRecibidoDetalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoRecibidoDetalle
        fields = [
            'id', 'codigo_principal', 'descripcion', 'cantidad',
            'precio_unitario', 'descuento', 'base_imponible', 'iva', 'ice', 'total',
        ]


class DocumentoRecibidoImpuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoRecibidoImpuesto
        fields = ['id', 'codigo', 'codigo_porcentaje', 'tarifa', 'base_imponible', 'valor']


class DocumentoRecibidoSRISerializer(serializers.ModelSerializer):
    detalles = DocumentoRecibidoDetalleSerializer(many=True, read_only=True)
    impuestos = DocumentoRecibidoImpuestoSerializer(many=True, read_only=True)
    tipo_comprobante_display = serializers.CharField(source='get_tipo_comprobante_display', read_only=True)
    estado_interno_display = serializers.CharField(source='get_estado_interno_display', read_only=True)
    estado_sri_display = serializers.CharField(source='get_estado_sri_display', read_only=True)

    class Meta:
        model = DocumentoRecibidoSRI
        fields = [
            'id', 'tipo_comprobante', 'tipo_comprobante_display',
            'clave_acceso', 'numero_autorizacion', 'numero_comprobante',
            'ruc_emisor', 'razon_social_emisor', 'ruc_receptor', 'razon_social_receptor',
            'fecha_emision', 'fecha_autorizacion',
            'estado_sri', 'estado_sri_display',
            'estado_interno', 'estado_interno_display',
            'subtotal_0', 'subtotal_iva', 'subtotal_no_objeto', 'subtotal_exento',
            'iva', 'ice', 'total',
            'nombre_archivo', 'observaciones', 'errores', 'metadata',
            'fecha_creacion', 'fecha_modificacion',
            'detalles', 'impuestos',
        ]
        read_only_fields = fields
