from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(BaseUserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'rol', 'empresa', 'is_active']
    list_filter = ['rol', 'is_active', 'is_staff', 'empresa']
    search_fields = ['email', 'first_name', 'last_name', 'cedula']
    ordering = ['-fecha_registro']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Información Personal', {'fields': ('first_name', 'last_name', 'cedula', 'telefono')}),
        ('Permisos', {'fields': ('rol', 'empresa', 'is_active', 'is_staff', 'is_superuser')}),
        ('Fechas', {'fields': ('last_login', 'fecha_registro', 'ultima_actividad')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2', 'rol', 'empresa'),
        }),
    )
    
    readonly_fields = ['fecha_registro', 'ultima_actividad', 'last_login']
