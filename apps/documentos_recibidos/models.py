from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _


class DocumentoRecibidoSRI(models.Model):
    class TipoComprobanteChoices(models.TextChoices):
        FACTURA = '01', _('Factura')
        NOTA_CREDITO = '04', _('Nota de crédito')
        NOTA_DEBITO = '05', _('Nota de débito')
        GUIA_REMISION = '06', _('Guía de remisión')
        RETENCION = '07', _('Comprobante de retención')
        LIQUIDACION_COMPRA = '03', _('Liquidación de compra')
        DESCONOCIDO = '00', _('Desconocido')

    class EstadoInternoChoices(models.TextChoices):
        RECIBIDO = 'RECIBIDO', _('Recibido')
        VALIDADO = 'VALIDADO', _('Validado')
        DUPLICADO = 'DUPLICADO', _('Duplicado')
        REQUIERE_REVISION = 'REQUIERE_REVISION', _('Requiere revisión')
        CONVERTIDO = 'CONVERTIDO', _('Convertido')
        DESCARTADO = 'DESCARTADO', _('Descartado')

    class EstadoSRIChoices(models.TextChoices):
        SIN_VALIDAR = 'SIN_VALIDAR', _('Sin validar')
        AUTORIZADO = 'AUTORIZADO', _('Autorizado')
        NO_AUTORIZADO = 'NO_AUTORIZADO', _('No autorizado')
        ERROR = 'ERROR', _('Error')

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='documentos_recibidos_sri',
        verbose_name=_('empresa'),
    )
    usuario_creador = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_recibidos_sri',
        verbose_name=_('usuario creador'),
    )

    tipo_comprobante = models.CharField(
        _('tipo de comprobante'),
        max_length=2,
        choices=TipoComprobanteChoices.choices,
        default=TipoComprobanteChoices.DESCONOCIDO,
    )
    clave_acceso = models.CharField(_('clave de acceso'), max_length=49, db_index=True)
    numero_autorizacion = models.CharField(_('número de autorización'), max_length=49, blank=True)
    numero_comprobante = models.CharField(_('número de comprobante'), max_length=25, blank=True, db_index=True)

    ruc_emisor = models.CharField(_('RUC emisor'), max_length=13, blank=True, db_index=True)
    razon_social_emisor = models.CharField(_('razón social emisor'), max_length=300, blank=True)
    ruc_receptor = models.CharField(_('RUC receptor'), max_length=20, blank=True, db_index=True)
    razon_social_receptor = models.CharField(_('razón social receptor'), max_length=300, blank=True)

    fecha_emision = models.DateField(_('fecha de emisión'), null=True, blank=True)
    fecha_autorizacion = models.DateTimeField(_('fecha de autorización'), null=True, blank=True)

    estado_sri = models.CharField(
        _('estado SRI'),
        max_length=20,
        choices=EstadoSRIChoices.choices,
        default=EstadoSRIChoices.SIN_VALIDAR,
    )
    estado_interno = models.CharField(
        _('estado interno'),
        max_length=30,
        choices=EstadoInternoChoices.choices,
        default=EstadoInternoChoices.RECIBIDO,
    )

    subtotal_0 = models.DecimalField(_('subtotal 0%'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    subtotal_iva = models.DecimalField(_('subtotal IVA'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    subtotal_no_objeto = models.DecimalField(_('subtotal no objeto'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    subtotal_exento = models.DecimalField(_('subtotal exento'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    iva = models.DecimalField(_('IVA'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    ice = models.DecimalField(_('ICE'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(_('total'), max_digits=14, decimal_places=2, default=Decimal('0.00'))

    nombre_archivo = models.CharField(_('nombre de archivo'), max_length=255, blank=True)
    xml_original = models.TextField(_('XML original'))
    observaciones = models.TextField(_('observaciones'), blank=True)
    errores = models.JSONField(_('errores'), default=list, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)

    proveedor = models.ForeignKey(
        'proveedores.Proveedor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_recibidos_sri',
        verbose_name=_('proveedor'),
    )
    cuenta_por_pagar = models.OneToOneField(
        'proveedores.CuentaPorPagar',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documento_recibido_sri',
        verbose_name=_('cuenta por pagar'),
    )
    fecha_conversion = models.DateTimeField(_('fecha de conversion'), null=True, blank=True)

    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)

    class Meta:
        db_table = 'documentos_recibidos_sri'
        verbose_name = _('documento recibido SRI')
        verbose_name_plural = _('documentos recibidos SRI')
        ordering = ['-fecha_emision', '-fecha_creacion']
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'clave_acceso'],
                name='uniq_documento_recibido_empresa_clave',
            ),
        ]
        indexes = [
            models.Index(fields=['empresa', 'estado_interno']),
            models.Index(fields=['empresa', 'fecha_emision']),
            models.Index(fields=['empresa', 'tipo_comprobante']),
            models.Index(fields=['empresa', 'ruc_emisor']),
        ]

    def __str__(self):
        return f'{self.numero_comprobante or self.clave_acceso} - {self.razon_social_emisor}'


class DocumentoRecibidoDetalle(models.Model):
    documento = models.ForeignKey(
        DocumentoRecibidoSRI,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('documento'),
    )
    codigo_principal = models.CharField(_('código principal'), max_length=60, blank=True)
    descripcion = models.CharField(_('descripción'), max_length=500)
    cantidad = models.DecimalField(_('cantidad'), max_digits=14, decimal_places=6, default=Decimal('0.00'))
    precio_unitario = models.DecimalField(_('precio unitario'), max_digits=14, decimal_places=6, default=Decimal('0.00'))
    descuento = models.DecimalField(_('descuento'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    base_imponible = models.DecimalField(_('base imponible'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    iva = models.DecimalField(_('IVA'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    ice = models.DecimalField(_('ICE'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(_('total'), max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'documentos_recibidos_detalles'
        ordering = ['id']

    def __str__(self):
        return self.descripcion


class DocumentoRecibidoImpuesto(models.Model):
    documento = models.ForeignKey(
        DocumentoRecibidoSRI,
        on_delete=models.CASCADE,
        related_name='impuestos',
        verbose_name=_('documento'),
    )
    codigo = models.CharField(_('código'), max_length=5, blank=True)
    codigo_porcentaje = models.CharField(_('código porcentaje'), max_length=5, blank=True)
    tarifa = models.DecimalField(_('tarifa'), max_digits=8, decimal_places=2, default=Decimal('0.00'))
    base_imponible = models.DecimalField(_('base imponible'), max_digits=14, decimal_places=2, default=Decimal('0.00'))
    valor = models.DecimalField(_('valor'), max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'documentos_recibidos_impuestos'
        ordering = ['id']

    def __str__(self):
        return f'{self.codigo}-{self.codigo_porcentaje}: {self.valor}'
