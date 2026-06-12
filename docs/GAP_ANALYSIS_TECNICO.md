# Gap Analysis Técnico — De Estado Actual a Ecosistema

## 1. Data Model Gaps (Modelos Django)

### 1.1 Orquestación de Procesos

**Gap:** No hay concepto de "flujo" o "workflow" centralizado.

**Modelos a crear/extender:**
```python
# Nueva tabla: Policy Rule (descuentos, aprobaciones, etc)
class PolicyRule(models.Model):
    empresa = ForeignKey(Empresa)
    tipo = Choice(
        'DESCUENTO_VOLUMEN',
        'DESCUENTO_CLIENTE',
        'DESCUENTO_MANUAL_APROBACION',
        'APROBACION_COMPRA',
        'APROBACION_NOTA_CREDITO',
        'ALERTA_MARGEN_BAJO'
    )
    condicion = JSONField()  # {"cliente_tipo": "VVIP", "descuento_max": 20}
    accion = JSONField()     # {"tipo": "auto_descuento", "valor": 10}
    requiere_aprobacion = BooleanField()
    rol_aprobador = ForeignKey(Rol)
    orden = IntegerField()
    activa = BooleanField(default=True)
    created_at = DateTimeField(auto_now_add=True)

# Nueva tabla: Workflow / Ticket de Aprobación
class ApprovalTicket(models.Model):
    empresa = ForeignKey(Empresa)
    contenido_type = ForeignKey(ContentType)  # Factura, NotaCredito, etc
    objeto_id = IntegerField()
    tipo_aprobacion = Choice(...)
    estado = Choice('PENDIENTE', 'APROBADO', 'RECHAZADO')
    solicitante = ForeignKey(User)
    aprobador = ForeignKey(User)
    contexto = JSONField()  # {"descuento": 15, "motivo": "cliente VIP"}
    comentario_aprobador = TextField(blank=True)
    created_at = DateTimeField(auto_now_add=True)
    approved_at = DateTimeField(null=True)

# Nueva tabla: Audit Log (inmutable)
class AuditLog(models.Model):
    empresa = ForeignKey(Empresa)
    usuario = ForeignKey(User)
    contenido_type = ForeignKey(ContentType)
    objeto_id = IntegerField()
    accion = Choice(
        'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT',
        'FACTURAR', 'ANULAR', 'CAMBIAR_PRECIO'
    )
    cambios = JSONField()  # {"campo": "precio", "antes": 100, "después": 95}
    timestamp = DateTimeField(auto_now_add=True)
    ip = GenericIPAddressField(null=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [Index(fields=['empresa', 'timestamp'])]
```

**Estado actual:** No existen estas tablas.
**Impacto:** Sin ellas, no hay control centralizado ni auditoría.
**Timeline:** 2 horas modelo + migraciones.

---

### 1.2 Descuentos y Políticas

**Gap:** Hoy `aplicarDescuento` es un simple número. Sin política de negocio.

**Extender:**
```python
# En LineaFactura, LineaPedido, LineaCarrito
descuento_monto = DecimalField()  # Ya existe
descuento_porcentaje = DecimalField()  # Nueva
descuento_tipo = Choice('MONTO', 'PORCENTAJE', 'PRECIO_FINAL')  # Nueva
descuento_razon = Choice(
    'POLITICA_AUTOMATICA',
    'CLIENTE_VIP', 
    'VOLUMEN',
    'MANUAL_APROBADO',
    'MANUAL_RECHAZADO'
)  # Nueva
policy_rule = ForeignKey(PolicyRule, null=True)  # Nueva
aprobacion_ticket = ForeignKey(ApprovalTicket, null=True)  # Nueva
```

**Estado actual:** Solo existe `descuento` numérico sin contexto.
**Impacto:** Imposible saber por qué está el descuento o validar políticas.
**Timeline:** 1 hora cambio modelos + migración.

---

### 1.3 Centro de Control SRI

**Gap:** No hay visibilidad centralizada de intentos de envío a SRI.

**Crear:**
```python
class SRIDocumentLog(models.Model):
    empresa = ForeignKey(Empresa)
    factura = ForeignKey(Factura)
    intento_numero = IntegerField()
    estado_sri = Choice(
        'ACEPTADO',
        'RECHAZADO',
        'CONTINGENCIA',
        'ENVIADO',
        'PENDIENTE'
    )
    codigo_respuesta_sri = CharField()  # Ej: 20, 26, etc
    mensaje_error = TextField()
    json_enviado = JSONField()  # Lo que se envió a SRI
    json_respuesta = JSONField()  # Lo que retornó SRI
    timestamp = DateTimeField(auto_now_add=True)
    reintentar_at = DateTimeField(null=True)  # Próximo intento
    resuelto = BooleanField(default=False)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [Index(fields=['empresa', 'estado_sri'])]
```

**Estado actual:** Hoy no se registra auditoría de intentos SRI.
**Impacto:** Cuando falla, no hay traza de qué pasó.
**Timeline:** 1 hora modelo + integración con facturacion/tasks.py.

---

### 1.4 CRM Prospecto → Cliente

**Gap:** No hay módulo de prospectiva ni motivos de pérdida.

**Crear:**
```python
class Prospecto(models.Model):
    empresa = ForeignKey(Empresa)
    nombre_empresa = CharField()
    contacto = CharField()
    email = EmailField()
    telefono = CharField()
    ruc_id = CharField(unique_for_empresa=True)
    estado = Choice('PROSPECTO', 'CONVERTIDO_A_CLIENTE', 'PERDIDO')
    convertido_a_cliente_en = DateTimeField(null=True)
    cliente = ForeignKey(Cliente, null=True, on_delete=SET_NULL)
    
    class Meta:
        unique_together = ('empresa', 'ruc_id')

class Cotizacion(models.Model & ProspectoMixin):
    prospecto_o_cliente = GenericForeignKey(...)  # Prospecto O Cliente
    
class OportunidadPerdida(models.Model):
    prospecto = ForeignKey(Prospecto)
    cotizacion = ForeignKey(Cotizacion, null=True)
    razon_perdida = Choice(
        'PRECIO_ALTO',
        'COMPETENCIA',
        'NO_RESPONDE',
        'CANCELADO_POR_CLIENTE',
        'NO_CALIFICA'
    )
    descripcion = TextField()
    fecha_perdida = DateTimeField(auto_now_add=True)
    vendedor_encargado = ForeignKey(User)
```

**Estado actual:** No existe este módulo.
**Impacto:** Venta ciega; no sabemos por qué ganamos/perdemos.
**Timeline:** 2-3 horas modelado + UI mínima.

---

## 2. API Gaps (REST endpoints)

**Gap:** No hay endpoint centralizado para "control" (dashboards, alertas, auditoría).

### Crear: `/api/control/` namespace

```python
# Dashboards por rol
GET /api/control/dashboard/gerente/
  Response: {"ingresos_dia": 1240, "gastos": 340, "margen": "27%", "alertas": [...]}

GET /api/control/dashboard/contador/
  Response: {"cierre_diario": {...}, "cxc_vencer": [...], "cxp_vencer": [...]}

GET /api/control/dashboard/vendedor/
  Response: {"mi_cartera": [...], "oportunidades": [...], "comision": "..."}

# Alertas
GET /api/control/alertas/?rol=GERENTE&tipo=NEGOCIO
  Response: [
    {"tipo": "CLIENTE_MOROSO", "cliente": {...}, "dias_atraso": 35},
    {"tipo": "MARGEN_BAJO", "factura": {...}, "margen_pct": 5},
    ...
  ]

# SRI control
GET /api/control/sri/estado/?empresa_id=1
  Response: {
    "ultimos_documentos": [...],  # Últimos 50
    "aceptados": 980,
    "rechazados": 12,
    "contingencia": 0,
    "ultimos_rechazos": [...]
  }

POST /api/control/sri/reintentar/ {factura_id, ...}
  Action: reenvía a SRI con validaciones previas

# Auditoría
GET /api/control/auditoria/?modelo=Factura&objeto_id=123
  Response: [
    {"timestamp": "...", "usuario": "...", "accion": "CREATE", "cambios": {...}},
    ...
  ]

# Aprobaciones
GET /api/control/aprobaciones/?estado=PENDIENTE&rol=ADMIN
  Response: [{...}]

POST /api/control/aprobaciones/123/aprobar/ {"comentario": "OK"}
POST /api/control/aprobaciones/123/rechazar/ {"comentario": "Motivo de rechazo"}

# Políticas
GET /api/control/politicas/?tipo=DESCUENTO
  Response: [{...}]

POST /api/control/politicas/ {...}  # Admin only
```

**Estado actual:** Estos endpoints no existen; todo es scatter.
**Impacto:** No hay API unificada para control → frontend debe hacer N llamadas.
**Timeline:** 4-6 horas arquitectura + implementación.

---

## 3. Frontend Gaps

### 3.1 Dashboards por Rol
**Gap:** Solo existe un dashboard general.
**Crear:**
- `web-admin/src/pages/dashboards/GerencialDashboard.tsx`
- `web-admin/src/pages/dashboards/ContadorDashboard.tsx`
- `web-admin/src/pages/dashboards/VendedorDashboard.tsx`
- (+ pos-client/src/pages/CajaDashboard.tsx para caja)

**Timeline:** 6-8 horas (4 dashboards × 1.5-2h c/u)

### 3.2 Centro de Control SRI
**Gap:** No existe UI/UX para ver estado SRI.
**Crear:**
- `web-admin/src/pages/sri/ControlSRI.tsx` (tabla de últimos docs, filtros, reintentos)
- `web-admin/src/pages/sri/DiagnosticoRechazo.tsx` (modal con sugerencias)

**Timeline:** 3-4 horas

### 3.3 Matriz de Aprobación
**Gap:** Sin UI de aprobaciones.
**Crear:**
- `web-admin/src/pages/aprobaciones/AprobacionesPendientes.tsx` (lista filtrable)
- Modal de aprobación (generic, reutilizable en Factura, NotaCredito, Compra, etc)

**Timeline:** 3-4 horas

### 3.4 Administración de Políticas
**Gap:** Sin UI para gestionar descuentos/aprobaciones/alertas.
**Crear:**
- `web-admin/src/pages/admin/Politicas.tsx` (CRUD de rules)

**Timeline:** 2-3 horas

---

## 4. Backend Tasks/Jobs (Celery)

**Gap:** No hay jobs automáticos para alertas, reintentos, validaciones.

**Crear en `apps/core/tasks.py`:**

```python
@periodic_task(run_every=crontab(minute=0))  # Cada hora
def generar_alertas_negocio():
    """Clientes morosos, margen bajo, CxP/CxC por vencer, etc."""
    
@periodic_task(run_every=crontab(minute=0, hour=18))  # Diario 18:00
def cierre_diario_automatico():
    """Resumen de caja, diferencias, sugerencias de conciliación."""

@periodic_task(run_every=crontab(minute='*/15'))  # Cada 15 min
def reintentar_sri_pendientes():
    """Reiniciar documentos en PENDIENTE/RECHAZADO tras espera."""

@periodic_task(run_every=crontab(minute='*/30'))  # Cada 30 min
def sincronizar_con_sri():
    """Consultar estado de documentos en contingencia."""

@periodic_task(run_every=crontab(hour=1, minute=0))  # Diario 01:00
def calcular_rentabilidad():
    """Actualizar margen por cliente/producto/canal."""

@periodic_task(run_every=crontab(hour=19, minute=0))  # Diario 19:00
def generar_reportes_ejecutivos():
    """Enviar resúmenes por email a gerente/contador."""
```

**Timeline:** 4-6 horas (implementar los 6 jobs).

---

## 5. Permisología y RBAC Gaps

**Gap:** Rol existe pero sin granularidad. Solo admin/vendedor/contador.

**Extender:**
```python
class Rol(models.Model):
    # Agregar permisos específicos:
    puede_aprobar_descuentos = BooleanField()
    puede_ver_rentabilidad = BooleanField()
    puede_anular_factura = BooleanField()
    puede_cambiar_precio = BooleanField()
    puede_ver_auditoria = BooleanField()
    puede_generar_reportes_sensibles = BooleanField()
    # ... etc
    
    # O usar Django's Permission model: permission_set
```

**Timeline:** 1-2 horas rediseño + migración.

---

## 6. Testing Gaps

**Gap:** Hoy solo hay tests unitarios de descuentos. Sin tests de integración ni flujos.

**Crear:**
- `tests/integration/test_orden_to_cash.py` — e2e: Coti → Pedido → Factura → Cobro
- `tests/integration/test_sri_workflow.py` — rechazo → diagnóstico → reintento
- `tests/integration/test_aprobaciones.py` — workflow de aprobación
- `tests/integration/test_auditar.py` — cambios quedan registrados

**Timeline:** 8-10 horas (4 test suites × 2-2.5h c/u).

---

## 7. Infrastructure / DevOps Gaps

### 7.1 Monitoreo de Alertas
**Gap:** Sin alertas de "sistema caído", "job celery fallido", etc.

**Agregar:**
- Sentry para errores
- Celery beat health check
- DB backup monitoring

**Timeline:** 2-3 horas setup.

### 7.2 Email transaccional
**Gap:** Hoy solo se ve en logs. Sin emails de aprobaciones, alertas, reportes.

**Setup:**
- Sendgrid/AWS SES integrado
- Plantillas de email (aprobación, alerta, reporte)

**Timeline:** 2 horas.

---

## Resumen: Timeline Total Estimado

| Componente | Horas | Semana |
|-----------|-------|--------|
| Modelos (PolicyRule, ApprovalTicket, AuditLog, SRIDocumentLog, Prospecto) | 5 | 1 |
| Extender modelos existentes (descuentos, permisos) | 3 | 1 |
| API `/api/control/` endpoint | 6 | 2 |
| Tasks Celery (alertas, reintentos, cálculos) | 6 | 2 |
| Dashboard Gerente + Contador + Vendedor | 8 | 3 |
| Centro de Control SRI | 4 | 2 |
| Sistema de Aprobaciones (backend + frontend) | 5 | 2 |
| Admin de Políticas | 3 | 1 |
| Reportes y Auditoría UI | 4 | 2 |
| Tests de integración | 10 | 3 |
| Setup email + monitoreo | 4 | 1 |
| Integration testing + UAT | 8 | 2 |
| **TOTAL** | **66 horas** | **≈ 16 días dev full-time** |

**Con 2 devs en paralelo:** 8 días reales (~1.5 semanas).

---

## Orden de Ejecución Recomendado (Critical Path)

### Sprint 1 (Semana 1-2): Fundación
1. Modelos (PolicyRule, AuditLog) — sin esto, no hay control
2. API `/api/control/` básica — dashboard + alertas
3. Dashboard Gerente — necesita visibilidad urgente

### Sprint 2 (Semana 2-3): Procesos Core
1. Centro de Control SRI — imprescindible para launch
2. Tasks Celery (alertas, reintentos SRI) — automatización crítica
3. Sistema de Aprobaciones (simple, 2-nivel) — sin esto, no hay control

### Sprint 3 (Semana 3-4): Profundidad
1. Dashboards Contador + Vendedor — completar visibilidad por rol
2. Admin de Políticas — gestión descuentos/aprobaciones
3. Reportes + Auditoría — visibilidad histórica

### Sprint 4 (Semana 4-5): Testing + Pulido
1. Tests de integración — covertura de flujos críticos
2. UAT con cliente piloto — validar workflows
3. Training + documentación — lanzamiento

---

## Flag de Decisión: MVP vs Full

**Si tiempo es crítico (launch en 2 semanas):**
- Deploy: Sprint 1 + centro SRI + aprobaciones básicas (orden a factura)
- Defer: Tableros avanzados, rentabilidad, CRM

**Si tiempo permite (launch en 4 semanas):**
- Deploy: Todo el plan (66 horas, domina ambos devs)
- Diferenciador vs Contifico: rentabilidad real + análisis por cliente

