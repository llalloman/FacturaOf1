from django.contrib import admin
from .models import (
    Proveedor, OrdenCompra, DetalleOrdenCompra,
    RecepcionCompra, DetalleRecepcion,
    CuentaPorPagar, PagoProveedor
)


class DetalleOrdenCompraInline(admin.TabularInline):
    model = DetalleOrdenCompra
    extra = 0
    readonly_fields = ['subtotal', 'iva', 'total']
    fields = [
        'producto', 'cantidad', 'cantidad_recibida', 'precio_unitario',
        'descuento', 'aplica_iva', 'porcentaje_iva',
        'subtotal', 'iva', 'total'
    ]


class DetalleRecepcionInline(admin.TabularInline):
    model = DetalleRecepcion
    extra = 0
    fields = ['detalle_orden', 'cantidad_recibida', 'costo_unitario', 'notas']


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = [
        'identificacion', 'razon_social', 'nombre_comercial',
        'telefono', 'email', 'dias_credito', 'limite_credito', 'activo'
    ]
    list_filter = ['activo', 'tipo_identificacion', 'empresa']
    search_fields = ['identificacion', 'razon_social', 'nombre_comercial', 'email']
    readonly_fields = ['creado_en', 'actualizado_en']
    
    fieldsets = (
        ('Identificación', {
            'fields': (
                'empresa', 'tipo_identificacion', 'identificacion',
                'razon_social', 'nombre_comercial'
            )
        }),
        ('Contacto', {
            'fields': (
                'direccion', 'telefono', 'celular', 'email', 'contacto_principal'
            )
        }),
        ('Información Comercial', {
            'fields': (
                'dias_credito', 'limite_credito', 'cuenta_contable'
            )
        }),
        ('Control', {
            'fields': ('activo', 'notas', 'creado_en', 'actualizado_en')
        }),
    )


@admin.register(OrdenCompra)
class OrdenCompraAdmin(admin.ModelAdmin):
    list_display = [
        'numero_orden', 'proveedor', 'fecha_orden',
        'bodega_destino', 'estado', 'total', 'creado_por'
    ]
    list_filter = ['estado', 'empresa', 'fecha_orden']
    search_fields = ['numero_orden', 'proveedor__razon_social']
    readonly_fields = ['uuid', 'subtotal', 'iva', 'total', 'creado_en', 'actualizado_en']
    inlines = [DetalleOrdenCompraInline]
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'uuid', 'empresa', 'proveedor', 'bodega_destino',
                'numero_orden', 'fecha_orden', 'fecha_entrega_esperada'
            )
        }),
        ('Estado', {
            'fields': ('estado',)
        }),
        ('Totales', {
            'fields': ('subtotal', 'descuento', 'iva', 'total')
        }),
        ('Información Adicional', {
            'fields': ('notas', 'creado_por', 'creado_en', 'actualizado_en')
        }),
    )


@admin.register(RecepcionCompra)
class RecepcionCompraAdmin(admin.ModelAdmin):
    list_display = [
        'numero_recepcion', 'orden_compra', 'fecha_recepcion',
        'bodega', 'estado', 'recibido_por'
    ]
    list_filter = ['estado', 'empresa', 'fecha_recepcion']
    search_fields = ['numero_recepcion', 'numero_factura_proveedor']
    readonly_fields = ['uuid', 'creado_en', 'actualizado_en']
    inlines = [DetalleRecepcionInline]
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'uuid', 'empresa', 'orden_compra', 'bodega',
                'numero_recepcion', 'fecha_recepcion'
            )
        }),
        ('Estado', {
            'fields': ('estado',)
        }),
        ('Referencia Proveedor', {
            'fields': ('numero_factura_proveedor', 'fecha_factura_proveedor')
        }),
        ('Información Adicional', {
            'fields': ('notas', 'recibido_por', 'creado_en', 'actualizado_en')
        }),
    )


@admin.register(CuentaPorPagar)
class CuentaPorPagarAdmin(admin.ModelAdmin):
    list_display = [
        'numero_cuenta', 'proveedor', 'fecha_emision',
        'fecha_vencimiento', 'monto_total', 'monto_pagado',
        'saldo', 'estado'
    ]
    list_filter = ['estado', 'empresa', 'fecha_vencimiento']
    search_fields = ['numero_cuenta', 'proveedor__razon_social']
    readonly_fields = ['uuid', 'monto_pagado', 'saldo', 'creado_en', 'actualizado_en']
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'uuid', 'empresa', 'proveedor', 'recepcion',
                'numero_cuenta', 'fecha_emision', 'fecha_vencimiento'
            )
        }),
        ('Montos', {
            'fields': ('monto_total', 'monto_pagado', 'saldo')
        }),
        ('Estado', {
            'fields': ('estado',)
        }),
        ('Información Adicional', {
            'fields': ('notas', 'creado_en', 'actualizado_en')
        }),
    )


@admin.register(PagoProveedor)
class PagoProveedorAdmin(admin.ModelAdmin):
    list_display = [
        'numero_pago', 'proveedor', 'cuenta_por_pagar',
        'fecha_pago', 'forma_pago', 'monto', 'registrado_por'
    ]
    list_filter = ['forma_pago', 'empresa', 'fecha_pago']
    search_fields = ['numero_pago', 'numero_documento', 'proveedor__razon_social']
    readonly_fields = ['uuid', 'creado_en', 'actualizado_en']
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'uuid', 'empresa', 'proveedor', 'cuenta_por_pagar',
                'numero_pago', 'fecha_pago'
            )
        }),
        ('Pago', {
            'fields': ('forma_pago', 'monto', 'numero_documento', 'banco')
        }),
        ('Información Adicional', {
            'fields': ('notas', 'registrado_por', 'creado_en', 'actualizado_en')
        }),
    )
