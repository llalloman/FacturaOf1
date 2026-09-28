"""
Modelos de Usuario - Sistema Multi-tenant
"""
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class UsuarioManager(BaseUserManager):
    """Manager personalizado para el modelo Usuario"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('El email es obligatorio'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('rol', 'SUPER_ADMIN')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        
        return self.create_user(email, password, **extra_fields)


class Usuario(AbstractUser):
    """
    Modelo de Usuario personalizado con soporte multi-tenant
    """
    
    class RolChoices(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', _('Super Administrador')  # Administra todo el sistema
        ADMIN_EMPRESA = 'ADMIN_EMPRESA', _('Administrador de Empresa')  # Administra una empresa
        CONTADOR = 'CONTADOR', _('Contador')  # Puede facturar y ver reportes
        VENDEDOR = 'VENDEDOR', _('Vendedor')  # Solo puede crear facturas
        CONSULTOR = 'CONSULTOR', _('Consultor')  # Solo puede ver reportes
        FIRMADOR = 'FIRMADOR', _('Usuario Firmador')  # Acceso solo al firmador PDF
    
    username = None  # Removemos username
    email = models.EmailField(_('email'), unique=True)
    
    # Información personal
    cedula = models.CharField(_('cédula'), max_length=13, unique=True, null=True, blank=True)
    telefono = models.CharField(_('teléfono'), max_length=15, blank=True)
    
    # Rol y empresa
    rol = models.CharField(_('rol'), max_length=20, choices=RolChoices.choices, default=RolChoices.VENDEDOR)
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='usuarios',
        null=True,
        blank=True,
        verbose_name=_('empresa')
    )
    
    # Metadata
    is_active = models.BooleanField(_('activo'), default=True)
    fecha_registro = models.DateTimeField(_('fecha de registro'), auto_now_add=True)
    ultima_actividad = models.DateTimeField(_('última actividad'), auto_now=True)

    # Verificación de email
    email_verificado = models.BooleanField(_('email verificado'), default=False)
    codigo_verificacion = models.CharField(_('código de verificación'), max_length=8, blank=True)
    codigo_verificacion_expira = models.DateTimeField(_('expiración código'), null=True, blank=True)
    intentos_reenvio = models.IntegerField(_('intentos de reenvío'), default=0)
    ultimo_reenvio = models.DateTimeField(_('último reenvío'), null=True, blank=True)

    # Recuperación de contraseña
    password_temporal = models.CharField(_('contraseña temporal'), max_length=128, blank=True)
    password_temporal_expira = models.DateTimeField(_('expiración contraseña temporal'), null=True, blank=True)
    debe_cambiar_password = models.BooleanField(_('debe cambiar contraseña'), default=False)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    objects = UsuarioManager()
    
    class Meta:
        verbose_name = _('usuario')
        verbose_name_plural = _('usuarios')
        ordering = ['-fecha_registro']
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email
    
    @property
    def es_super_admin(self):
        return self.rol == self.RolChoices.SUPER_ADMIN
    
    @property
    def es_admin_empresa(self):
        return self.rol == self.RolChoices.ADMIN_EMPRESA
    
    @property
    def puede_facturar(self):
        return self.rol in [
            self.RolChoices.ADMIN_EMPRESA,
            self.RolChoices.CONTADOR,
            self.RolChoices.VENDEDOR
        ]
    
    def tiene_acceso_empresa(self, empresa):
        """Verifica si el usuario tiene acceso a una empresa específica"""
        if self.es_super_admin:
            return True
        if self.empresa_id == empresa.id:
            return True
        return self.membresias.filter(empresa=empresa, activa=True).exists()


class EmpresaMembresia(models.Model):
    """Acceso de un usuario a una empresa, compatible con Usuario.empresa."""

    class RolEmpresaChoices(models.TextChoices):
        ADMIN_EMPRESA = 'ADMIN_EMPRESA', _('Administrador de Empresa')
        CONTADOR = 'CONTADOR', _('Contador')
        VENDEDOR = 'VENDEDOR', _('Vendedor')
        CONSULTOR = 'CONSULTOR', _('Consultor')
        FIRMADOR = 'FIRMADOR', _('Usuario Firmador')

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='membresias',
        verbose_name=_('usuario'),
    )
    empresa = models.ForeignKey(
        'empresas.Empresa', on_delete=models.CASCADE, related_name='membresias',
        verbose_name=_('empresa'),
    )
    rol_empresa = models.CharField(
        _('rol dentro de la empresa'), max_length=20,
        choices=RolEmpresaChoices.choices,
    )
    modulos = models.JSONField(
        _('módulos autorizados'), default=list, blank=True,
        help_text=_('Códigos de módulos con alcance explícito para esta membresía.'),
    )
    activa = models.BooleanField(_('activa'), default=True)
    predeterminada = models.BooleanField(_('empresa predeterminada'), default=False)
    metadatos = models.JSONField(_('metadatos de auditoría'), default=dict, blank=True)
    creada_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='membresias_creadas', verbose_name=_('creada por'),
    )
    fecha_creacion = models.DateTimeField(_('fecha de creación'), auto_now_add=True)
    fecha_modificacion = models.DateTimeField(_('fecha de modificación'), auto_now=True)

    class Meta:
        verbose_name = _('membresía de empresa')
        verbose_name_plural = _('membresías de empresa')
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'empresa'], name='uniq_usuario_empresa_membresia',
            ),
        ]
        indexes = [
            models.Index(fields=['usuario', 'activa'], name='idx_memb_usuario_activa'),
            models.Index(fields=['empresa', 'activa'], name='idx_memb_empresa_activa'),
        ]

    def __str__(self):
        return f'{self.usuario_id} -> {self.empresa_id} ({self.rol_empresa})'


class AccesoPlataforma(models.Model):
    """Rol de OF1 Solutions fuera del rol operativo de una empresa."""

    class RolChoices(models.TextChoices):
        ADMIN_GLOBAL = 'ADMIN_GLOBAL', _('Administrador global')
        SOPORTE = 'SOPORTE', _('Soporte de plataforma')
        FACTURACION = 'FACTURACION', _('Facturación de plataforma')
        AUDITOR = 'AUDITOR', _('Auditor de plataforma')

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='accesos_plataforma',
    )
    rol = models.CharField(max_length=20, choices=RolChoices.choices)
    alcances = models.JSONField(
        default=list, blank=True,
        help_text=_('Capacidades explícitas: empresas, suscripciones, auditoría, soporte, etc.'),
    )
    activa = models.BooleanField(default=True)
    creada_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='accesos_plataforma_creados',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('acceso de plataforma')
        verbose_name_plural = _('accesos de plataforma')
        constraints = [
            models.UniqueConstraint(fields=['usuario', 'rol'], name='uniq_usuario_rol_plataforma'),
        ]
        indexes = [models.Index(fields=['usuario', 'activa'], name='idx_acceso_plataforma_activa')]

    def __str__(self):
        return f'{self.usuario_id} - {self.rol}'
