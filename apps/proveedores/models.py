from django.db import models
from django.core.validators import MinValueValidator
from django.utils.translation import gettext_lazy as _
from decimal import Decimal
import uuid


class Proveedor(models.Model):
    """
    Proveedores de la empresa
    """
    
    class TipoIdentificacionChoices(models.TextChoices):
        RUC = 'RUC', _('RUC')
        CEDULA = 'CEDULA', _('Cédula')
        PASAPORTE = 'PASAPORTE', _('Pasaporte')
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='proveedores',
        verbose_name=_('empresa')
    )
    
    tipo_identificacion = models.CharField(
        _('tipo de identificación'),
        max_length=10,
        choices=TipoIdentificacionChoices.choices,
        default=TipoIdentificacionChoices.RUC
    )
    identificacion = models.CharField(
        _('identificación'),
        max_length=13,
        db_index=True
    )
    razon_social = models.CharField(
        _('razón social'),
        max_length=300
    )
    nombre_comercial = models.CharField(
        _('nombre comercial'),
        max_length=300,
        blank=True
    )
    
    # Contacto
    direccion = models.TextField(
        _('dirección'),
        blank=True
    )
    telefono = models.CharField(
        _('teléfono'),
        max_length=50,
        blank=True
    )
    celular = models.CharField(
        _('celular'),
        max_length=50,
        blank=True
    )
    email = models.EmailField(
        _('email'),
        blank=True
    )
    
    # Información comercial
    contacto_principal = models.CharField(
        _('contacto principal'),
        max_length=200,
        blank=True
    )
    dias_credito = models.IntegerField(
        _('días de crédito'),
        default=0,
        validators=[MinValueValidator(0)]
    )
    limite_credito = models.DecimalField(
        _('límite de crédito'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    # Datos contables
    cuenta_contable = models.CharField(
        _('cuenta contable'),
        max_length=50,
        blank=True,
        help_text=_('Cuenta contable de cuentas por pagar')
    )
    
    # Control
    activo = models.BooleanField(
        _('activo'),
        default=True
    )
    notas = models.TextField(
        _('notas'),
        blank=True
    )
    
    creado_en = models.DateTimeField(_('creado en'), auto_now_add=True)
    actualizado_en = models.DateTimeField(_('actualizado en'), auto_now=True)
    
    class Meta:
        db_table = 'proveedores'
        verbose_name = _('proveedor')
        verbose_name_plural = _('proveedores')
        unique_together = [['empresa', 'identificacion']]
        ordering = ['razon_social']
        indexes = [
            models.Index(fields=['empresa', 'activo']),
            models.Index(fields=['empresa', 'identificacion']),
        ]
    
    def __str__(self):
        return f"{self.identificacion} - {self.razon_social}"


class OrdenCompra(models.Model):
    """
    Órdenes de compra a proveedores
    """
    
    class EstadoChoices(models.TextChoices):
        BORRADOR = 'BORRADOR', _('Borrador')
        ENVIADA = 'ENVIADA', _('Enviada')
        PARCIAL = 'PARCIAL', _('Recibida Parcialmente')
        RECIBIDA = 'RECIBIDA', _('Recibida Completamente')
        CANCELADA = 'CANCELADA', _('Cancelada')
    
    uuid = models.UUIDField(
        _('UUID'),
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True
    )
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='ordenes_compra',
        verbose_name=_('empresa')
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='ordenes_compra',
        verbose_name=_('proveedor')
    )
    bodega_destino = models.ForeignKey(
        'inventarios.Bodega',
        on_delete=models.PROTECT,
        related_name='ordenes_compra',
        verbose_name=_('bodega destino')
    )
    
    numero_orden = models.CharField(
        _('número de orden'),
        max_length=50,
        db_index=True
    )
    fecha_orden = models.DateField(
        _('fecha de orden')
    )
    fecha_entrega_esperada = models.DateField(
        _('fecha de entrega esperada'),
        null=True,
        blank=True
    )
    
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.BORRADOR
    )
    
    subtotal = models.DecimalField(
        _('subtotal'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    descuento = models.DecimalField(
        _('descuento'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    iva = models.DecimalField(
        _('IVA'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total = models.DecimalField(
        _('total'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    notas = models.TextField(
        _('notas'),
        blank=True
    )
    
    creado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        related_name='ordenes_compra_creadas',
        verbose_name=_('creado por')
    )
    creado_en = models.DateTimeField(_('creado en'), auto_now_add=True)
    actualizado_en = models.DateTimeField(_('actualizado en'), auto_now=True)
    
    class Meta:
        db_table = 'ordenes_compra'
        verbose_name = _('orden de compra')
        verbose_name_plural = _('órdenes de compra')
        unique_together = [['empresa', 'numero_orden']]
        ordering = ['-fecha_orden', '-numero_orden']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['empresa', 'proveedor']),
            models.Index(fields=['fecha_orden']),
        ]
    
    def __str__(self):
        return f"OC-{self.numero_orden}"
    
    def calcular_totales(self):
        """Calcula subtotal, IVA y total desde los detalles"""
        detalles = self.detalles.all()
        
        self.subtotal = sum(d.subtotal for d in detalles)
        self.iva = sum(d.iva for d in detalles)
        self.total = self.subtotal + self.iva - self.descuento
        
    def actualizar_estado_recepcion(self):
        """Actualiza el estado según las recepciones"""
        detalles = self.detalles.all()
        if not detalles:
            return
            
        total_ordenado = sum(d.cantidad for d in detalles)
        total_recibido = sum(d.cantidad_recibida for d in detalles)
        
        if total_recibido == 0:
            self.estado = self.EstadoChoices.ENVIADA
        elif total_recibido >= total_ordenado:
            self.estado = self.EstadoChoices.RECIBIDA
        else:
            self.estado = self.EstadoChoices.PARCIAL


class DetalleOrdenCompra(models.Model):
    """
    Detalle de productos en una orden de compra
    """
    
    orden_compra = models.ForeignKey(
        OrdenCompra,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('orden de compra')
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT,
        related_name='detalles_orden_compra',
        verbose_name=_('producto')
    )
    
    cantidad = models.DecimalField(
        _('cantidad'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    cantidad_recibida = models.DecimalField(
        _('cantidad recibida'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    precio_unitario = models.DecimalField(
        _('precio unitario'),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0'))]
    )
    descuento = models.DecimalField(
        _('descuento'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    aplica_iva = models.BooleanField(
        _('aplica IVA'),
        default=True
    )
    porcentaje_iva = models.DecimalField(
        _('porcentaje IVA'),
        max_digits=5,
        decimal_places=2,
        default=Decimal('15.00')
    )
    
    subtotal = models.DecimalField(
        _('subtotal'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    iva = models.DecimalField(
        _('IVA'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total = models.DecimalField(
        _('total'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    notas = models.TextField(
        _('notas'),
        blank=True
    )
    
    class Meta:
        db_table = 'detalles_orden_compra'
        verbose_name = _('detalle de orden de compra')
        verbose_name_plural = _('detalles de orden de compra')
        ordering = ['id']
    
    def __str__(self):
        return f"{self.orden_compra} - {self.producto}"
    
    def calcular_totales(self):
        """Calcula subtotal, IVA y total"""
        self.subtotal = (self.cantidad * self.precio_unitario) - self.descuento
        
        if self.aplica_iva:
            self.iva = self.subtotal * (self.porcentaje_iva / Decimal('100'))
        else:
            self.iva = Decimal('0.00')
            
        self.total = self.subtotal + self.iva
    
    def cantidad_pendiente(self):
        """Cantidad que falta por recibir"""
        return self.cantidad - self.cantidad_recibida


class RecepcionCompra(models.Model):
    """
    Recepción de mercadería de órdenes de compra
    """
    
    class EstadoChoices(models.TextChoices):
        BORRADOR = 'BORRADOR', _('Borrador')
        RECIBIDA = 'RECIBIDA', _('Recibida')
        CANCELADA = 'CANCELADA', _('Cancelada')
    
    uuid = models.UUIDField(
        _('UUID'),
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True
    )
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='recepciones_compra',
        verbose_name=_('empresa')
    )
    orden_compra = models.ForeignKey(
        OrdenCompra,
        on_delete=models.PROTECT,
        related_name='recepciones',
        verbose_name=_('orden de compra')
    )
    bodega = models.ForeignKey(
        'inventarios.Bodega',
        on_delete=models.PROTECT,
        related_name='recepciones_compra',
        verbose_name=_('bodega')
    )
    
    numero_recepcion = models.CharField(
        _('número de recepción'),
        max_length=50,
        db_index=True
    )
    fecha_recepcion = models.DateField(
        _('fecha de recepción')
    )
    
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.BORRADOR
    )
    
    # Referencia del proveedor
    numero_factura_proveedor = models.CharField(
        _('número de factura proveedor'),
        max_length=50,
        blank=True
    )
    fecha_factura_proveedor = models.DateField(
        _('fecha factura proveedor'),
        null=True,
        blank=True
    )
    
    notas = models.TextField(
        _('notas'),
        blank=True
    )
    
    recibido_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        related_name='recepciones_realizadas',
        verbose_name=_('recibido por')
    )
    creado_en = models.DateTimeField(_('creado en'), auto_now_add=True)
    actualizado_en = models.DateTimeField(_('actualizado en'), auto_now=True)
    
    class Meta:
        db_table = 'recepciones_compra'
        verbose_name = _('recepción de compra')
        verbose_name_plural = _('recepciones de compra')
        unique_together = [['empresa', 'numero_recepcion']]
        ordering = ['-fecha_recepcion', '-numero_recepcion']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['empresa', 'orden_compra']),
            models.Index(fields=['fecha_recepcion']),
        ]
    
    def __str__(self):
        return f"RC-{self.numero_recepcion}"


class DetalleRecepcion(models.Model):
    """
    Detalle de productos recibidos en una recepción
    """
    
    recepcion = models.ForeignKey(
        RecepcionCompra,
        on_delete=models.CASCADE,
        related_name='detalles',
        verbose_name=_('recepción')
    )
    detalle_orden = models.ForeignKey(
        DetalleOrdenCompra,
        on_delete=models.PROTECT,
        related_name='recepciones',
        verbose_name=_('detalle de orden')
    )
    
    cantidad_recibida = models.DecimalField(
        _('cantidad recibida'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    costo_unitario = models.DecimalField(
        _('costo unitario'),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    notas = models.TextField(
        _('notas'),
        blank=True,
        help_text=_('Observaciones sobre el producto recibido')
    )
    
    class Meta:
        db_table = 'detalles_recepcion'
        verbose_name = _('detalle de recepción')
        verbose_name_plural = _('detalles de recepción')
        ordering = ['id']
    
    def __str__(self):
        return f"{self.recepcion} - {self.detalle_orden.producto}"


class CuentaPorPagar(models.Model):
    """
    Cuentas por pagar a proveedores generadas desde recepciones
    """
    
    class EstadoChoices(models.TextChoices):
        PENDIENTE = 'PENDIENTE', _('Pendiente')
        PARCIAL = 'PARCIAL', _('Pagada Parcialmente')
        PAGADA = 'PAGADA', _('Pagada')
        ANULADA = 'ANULADA', _('Anulada')
    
    uuid = models.UUIDField(
        _('UUID'),
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True
    )
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cuentas_por_pagar',
        verbose_name=_('empresa')
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='cuentas_por_pagar',
        verbose_name=_('proveedor')
    )
    recepcion = models.OneToOneField(
        RecepcionCompra,
        on_delete=models.PROTECT,
        related_name='cuenta_por_pagar',
        verbose_name=_('recepción'),
        null=True,
        blank=True
    )
    
    numero_cuenta = models.CharField(
        _('número de cuenta'),
        max_length=50,
        db_index=True
    )
    fecha_emision = models.DateField(
        _('fecha de emisión')
    )
    fecha_vencimiento = models.DateField(
        _('fecha de vencimiento')
    )
    
    monto_total = models.DecimalField(
        _('monto total'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    monto_pagado = models.DecimalField(
        _('monto pagado'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    saldo = models.DecimalField(
        _('saldo'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    estado = models.CharField(
        _('estado'),
        max_length=20,
        choices=EstadoChoices.choices,
        default=EstadoChoices.PENDIENTE
    )
    
    notas = models.TextField(
        _('notas'),
        blank=True
    )
    
    creado_en = models.DateTimeField(_('creado en'), auto_now_add=True)
    actualizado_en = models.DateTimeField(_('actualizado en'), auto_now=True)
    
    class Meta:
        db_table = 'cuentas_por_pagar'
        verbose_name = _('cuenta por pagar')
        verbose_name_plural = _('cuentas por pagar')
        unique_together = [['empresa', 'numero_cuenta']]
        ordering = ['fecha_vencimiento', '-fecha_emision']
        indexes = [
            models.Index(fields=['empresa', 'estado']),
            models.Index(fields=['empresa', 'proveedor']),
            models.Index(fields=['fecha_vencimiento']),
            models.Index(fields=['fecha_emision']),
        ]
    
    def __str__(self):
        return f"CP-{self.numero_cuenta}"
    
    def actualizar_estado_pago(self):
        """Actualiza el estado según los pagos realizados"""
        self.saldo = self.monto_total - self.monto_pagado
        
        if self.monto_pagado == 0:
            self.estado = self.EstadoChoices.PENDIENTE
        elif self.monto_pagado >= self.monto_total:
            self.estado = self.EstadoChoices.PAGADA
            self.saldo = Decimal('0.00')
        else:
            self.estado = self.EstadoChoices.PARCIAL


class PagoProveedor(models.Model):
    """
    Pagos realizados a proveedores
    """
    
    class FormaPagoChoices(models.TextChoices):
        EFECTIVO = 'EFECTIVO', _('Efectivo')
        CHEQUE = 'CHEQUE', _('Cheque')
        TRANSFERENCIA = 'TRANSFERENCIA', _('Transferencia')
        TARJETA = 'TARJETA', _('Tarjeta de Crédito')
        NOTA_CREDITO = 'NOTA_CREDITO', _('Nota de Crédito')
    
    uuid = models.UUIDField(
        _('UUID'),
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True
    )
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='pagos_proveedores',
        verbose_name=_('empresa')
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name='pagos',
        verbose_name=_('proveedor')
    )
    cuenta_por_pagar = models.ForeignKey(
        CuentaPorPagar,
        on_delete=models.PROTECT,
        related_name='pagos',
        verbose_name=_('cuenta por pagar')
    )
    
    numero_pago = models.CharField(
        _('número de pago'),
        max_length=50,
        db_index=True
    )
    fecha_pago = models.DateField(
        _('fecha de pago')
    )
    
    forma_pago = models.CharField(
        _('forma de pago'),
        max_length=20,
        choices=FormaPagoChoices.choices
    )
    monto = models.DecimalField(
        _('monto'),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    
    # Datos adicionales según forma de pago
    numero_documento = models.CharField(
        _('número de documento'),
        max_length=100,
        blank=True,
        help_text=_('Número de cheque, transferencia, etc.')
    )
    banco = models.CharField(
        _('banco'),
        max_length=100,
        blank=True
    )
    
    notas = models.TextField(
        _('notas'),
        blank=True
    )
    
    registrado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.PROTECT,
        related_name='pagos_registrados',
        verbose_name=_('registrado por')
    )
    creado_en = models.DateTimeField(_('creado en'), auto_now_add=True)
    actualizado_en = models.DateTimeField(_('actualizado en'), auto_now=True)
    
    class Meta:
        db_table = 'pagos_proveedores'
        verbose_name = _('pago a proveedor')
        verbose_name_plural = _('pagos a proveedores')
        unique_together = [['empresa', 'numero_pago']]
        ordering = ['-fecha_pago']
        indexes = [
            models.Index(fields=['empresa', 'proveedor']),
            models.Index(fields=['empresa', 'cuenta_por_pagar']),
            models.Index(fields=['fecha_pago']),
        ]
    
    def __str__(self):
        return f"PP-{self.numero_pago}"
