"""
Django Admin configuration for Inventarios app
"""
from django.contrib import admin
from .models import Bodega, StockProducto, MovimientoInventario, TransferenciaInventario, DetalleTransferencia


@admin.register(Bodega)
class BodegaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'codigo', 'empresa', 'activa', 'fecha_creacion']
    list_filter = ['empresa', 'activa']
    search_fields = ['nombre', 'codigo']


@admin.register(StockProducto)
class StockProductoAdmin(admin.ModelAdmin):
    list_display = ['producto', 'bodega', 'cantidad', 'costo_promedio', 'ultima_actualizacion']
    list_filter = ['bodega']
    search_fields = ['producto__nombre', 'producto__codigo']


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = ['producto', 'bodega', 'tipo_movimiento', 'cantidad', 'fecha_movimiento', 'usuario']
    list_filter = ['tipo_movimiento', 'bodega', 'fecha_movimiento']
    search_fields = ['producto__nombre', 'documento_referencia']
    date_hierarchy = 'fecha_movimiento'


class DetalleTransferenciaInline(admin.TabularInline):
    model = DetalleTransferencia
    extra = 1


@admin.register(TransferenciaInventario)
class TransferenciaInventarioAdmin(admin.ModelAdmin):
    list_display = ['numero_transferencia', 'bodega_origen', 'bodega_destino', 'estado', 'fecha_envio', 'usuario_envia']
    list_filter = ['estado', 'fecha_envio']
    inlines = [DetalleTransferenciaInline]
