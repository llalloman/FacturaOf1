"""
Django Admin configuration for Ventas app
"""
from django.contrib import admin
from .models import Caja, AperturaCaja, Venta, DetalleVenta, PagoVenta, MovimientoCaja


@admin.register(Caja)
class CajaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'codigo', 'empresa', 'bodega', 'activa', 'fecha_creacion']
    list_filter = ['empresa', 'activa']
    search_fields = ['nombre', 'codigo']


@admin.register(AperturaCaja)
class AperturaCajaAdmin(admin.ModelAdmin):
    list_display = ['id', 'caja', 'usuario', 'fecha_apertura', 'fecha_cierre', 'estado', 'monto_apertura', 'monto_cierre']
    list_filter = ['estado', 'fecha_apertura']
    search_fields = ['caja__nombre', 'usuario__username']
    date_hierarchy = 'fecha_apertura'


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0


class PagoVentaInline(admin.TabularInline):
    model = PagoVenta
    extra = 1


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ['numero_venta', 'caja', 'cliente', 'fecha_venta', 'total', 'estado']
    list_filter = ['estado', 'fecha_venta', 'caja']
    search_fields = ['numero_venta', 'cliente__razon_social', 'uuid']
    date_hierarchy = 'fecha_venta'
    inlines = [DetalleVentaInline, PagoVentaInline]


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    list_display = ['apertura_caja', 'tipo', 'monto', 'fecha_movimiento', 'usuario']
    list_filter = ['tipo', 'fecha_movimiento']
    search_fields = ['descripcion', 'referencia']
    date_hierarchy = 'fecha_movimiento'
