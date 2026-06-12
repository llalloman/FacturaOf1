# Backlog Ejecutable — MVP 4-5 Semanas

Priorizado por: **impacto en negocio** × **frecuencia de uso** × **riesgo de no hacerlo**.

---

## 🔴 CRITICAL PATH (Semana 1-2) — Sin esto, MVP no funciona

### Sprint 1.1 | T-001: Modelo de Auditoría + PolicyRule
**Objetivo:** Foundation para control centralizado.
**Tareas:**
- [ ] Crear `AuditLog`, `PolicyRule`, `ApprovalTicket` modelos
- [ ] Crear migraciones
- [ ] Indexar `AuditLog(empresa, timestamp)` para queries rápidas
- [ ] Crear `audit_log_signal.py` que capture CREATE/UPDATE en Factura, NotaCredito, Pedido
- [ ] Test: crear factura → debe existir AuditLog entry

**Asignado:** Backend
**Timeline:** 4h
**Entrega:** Jueves (día 2)
**KPI de éxito:** `AuditLog.objects.filter(empresa=x, timestamp__gte=hoy).count() > 0`

---

### Sprint 1.2 | T-002: SRI Document Log + Integración
**Objetivo:** Visibilidad de toda comunicación con SRI.
**Tareas:**
- [ ] Crear modelo `SRIDocumentLog`
- [ ] Modificar `facturacion/services.py` → cada intento a SRI registra log
- [ ] Helper `log_sri_attempt(factura, estado, respuesta, error)`
- [ ] Test: facturar → debe existir `SRIDocumentLog` con estado correcto

**Asignado:** Backend
**Timeline:** 3h
**Entrega:** Viernes (día 3)
**KPI de éxito:** `SRIDocumentLog.objects.filter(empresa=x).count() > 0`

---

### Sprint 1.3 | T-003: API Dashboard Base (`/api/control/dashboard/`)
**Objetivo:** Endpoint que feed gerente/contador con KPIs del día.
**Tareas:**
- [ ] Crear `apps/control/api.py` con viewset `DashboardView`
- [ ] GET `/api/control/dashboard/gerente/` → retorna: ingresos_hoy, gastos, margen, alertas_top_5
- [ ] GET `/api/control/dashboard/contador/` → retorna: cierre_diario_sugerido, cxc_vencer, cxp_vencer
- [ ] Cached con `@cache_page(300)` (5 min)
- [ ] Test: request → debe retornar JSON válido con estructura esperada

**Asignado:** Backend
**Timeline:** 3h
**Entrega:** Viernes (día 3)
**KPI de éxito:** Response time < 200ms, estructura completa

---

### Sprint 1.4 | T-004: Dashboard Gerente (Frontend)
**Objetivo:** Primera pantalla que ve gerente al login.
**Tareas:**
- [ ] Crear `web-admin/src/pages/dashboards/GerencialDashboard.tsx`
- [ ] Layout: grid 3 columnas con cards (ingresos, gastos, margen, alertas, clientes top, productos top)
- [ ] Conectar con `/api/control/dashboard/gerente/`
- [ ] Refresh cada 5 min; click → refresh manual
- [ ] Alertas: color naranja (aviso), rojo (crítico)
- [ ] Test: cargar página → ver datos

**Asignado:** Frontend
**Timeline:** 4h
**Entrega:** Viernes (día 3)
**KPI de éxito:** Página carga en < 3s, datos correctos, actualizaciones cada 5 min

---

### Sprint 1.5 | T-005: Centro de Control SRI (API + UI)
**Objetivo:** Visibilidad centralizada de rechazo/aceptación SRI.
**Tareas:**
- [ ] API `GET /api/control/sri/estado/` → últimos docs, aceptados/rechazados/contingencia counts
- [ ] API `POST /api/control/sri/reintentar/` {factura_id} con validaciones previas
- [ ] Crear `web-admin/src/pages/sri/ControlSRI.tsx`
- [ ] Tabla: Documento | Estado | Intento # | Fehca | Acción (reintentar, detalles)
- [ ] Filtros: Estado, Fecha, Empresa
- [ ] Modal detalles: JSON request/response, motivo error
- [ ] Test: rechaza factura → aparece en tabla con motivo

**Asignado:** Backend (2h) + Frontend (3h)
**Timeline:** 5h total
**Entrega:** Lunes (día 5)
**KPI de éxito:** SRI dashboard carga en < 2s, reintentos automáticos funcionan

---

### Sprint 1.6 | T-006: Motor de Alertas Base (Celery Task)
**Objetivo:** Alertas de negocio críticas (cliente moroso, margen bajo, CxP vencer).
**Tareas:**
- [ ] Task `@periodic_task(run_every=crontab(minute=0))`: `generar_alertas_negocio()`
- [ ] Detectar: clientes con payment > 30 días
- [ ] Detectar: ventas con margen < 10%
- [ ] Detectar: CxP por vencer en < 5 días
- [ ] Guardar en tabla `Alert` (modelo nuevo, simple)
- [ ] API `GET /api/control/alertas/?rol=GERENTE` retorna lista de alertas
- [ ] Test: crear factura morosa → job ejecuta → aparece alerta

**Asignado:** Backend
**Timeline:** 4h
**Entrega:** Lunes (día 5)
**KPI de éxito:** Task ejecuta sin error, alertas aparecen en el tiempo esperado

---

### Sprint 1.7 | T-007: Extender Modelo de Descuento (PolicyRule Validación)
**Objetivo:** Integrar regla de política en aplicación de descuento.
**Tareas:**
- [ ] En `POSPage.tsx` y `Cart.tsx`: antes de aplicar descuento, validar contra PolicyRule
- [ ] Si descuento OK → aplica; sino → requiere aprobación (crear ApprovalTicket)
- [ ] Helper `validate_discount_policy(cliente, descuento_pct, bruto)` → retorna (OK, razon_rechazo)
- [ ] Test: descuento > política → debe rechazar automáticamente

**Asignado:** Backend (1h) + Frontend (2h)
**Timeline:** 3h total
**Entrega:** Lunes (día 5)
**KPI de éxito:** Descuentos > umbral piden aprobación

---

## 🟠 ALTO IMPACTO (Semana 2-3)

### Sprint 2.1 | T-008: Sistema de Aprobaciones (Backend)
**Objetivo:** Workflow: acción sujeta a aprobación → ticket → aprobador → permite/rechaza.
**Tareas:**
- [ ] Crear signal de `post_save` en Factura que detecte "anulación" o "cambio_precio > 10%" → crea ApprovalTicket
- [ ] Crear signal en NotaCredito "creación > $500" → crea ApprovalTicket
- [ ] Crear signal en Pedido "descuento manual" → crea ApprovalTicket
- [ ] Método `ApprovalTicket.aprobar()` → permite acción, log en AuditLog
- [ ] Método `ApprovalTicket.rechazar()` → rechaza acción, undo de cambios
- [ ] API `GET /api/control/aprobaciones/?estado=PENDIENTE` lista tickets
- [ ] API `POST /api/control/aprobaciones/{id}/aprobar/` con comentario
- [ ] Test: cambiar precio factura → debe crear ticket, aprobar → precio cambia, rechazar → no cambia

**Asignado:** Backend
**Timeline:** 5h
**Entrega:** Miércoles (día 7)
**KPI de éxito:** Tickets creados automáticamente, aprobación bloquea/permite acciones

---

### Sprint 2.2 | T-009: Modal de Aprobaciones (Frontend)
**Objetivo:** UI genérica para aprobador.
**Tareas:**
- [ ] Crear `web-admin/src/components/ApprovalModal.tsx` (reutilizable)
- [ ] Ubicar en Layout sidebar o top nav → "Aprobaciones pendientes (3)"
- [ ] Modal muestra: tipo, contexto, quién pide, botones Aprobar/Rechazar
- [ ] Click → POST a `/api/control/aprobaciones/{id}/aprobar/`
- [ ] Toast: "Aprobado" o "Rechazado"
- [ ] Page `/pages/aprobaciones/AprobacionesPendientes.tsx` más detallada

**Asignado:** Frontend
**Timeline:** 4h
**Entrega:** Miércoles (día 7)
**KPI de éxito:** Modal funcional, aprobaciones se procesan correctamente

---

### Sprint 2.3 | T-010: Tareas Celery: Reintentos SRI + Cierre Diario
**Objetivo:** Automatización de procesos SRI y cierre.
**Tareas:**
- [ ] Task `@periodic_task(run_every=crontab(minute='*/15'))`: `reintentar_sri_pendientes()`
  - Buscar documentos en RECHAZADO o PENDIENTE > 1 hora
  - Validar Factura está correcta (RUC cliente válido, etc)
  - Reenviar a SRI
  - Log intento
- [ ] Task `@periodic_task(run_every=crontab(hour=18, minute=0))`: `cierre_diario_automatico()`
  - Buscar todas las facturas del día
  - Resumen: ingresos, egresos, diferencias caja, estado SRI
  - Sugerir conciliación bancaria (movimientos del día vs ingresos)
  - Guardar en tabla `CierreDiario`
- [ ] Test: rechaza factura → 15 min → reintentada; end of day → cierre automático

**Asignado:** Backend
**Timeline:** 4h
**Entrega:** Jueves (día 8)
**KPI de éxito:** Tasks ejecutan sin error, SRI documentos se reintenten, cierre diario se genera

---

### Sprint 2.4 | T-011: Dashboard Contador
**Objetivo:** Visibilidad del día desde óptica contable.
**Tareas:**
- [ ] Crear `web-admin/src/pages/dashboards/ContadorDashboard.tsx`
- [ ] Cards: cierre_actual (esperado vs real), CxC por vencer, CxP por vencer, estado SRI, últimas operaciones
- [ ] Link a "Cierre Diario" detallado
- [ ] Link a "Auditoria" (últimos cambios)
- [ ] Click en alerta → drill-down

**Asignado:** Frontend
**Timeline:** 3h
**Entrega:** Jueves (día 8)
**KPI de éxito:** Contador tiene visibilidad de su "to-do" diario

---

### Sprint 2.5 | T-012: Dashboard Vendedor
**Objetivo:** Visibilidad de cartera + oportunidades.
**Tareas:**
- [ ] Crear `web-admin/src/pages/dashboards/VendedorDashboard.tsx`
- [ ] Cards: mi_cartera (clientes asignados), cotizaciones_abiertas, top_5_productos, bonificación YTD
- [ ] Tabla de cotizaciones: cliente | monto | días abierta | última interacción | botón convertir a pedido
- [ ] Click "convertir a pedido" → pre-popula lineItems

**Asignado:** Frontend
**Timeline:** 3h
**Entrega:** Jueves (día 8)
**KPI de éxito:** Vendedor tiene visibilidad de su cartera

---

### Sprint 2.6 | T-013: Reporte de Auditoría
**Objetivo:** Trazabilidad de cambios críticos.
**Tareas:**
- [ ] Crear `web-admin/src/pages/auditoria/AuditoriaLog.tsx`
- [ ] Tabla filtrable: fecha, usuario, modelo, acción, cambios (antes → después)
- [ ] Filtros: fecha range, usuario, tipo de acción, modelo
- [ ] Expandir row → ver JSON completo de cambios
- [ ] Export a CSV (requerimiento legal/SRI)
- [ ] Test: cambiar factura → registrado en auditoría

**Asignado:** Frontend (3h) + Backend query optimization (1h)
**Timeline:** 4h
**Entrega:** Viernes (día 9)
**KPI de éxito:** Auditoría muestra todos los cambios, exportable, rápida

---

## 🟡 MEDIO IMPACTO (Semana 3-4)

### Sprint 3.1 | T-014: Admin de Políticas de Descuento
**Objetivo:** Gestión de reglas de negocio sin tocar código.
**Tareas:**
- [ ] Crear `web-admin/src/pages/admin/Politicas.tsx`
- [ ] Tabla PolicyRule (es editable): tipo | condición | acción | aprobador | activa
- [ ] CRUD: crear descuento volumen (ej: si cantidad > 10 → descuento 5%), cliente VIP (15%), manual > 20% requiere aprobación
- [ ] Prueba de política (simulator): "si vendo esto, aplicaría X descuento?"
- [ ] Test: crear política → validar está activa, luego aplicar en venta

**Asignado:** Frontend (3h) + Backend (1h)
**Timeline:** 4h
**Entrega:** Lunes (día 12)
**KPI de éxito:** Gerente puede definir políticas sin developer

---

### Sprint 3.2 | T-015: Modelo de Prospecto + CRM Básico
**Objetivo:** Rastrear prospecto desde primer contacto.
**Tareas:**
- [ ] Crear modelos `Prospecto`, `OportunidadPerdida`
- [ ] Cotización puede linkar a Prospecto O Cliente (GenericForeignKey)
- [ ] Crear `web-admin/src/pages/crm/Prospectos.tsx` (CRUD básico)
- [ ] Página "Cotización abierta" → botón "Convertir a cliente" → si acepta, crea Cliente + vincula
- [ ] Si rechaza → botón "Registrar pérdida" → motivo + descripción
- [ ] Reporte de motivos de pérdida (mes, queremos el 50% de rechazo = "precio alto"? ok, negociar)

**Asignado:** Backend (3h) + Frontend (2h)
**Timeline:** 5h
**Entrega:** Martes (día 13)
**KPI de éxito:** Prospectos convertidos, motivos de pérdida claros

---

### Sprint 3.3 | T-016: Modelo de Rentabilidad (Margen Real)
**Objetivo:** Saber quién gana dinero realmente (no ilusión de volumen).
**Tareas:**
- [ ] En `LineaFactura`: agregar campo `costo_unitario` (asociar a `Producto.costo_promedio` al crear factura)
- [ ] Task `@periodic_task(run_every=crontab(hour=2, minute=0))`: `calcular_rentabilidad()`
  - Para cada Venta (factura) de hoy: margen_neto = (ingresos - costo - descuento) - prorrateo gastos directos
  - Guardar en tabla `VentaRentabilidad(factura, margen_neto, margen_pct)`
  - Agregar: por cliente (acum), por producto (acum), por canal
- [ ] API `GET /api/rentabilidad/cliente/{cliente_id}/` → margen promedio, trending
- [ ] Dashboard "Rentabilidad" con matriz cliente × producto (heatmap: rojo=pérdida, verde=ganancia)

**Asignado:** Backend
**Timeline:** 6h
**Entrega:** Miércoles (día 14)
**KPI de éxito:** Margen real visible, Contifico-like

---

### Sprint 3.4 | T-017: Email Transaccional (Alertas + Aprobaciones)
**Objetivo:** Notificaciones que aterricen en inbox de stakeholders.
**Tareas:**
- [ ] Setup Sendgrid (o AWS SES) en `config/settings.py`
- [ ] Crear templates:
  - `AprobacionRequerida.html` (para aprobador)
  - `AlertaNegocio.html` (cliente moroso, margen bajo)
  - `CierreDiario.html` (para contador)
- [ ] Signal: ApprovalTicket creado → email a aprobador
- [ ] Task:  alertas generadas → email a gerente (+ CxP vencer a contador)
- [ ] Test mock: crear ticket → email enviado

**Asignado:** Backend
**Timeline:** 3h
**Entrega:** Jueves (día 15)
**KPI de éxito:** Emails llegan, sin spam, formato profesional

---

### Sprint 3.5 | T-018: Conciliación Bancaria Sugerida
**Objetivo:** Automatizar matching movimientos banco vs ingresos.
**Tareas:**
- [ ] Crear `apps/tesoreria/models.py` → `MovimientoBanco`, `Conciliacion`
- [ ] API para consumir CSV de banco (depositos + retiros del día)
- [ ] Algoritmo simple: match por monto ± 1% y fecha
- [ ] UI `web-admin/src/pages/tesoreria/Conciliacion.tsx`
- [ ] Tabla: movimiento banco | factura sugerida? | estado (match, manual, no match)
- [ ] Click → vincular o ignorar; guardar conciliación

**Asignado:** Backend (3h) + Frontend (2h)
**Timeline:** 5h
**Entrega:** Viernes (día 16)
**KPI de éxito:** Contador concilia en < 30 min (hoy: 2+ horas)

---

## 🟢 NICE-TO-HAVE (Semana 4-5)

### Sprint 4.1 | T-019: Tests de Integración (Critical flows)
**Objetivo:** Validar que Cotización → Factura → Cobro funciona sin rotura.
**Tareas:**
- [ ] E2E test: crear coti → convertir a pedido → facturar → ver en SRI log → cobrar → auditoría tiene todos logs
- [ ] E2E test: pedir descuento > política → crea approval ticket → rechaza → venta se cancela
- [ ] E2E test: factura rechazada por SRI → crea log → 15 min → reintentada → acepta
- [ ] Run en CI/CD

**Asignado:** QA/Backend
**Timeline:** 6h
**Entrega:** Lunes (día 19)
**KPI de éxito:** Suite ejecuta, tests pasan, cobertura > 80%

---

### Sprint 4.2 | T-020: Documentación + Training
**Objetivo:** Usuarios saben usar el sistema.
**Tareas:**
- [ ] Guía de usuario "Flujo de venta típico" (PDF + video)
- [ ] Guía de usuario "Aprobaciones"
- [ ] Guía de usuario "Auditoria + SRI"
- [ ] Video walk-through de dashboards
- [ ] Quick-start guide (1 página)
- [ ] FAQ

**Asignado:** Product/Business
**Timeline:** 4h
**Entrega:** Miércoles (día 21)
**KPI de éxito:** Usuario nuevo no necesita soporte > 5 min para empezar

---

## 📅 Timeline Visual

```
Sem 1   |  T-001  T-002  T-003  T-004  T-005  T-006  T-007  |  Foundation + SRI Control
        |  4h    3h     3h     4h     5h     4h     3h      |  26h
        
Sem 2   |  T-008  T-009  T-010  T-011  T-012  T-013  |  Aprobaciones + Dashboards
        |  5h    4h     4h     3h     3h     4h     |  23h
        
Sem 3   |  T-014  T-015  T-016  T-017  T-018  |  Políticas + Rentabilidad
        |  4h    5h     6h     3h     5h    |  23h
        
Sem 4   |  T-019  T-020  |  Testing + Training
        |  6h    4h    |  10h
        
Total:  66 horas ≈ 16-17 días dev (2 devs en paralelo = 8-9 días reales)
```

---

## 🚀 MVP Launch Checklist

- [ ] T-001 → T-005: Core control funciona (SRI, aprobaciones, dashboard gerente)
- [ ] T-006: Alertas llegan (Celery task ejecuta)
- [ ] T-008 → T-009: Aprobaciones funcionan (backend + UI)
- [ ] T-010: Reintentos SRI automáticos, cierre diario
- [ ] T-013: Auditoría registra cambios
- [ ] Testing: críticos pasen (T-019 semana 4)
- [ ] No hay errores en logs/Sentry
- [ ] 1 empresa piloto lo usa 1 semana sin bugs
- [ ] Training completado

**Go-Live:** Día 21 (fin semana 3) si todo ok, sino semana 4.

---

## 🎯 Métricas de Éxito (MVP vs Contifico)

| Métrica | Hoy | Meta | Target |
|---------|-----|------|--------|
| Orden → Factura → Cobro | 1+ día | < 4h | Contifico: < 2h |
| SRI rechazo tasa | 5-10% | < 2% | Built-in validation |
| Cierre diario contador | 2+ h | < 30 min | Auto-reconciliation |
| Auditoría cobertura | 0% | 100% | Legal-ready |
| Alertas de negocio | Manual (0%) | Automáticas (80%+) | Proactive management |
| Rentabilidad visible | No | Sí por cliente | Strategic pricing |

