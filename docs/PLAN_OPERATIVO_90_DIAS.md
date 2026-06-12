# Plan Operativo 90 Días — Ecosistema de Control SRI
**Objetivo:** Transformar SistemasNovi de módulos aislados a **ERP integrado competitivo** (Contifico, Minegocio, Xpendo).

**Diferenciador:** Order-to-Cash sin reprocesos, Procure-to-Pay automatizado, SRI nativo sincronizado, control centralizado.

---

## FASE 1: Semanas 1-4 — Orquestación Order-to-Cash

### Proceso 1.1: Cotización → Pedido → Factura → Cobro (flujo sin fricción)

**Estado actual:**
- Cotización independiente
- Pedido sin agregar items desde cotización
- No hay validación de políticas de descuento
- Factura manual, error-prone
- Cobro desagregado de venta

**Estado deseado:**
```
Prospecto → Cotización (v1,v2,...) 
  → Pedido (ref. coti seleccionada)
    → Validar políticas (descuento, cliente, margen)
      → Reservar stock
        → Entregar (por sucursal)
          → Facturar SRI (automático)
            → Registrar en CxC
              → Cobro (manual/automático)
                → Actualizar CxC
                  → Cierre diario reconciliado
```

**KPIs:**
- Ciclo coti→factura: < 2 horas
- % documentos SRI aceptados a 1er intento: > 95%
- % cobros conciliados autom.: > 80%
- Margen neto promedio: _% (baseline)

**Quick wins (Semana 1-2):**
- [ ] Agregar referencia de cotización en pedido (1-2h código)
- [ ] Validar margen mínimo antes de permitir facturación (1-2h)
- [ ] Botón "Facturar desde Pedido" automáticamente → SRI (2-3h)

---

### Proceso 1.2: Control de Descuentos y Políticas

**Estado actual:**
- No hay política de descuentos definida
- POS/web-admin permiten descuento manual sin límite
- No hay auditabilidad

**Estado deseado:**
```
Tipos de descuento:
 1. Por volumen (cantidad/monto) → tabla automática
 2. Por cliente (VVIP/Premium/Standard) → condiciones
 3. Por canal (mayorista/minorista/directo)
 4. Por región/sucursal (temporal)
 5. Manual (requiere aprobación si > umbral)

Flujo:
  Sugiere descuento → Valida contra política
    → Si OK: aplica; Sino: requiere aprobación
      → Audita quién, cuándo, por qué
        → Descarga reportes descuentos/rentabilidad
```

**KPIs:**
- % ventas con descuento dentro de política: 100% (control)
- % descuentos manuales vs automáticos: 5% vs 95% (target)
- Margen bruto por cliente: visibilidad

**Quick wins (Semana 2-3):**
- [ ] Tabla de políticas en admin (1h)
- [ ] Motor de validación (discountToMonto ya existe, integrar) (2h)
- [ ] Reporte de descuentos fuera de política (1h)

---

## FASE 2: Semanas 5-8 — Automatización Procure-to-Pay + SRI Nativo

### Proceso 2.1: Compra → Recepción → CxP → Pago

**Estado actual:**
- Módulo de proveedores existe pero sin integración
- No hay OC centralizada
- Recepción manual
- CxP desagregada

**Estado deseado:**
```
Solicitud interna (inventario baja)
  → OC automática (si ≤ presupuesto)
    → Enviar a proveedor (email/integración)
      → Recibir mercancía (ingreso inventario)
        → Crear factura en CxP (desde OC + recepción)
          → Flujo de aprobación (si > monto)
            → Programar pago (manual o automático)
              → Reporte de CxP por vencer
```

**KPIs:**
- Ciclo OC→pago: < 15 días
- % CxP pagadas a tiempo: > 90%
- Quiebres de stock evitados: _#

**Quick wins (Semana 5-6):**
- [ ] OC desde solicitud de inventario (2-3h)
- [ ] Recepción → CxP automático (2h)
- [ ] Reporte de CxP por vencer (1h)

---

### Proceso 2.2: Centro de Control SRI (Contingencia + Sincronización)

**Estado actual:**
- Facturación SRI existe pero sin visibilidad centralizada
- Rechazos sin flujo de resolución
- No hay alertas de contingencia

**Estado deseado:**
```
Dashboard SRI:
  - Estado de últimos 100 documentos (aceptado/rechazado/contingencia)
  - Filtrar por motivo de rechazo
  - Reintentar rechazo automático (validar primero, luego reenviar)
  - Alertas: "Certificado vence en 30 días", "Ambiente de prueba activo"
  - Sincronización de saldos con SRI (semanal/manual)
  - Log auditable de todos los intentos

Flujo de rechazo:
  1. Detectar (automático al procesar respuesta SRI)
  2. Notificar (email/push al contador)
  3. Diagnosticar (sugerir qué está mal: RUC cliente, formato, etc.)
  4. Corregir (UI guiada)
  5. Reintentar (botón, con throttling)
  6. Auditar (registrar todos los cambios)
```

**KPIs:**
- % documentos rechazados: < 2% (meta)
- Tiempo promedio resolución rechazo: < 2 horas
- 0 sorpresas de contingencia (todas alertadas)

**Quick wins (Semana 6-7):**
- [ ] Dashboard SRI con últimos documentos + filtros (2h)
- [ ] Alertas de certificado/contingencia (1h)
- [ ] Diagnóstico automático de rechazos comunes (1-2h)

---

## FASE 3: Semanas 9-12 — Gobierno de Control + Tableros por Rol

### Proceso 3.1: Sistema de Aprobaciones Centralizado

**Estado actual:**
- No hay flujo de aprobaciones
- Cualquiera puede anular, notar, cambiar precios

**Estado deseado:**
```
Matriz de aprobación:
  - Descuento > 15% → Gerente
  - Anulación de factura → Contador + Gerente
  - Nota de crédito > $500 → Contador
  - Compra > presupuesto → Gerente
  - Cambio de cliente/precio después de facturado → Auditor

Sistema:
  1. Detectar acción sujeta a aprobación
  2. Crear ticket de aprobación (email/push)
  3. Mostrar contexto (cliente, monto, motivo, historial)
  4. Aprobar/rechazar con comentario
  5. Auditar decisión
  6. Permitir/denegar acción
```

**KPIs:**
- Tiempo promedio de aprobación: < 2 horas
- % aprobaciones denegadas: _% (métrica de control)
- Excepciones "sin dueño": 0

---

### Proceso 3.2: Tableros por Rol (No más un dashboard general)

**Gerente/Dueño:**
- Resumen diario: ingresos, gastos, margen, flujo
- Top 10 clientes (ytd), Top 10 productos (rotación)
- Alertas: cliente moroso, margen bajo, rechazo SRI, CxP por vencer
- Proyección de caja (30 días)

**Contador:**
- Cierre diario: ingresos, egresos, diferencias caja, estado SRI
- Conciliación bancaria (sugerencias automáticas)
- CxC por vencer (> 30, > 60 días)
- CxP por vencer
- Asientos contables pendientes

**Vendedor:**
- Mi cartera (clientes, siguiente seguimiento)
- Oportunidades abiertas (cotizaciones sin convertir)
- Top 5 productos (por margen)
- Bonificación acumulada (cmisión/meta)

**Jefe de Bodega:**
- Stock por línea (vs mínimo)
- Rotación ABC
- Compras pendientes de recibir
- Movimientos del día (entradas, salidas)

**Cajero:**
- Tickets abiertos (pedidos listos para cobro)
- Formas de pago disponibles (saldo caja, bancos)
- Cierre de caja (esperado vs real)

**KPIs:**
- Adopción diaria por rol: adm > 80%, contador > 90%, vendedor > 60%
- % decisiones tomadas desde dashboard: baseline + 20% (semestre)

---

### Proceso 3.3: Alertas de Negocio (Motor de Reglas)

**Cierre Diario:**
- Alertar si diferencia de caja > $5
- Alertar si factura rechazada > 2 intentos
- Alertar si cambio de precio > 10% (auditoría)

**Riesgo de Cliente:**
- Cliente moroso (payment overdue)
- Cliente sin movimientos (60 días)
- Cliente nuevo con compra > $1000 (verificar)

**Inventario:**
- Stock por debajo de mínimo
- Stock obsoleto (no movido > 90 días)
- Compra sin recibir (> 5 días)

**Margen:**
- Venta con margen < 10%
- Cliente con promedio margen negativo
- Producto no rentable (venta bajo costo)

---

## FASE 4: Semanas 13-16 — Modelo de Rentabilidad + Auditoría

### Proceso 4.1: Rentabilidad Real (Cliente, Producto, Canal)

**Cálculo:**
```
Margen Neto = (Ingresos - COGS - Descuentos - Gastos Directos) - Prorrateo Gastos Indirectos

Granularidad:
  1. Por venta (factura)
  2. Por cliente (acumulado)
  3. Por producto (acumulado)
  4. Por canal (mayorista/minorista/directo)
  5. Por vendedor (comisión sobre margen real, no venta)
```

**Visualización:**
- Matriz cliente × producto (margen real)
- Clientes no rentables (identificar para acción)
- Productos "roba-ganancia" (alto volumen, bajo margen)

**KPIs:**
- % clientes rentables: > 85%
- % productos con margen positivo: > 90%
- ROI por canal: _% (establecer metas)

---

### Proceso 4.2: Auditoría Centralizada (Log Inmutable)

**Qué auditar:**
- Creación/modificación de precios
- Descuentos (quién, cuánto, por qué)
- Cambios de cliente en factura
- Anulaciones/devoluciones
- Cambios en políticas
- Acceso a reportes sensibles

**Almacenamiento:**
- Tabla `audit_log` (timestamp, user, modelo, acción, antes, después)
- Reporte ejecutivo (acciones críticas)
- Trazabilidad completa (pregunta: "¿quién cambió esta factura?" → respuesta instantánea)

---

## FASE 5: Semanas 17-20 — Integración + Pulido MVP

### 5.1: CRM Básico (Prospecto → Cliente)
- Prospectiva: seguimiento a cotizaciones
- Motivos de pérdida (no compró, fue a competencia, etc.)
- Histórico de interacciones

### 5.2: Planeación de Inventario
- Punto de reorden automático
- Proyección de demanda (últimos 90 días)
- Sugerencia de compra

### 5.3: Modelo Operativo Documentado
- Responsabilidades por rol (RACI matrix)
- SLAs (tiempo máximo por proceso)
- Escenarios de excepciones

### 5.4: Testing + Go-Live
- UAT con clientes piloto (1-2 empresas)
- Documentación de usuario
- Training vendedor/caja/contador

---

## Hitos y Entregables

| Hito | Semana | Entregable | Owner |
|------|--------|-----------|-------|
| Q1 - Control básico | 4 | Dashboard gerente, validación política descuentos | Dev |
| Q2 - SRI resiliente | 8 | Centro de control SRI, reintentos automáticos | Dev + QA |
| Q3 - Aprobaciones | 12 | Sistema de aprobaciones, tableros por rol | Dev |
| Q4 - Rentabilidad | 16 | Modelo margen real, auditoría centralizada | Dev + Negocio |
| MVP Ready | 20 | UAT passed, documentación completa, training done | Equipo |

---

## Stack Tecnológico Requerido

### Backend (Django)
- [ ] Modelo de `Workflow` (aprobaciones)
- [ ] Tabla de `PolicyRule` (descuentos, aprobaciones)
- [ ] `AuditLog` (auditoría)
- [ ] Motor de **Tasks** (validaciones, alertas) — Celery ya existe
- [ ] **API de Control** (dashboard agregado, alertas)
- [ ] Integraciones financieras (bancos, SRI queries)

### Frontend (web-admin + pos-client)
- [ ] Dashboard por rol (con permisología)
- [ ] Formulario de aprobación (modal workflow)
- [ ] Tabla de políticas (admin)
- [ ] Centro de control SRI (visual + acciones)
- [ ] Reportes de auditoría (filtrable)
- [ ] Alertas en tiempo real (push)

### Infraestructura
- [ ] Queue de jobs (Celery ya existe, reforzar)
- [ ] Cache de reglas (Redis)
- [ ] Logs centralizados (auditoria + sistema)
- [ ] Monitoreo (alertas cuando algo falla)

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| SRI rechaza masivamente | Media | Alto | Centro de control + diagnóstico automático (semana 7) |
| Usuarios no adoptan tableros | Media | Medio | Training + KPIs de adopción + soporte 24h primeras 2 sem |
| Flujo de aprobación ralentiza operación | Baja | Alto | SLAs cortos + escalada automática si > threshold |
| Modelo de margen no factible | Baja | Medio | Validar con contador antes de semana 13 |

---

## Éxito = Competencia Con Contifico/Minegocio

**Diferenciadores clave:**
1. **Orquestación**: Coti → Pedido → Factura → Cobro en un click sin reprocesos
2. **SRI nativo**: Sincronización automática, reintentos inteligentes, 0 contingencia sorpresa
3. **Control centralizado**: Un dashboard por rol, reglas claras, auditoría inmutable
4. **Rentabilidad real**: No vendemos ilusiones, sabemos quién es rentable
5. **Ecuatoriano**: Compliance SRI built-in, no add-on

**Métrica de éxito MVP:**
- [ ] 1 empresa piloto: orden → factura → cobro < 4 horas (hoy: 1+ día)
- [ ] 0 factura rechazada por SRI en primera semana
- [ ] Contador cierra caja en < 30 minutos (hoy: 2+ horas)
- [ ] Margen visible por cliente (hoy: no existe)
