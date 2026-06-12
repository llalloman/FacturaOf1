"""Modelos base para orquestacion de control (no invasivos)."""

from django.conf import settings
from django.db import models


class PolicyRule(models.Model):
    """Reglas de negocio para descuentos, aprobaciones y alertas."""

    class RuleType(models.TextChoices):
        DISCOUNT = 'DISCOUNT', 'Descuento'
        APPROVAL = 'APPROVAL', 'Aprobacion'
        ALERT = 'ALERT', 'Alerta'

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='policy_rules',
    )
    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=20, choices=RuleType.choices)
    criterios = models.JSONField(default=dict, blank=True)
    accion = models.JSONField(default=dict, blank=True)
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_policy_rule'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['empresa', 'tipo', 'activa'], name='idx_policy_emp_tipo'),
        ]

    def __str__(self):
        return f"{self.empresa_id}::{self.nombre} ({self.tipo})"


class Workflow(models.Model):
    """Definicion de workflow por empresa."""

    class WorkflowType(models.TextChoices):
        ORDER_TO_CASH = 'ORDER_TO_CASH', 'Order to Cash'
        PROCURE_TO_PAY = 'PROCURE_TO_PAY', 'Procure to Pay'

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='workflows',
    )
    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=30, choices=WorkflowType.choices)
    estados = models.JSONField(default=list, blank=True)
    transiciones = models.JSONField(default=list, blank=True)
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_workflow'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.empresa_id}::{self.nombre}"


class WorkflowTransition(models.Model):
    """Transiciones explicitas de un workflow."""

    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='workflow_transitions',
    )
    de_estado = models.CharField(max_length=50)
    a_estado = models.CharField(max_length=50)
    condicion = models.JSONField(default=dict, blank=True)
    ejecutor_rol = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_workflow_transition'
        unique_together = (('workflow', 'de_estado', 'a_estado'),)


class ProcessInstance(models.Model):
    """Instancia de ejecucion de un workflow para un documento."""

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='process_instances',
    )
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.PROTECT,
        related_name='instances',
    )
    referencia_documento = models.CharField(max_length=80)
    estado_actual = models.CharField(max_length=50)
    iniciado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='process_instances_started',
    )
    iniciado_at = models.DateTimeField(auto_now_add=True)
    completado_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'core_process_instance'
        ordering = ['-iniciado_at']
        indexes = [
            models.Index(fields=['empresa', 'estado_actual'], name='idx_proc_emp_estado'),
        ]


class StateChange(models.Model):
    """Auditoria de cambios de estado de un proceso."""

    process_instance = models.ForeignKey(
        ProcessInstance,
        on_delete=models.CASCADE,
        related_name='state_changes',
    )
    de_estado = models.CharField(max_length=50)
    a_estado = models.CharField(max_length=50)
    razon = models.TextField(blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='state_changes_performed',
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_state_change'
        ordering = ['-timestamp']


class ApprovalTicket(models.Model):
    """Ticket de aprobacion de acciones sensibles (ej. descuento alto)."""

    class Status(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        APROBADO = 'APROBADO', 'Aprobado'
        RECHAZADO = 'RECHAZADO', 'Rechazado'

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='approval_tickets',
    )
    documento_tipo = models.CharField(max_length=40)
    documento_id = models.CharField(max_length=40)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_requests',
    )
    aprobador_requerido_rol = models.CharField(max_length=30)
    aprobador_actual = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_decisions',
    )
    estado = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDIENTE)
    contexto = models.JSONField(default=dict, blank=True)
    razon = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'core_approval_ticket'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['empresa', 'estado'], name='idx_approval_emp_est'),
        ]


class AuditLog(models.Model):
    """Log de auditoria append-only para acciones transversales."""

    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='audit_logs',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    accion = models.CharField(max_length=60)
    modulo = models.CharField(max_length=40)
    referencia = models.CharField(max_length=80, blank=True)
    datos = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_audit_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['empresa', 'created_at'], name='idx_audit_emp_date'),
            models.Index(fields=['usuario', 'created_at'], name='idx_audit_usr_date'),
        ]
