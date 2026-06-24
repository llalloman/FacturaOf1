from django.contrib import admin

from apps.pagos.models import PagoConfiguracion, PagoOnline


@admin.register(PagoConfiguracion)
class PagoConfiguracionAdmin(admin.ModelAdmin):
    list_display = ['empresa', 'cuenta_payphone', 'caja_ventas', 'usuario_ventas', 'activo']
    list_filter = ['activo', 'auto_generar_venta_firmas', 'auto_generar_venta_suscripciones']
    search_fields = ['empresa__razon_social', 'empresa__ruc']


@admin.register(PagoOnline)
class PagoOnlineAdmin(admin.ModelAdmin):
    list_display = ['client_transaction_id', 'empresa', 'origen', 'estado', 'total_amount', 'confirmed_at', 'applied_at']
    list_filter = ['provider', 'metodo', 'estado', 'origen']
    search_fields = ['client_transaction_id', 'provider_transaction_id', 'authorization_code', 'origen_id']
    readonly_fields = ['created_at', 'updated_at']
