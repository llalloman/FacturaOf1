# Arquitectura de Ecosistema de Control — Integración

## Visión Integrada (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USUARIOS (Roles)                                  │
│  ┌──────────────┬─────────────────┬────────────┬──────────┬──────────────┐  │
│  │ GERENTE      │ CONTADOR        │ VENDEDOR   │ CAJERO   │ BODEGUERO    │  │
│  └──────────────┴─────────────────┴────────────┴──────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CAPA DE PRESENTACIÓN (Frontend)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Dashboards por Rol:                                               │    │
│  │ • Gerencial: ingresos, margen, alertas, rentabilidad por cliente  │    │
│  │ • Contador: cierre diario, CxC/CxP, SRI, auditoria               │    │
│  │ • Vendedor: cartera, cotizaciones, comisión                       │    │
│  │ • Caja: tickets abiertos, montos caja, cierre            │    │
│  │ • Bodega: stock, rotación ABC, compras por recibir        │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ Procesos Operativos:                                              │    │
│  │ • /pos: POS Electron + web-admin (descuentos validados)           │    │
│  │ • /cotizaciones: crear coti → convertir a pedido                  │    │
│  │ • /pedidos: orden → reservar stock → entregar → facturar         │    │
│  │ • /facturacion: facturar → SRI → cobro → CxC                     │    │
│  │ • /aprobaciones: modal workflow (descuentos, anulaciones)         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────────┐  ┌──────────────────────┐
│   CONTROL API        │ │   OPERACIÓN API      │  │   INTEGRATION API    │
│ ┌────────────────┐   │ │ ┌────────────────┐   │  │ ┌────────────────┐   │
│ │ /dashboard/    │   │ │ │ /facturas/     │   │  │ │ /sri/          │   │
│ │ /alertas/      │──→│ │ │ /pedidos/      │──→│  │ │ /bancos/       │   │
│ │ /aprobaciones/ │   │ │ │ /cotizaciones/ │   │  │ │ /reportes/     │   │
│ │ /auditoria/    │   │ │ │ /almacen/      │   │  │ │...            │   │
│ │ /sri/          │   │ │ │ /clientes/     │   │  │ └────────────────┘   │
│ │ /rentabilidad/ │   │ │ │ /caja/         │   │  │ ┌────────────────┐   │
│ │ /politicas/    │   │ │ │ /usuarios/     │   │  │ │ Webhooks SRI   │   │
│ └────────────────┘   │ │ └────────────────┘   │  │ │ Webhooks Banco │   │
│ (Agregación, Datos)  │ │ (CRUD, Lógica)       │  │ │ (Eventos)      │   │
└──────────────────────┘ │ (Reglas)             │  │ └────────────────┘   │
                         └──────────────────────┘  └──────────────────────┘
                                    │
                              ┌─────┴─────┐
                              ▼           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE NEGOCIO (Backend/Django)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ORQUESTACIÓN:                                                           │ │
│ │                                                                         │ │
│ │  PolicyEngine:                                                         │ │
│ │  • validate_discount(cliente, descuento, bruto) → OK | NO             │ │
│ │  • apply_policy_rule(rule_id, contexto) → accion                      │ │
│ │                                                                         │ │
│ │  WorkflowEngine:                                                       │ │
│ │  • crear ApprovalTicket → esperar aprobación → ejecutar acción        │ │
│ │  • notify_approvers() → email/push                                    │ │
│ │  • ejecutar_accion_aprobada() → aplicar cambio                        │ │
│ │                                                                         │ │
│ │  AuditEngine:                                                          │ │
│ │  • log_change(modelo, objeto, accion, cambios) → AuditLog            │ │
│ │  • prevenir delete (append-only)                                      │ │
│ │                                                                         │ │
│ │  AlertEngine:                                                          │ │
│ │  • generar_alertas_negocio() → cliente moroso, margen bajo, etc      │ │
│ │  • enviar notificaciones (email, push, dashboard)                     │ │
│ │                                                                         │ │
│ │  SRIEngine:                                                            │ │
│ │  • enviar_factura_sri(factura) → log intento → manejar respuesta      │ │
│ │  • diagnosticar_rechazo(codigo_error) → sugerencia                    │ │
│ │  • reintentar_pendientes() → retry automático                         │ │
│ │                                                                         │ │
│ │  RentabilidadEngine:                                                  │ │
│ │  • calcular_margen_neto(factura) → snapshot VentaRentabilidad         │ │
│ │  • margen_por_cliente(cliente, periodo) → agregado                    │ │
│ │  • margen_por_producto(producto, periodo) → agregado                  │ │
│ │                                                                         │ │
│ │  CierreEngine:                                                         │ │
│ │  • generar_cierre_diario() → resumen diario                           │ │
│ │  • sugerir_conciliacion_banco() → matching automático                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ MODELOS:                                                                │ │
│ │ • Factura, LineaFactura (+ approval_ticket, rentabilidad, sri_logs)   │ │
│ │ • Pedido (+ descuentos validados, aprobaciones)                        │ │
│ │ • Cotizacion (+ prospecto link)                                        │ │
│ │ • Cliente (+ tipo cliente, margen promedio, estado mora)               │ │
│ │ • PolicyRule (descuentos, aprobaciones, alertas)                       │ │
│ │ • ApprovalTicket (workflow)                                            │ │
│ │ • AuditLog (append-only)                                               │ │
│ │ • SRIDocumentLog (trazabilidad con SRI)                                │ │
│ │ • VentaRentabilidad (snapshot margen)                                  │ │
│ │ • CierreDiario (cierre automático)                                     │ │
│ │ • Prospecto, OportunidadPerdida (CRM)                                  │ │
│ │ • MovimientoBanco, Conciliacion (tesorería)                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│     TAREAS CELERY        │  │   CAPA DE DATOS (DB)    │
│ ┌──────────────────────┐ │  │ ┌────────────────────┐  │
│ │ generar_alertas()    │ │  │ │ PostgreSQL/MySQL   │  │
│ │ reintentar_sri()     │──→│ │ Tables:             │  │
│ │ generar_cierre()     │ │  │ │ • policy_rule      │  │
│ │ calcular_rentabilidad│ │  │ │ • approval_ticket  │  │
│ │ enviar_reportes()    │ │  │ │ • audit_log        │  │
│ │ sincronizar_sri()    │ │  │ │ • sri_document_log │  │
│ │ ...                  │ │  │ │ • venta_rentabilidad
│ └──────────────────────┘ │  │ │ • cierre_diario    │  │
│ (Ejecuta cada X min/h)   │  │ │ • prospecto        │  │
│ (Colas: Redis/RabbitMQ)  │  │ │ • oportunidad_perdida
│ (Worker: 2-4 procesos)   │  │ │ • movimiento_banco │  │
└──────────────────────────┘  │ │ • conciliacion     │  │
                              │ │ • mensaje (audit)  │  │
    ┌──────────────────────┐  │ │ ...                │  │
    │   NOTIFICACIONES     │  │ └────────────────────┘  │
    │ ┌────────────────┐   │  │ Índices:               │
    │ │ Email (Sendgrid)──→│  │ • empresa + timestamp  │
    │ │ Push (Firebase)   │  │ • usuario + acción     │
    │ │ SMS (Twilio)      │  │ • estado_sri + fecha   │
    │ │ Webhook (Custom)  │  │ • margen_pct           │
    │ └────────────────┘   │  │ ...                    │
    └──────────────────────┘  └────────────────────────┘
```

---

## Flujos Críticos

### 1. Flujo: Cotización → Factura → Cobro (Order-to-Cash Automatizado)

```
┌─────────────┐
│  Vendedor   │
│ Crea Cota   │
└──────┬──────┘
       │ POST /api/cotizaciones/
       ▼
┌────────────────────────────┐
│ Cotizacion Model           │
│ - prospecto o cliente      │
│ - líneas con precio base   │
└──────┬─────────────────────┘
       │
       │ UI: "Convertir a Pedido"
       │
       ▼
┌────────────────────────────────────┐
│ Crear Pedido desde Cotización      │
│ - copia líneas                     │
│ - validar cliente existe -> no?    │
│   -> convertir prospecto a cliente │
└──────┬─────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐       ┌──────────────────────┐
│ Aplicar Descuentos (si hay)  │─────→│ PolicyEngine.validate│
│ - valida contra PolicyRule   │       │_discount(...)        │
│ - si > límite: crea          │       │ Aceptado? ─┐        │
│   ApprovalTicket             │       └──────────────────────┘
└──────┬───────────────────────┘              │
       │  ┌────────────────────────────────────┘
       │  │  SI
       ▼  │
    ┌─────────────────────────────────┐
    │ ¿Requiere aprobación?           │
    │ (política, descuento > umbral)  │
    └─────┬───────────────────────────┘
          │
      ┌───┴───┐
      │       │
     SI      NO
      │       │
      ▼       │
    ┌──────────────────────┐
    │ ApprovalTicket crear │  ┌──────────────────────┐
    │ email → Gerente      │  │ Guardar Pedido       │
    │ estado=PENDIENTE     │  │ approval_ticket=NULL │
    └──────┬───────────────┘  └────────┬─────────────┘
           │                           │
           │ Gerente aprueba           │
           │ POST /api/aprobaciones/123/aprobar/
           │                           │
           ▼                           │
    ┌──────────────────────┐       ┌───┴─────────────────┐
    │ Workflow permite     │       │ Pedido.estado =     │
    │ siguiente paso       │       │ 'CONFIRMADO'        │
    └──────┬───────────────┘       └─────┬────────────────┘
           │                           │
           └───────────────┬───────────┘
                           │
                           ▼  (Stock se reserva automáticamente)
                    ┌──────────────┐
                    │ ENTREGAR     │
                    │ (cuando sea)  │
                    └──────┬───────┘
                           │
                           ▼
              ┌──────────────────────────────────┐
              │ Criar Factura (de Pedido)        │
              │ POST /api/facturas/de_pedido/{id}│
              │ - copia líneas con margen        │
              │ - costo_unitario snapshot        │
              └──────┬───────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────┐
         │ SRIEngine.enviar_factura_sri │
         │ - valida formato             │
         │ - envía a SRI                │
         │ - log en SRIDocumentLog      │
         └──────┬──────────────────────┘
                │
            ┌───┴─────────┐
            │             │
         ACEPTADO      RECHAZADO
            │             │
            ▼             ▼
         ┌─────┐   ┌──────────────────────┐
         │OK   │   │ Diagnóstico auto:    │
         │     │   │ "RUC cliente no      │
         │Facn=│   │  válido"             │
         │OK   │   │ email contador       │
         └──┬──┘   └──────┬───────────────┘
            │              │
            │         Contador: corrige RUC
            │         POST .../reintentar/
            │              │
            │              ▼
            │         ┌───────────────────┐
            │         │ SRIEngine.reintentar
            │         │ 15 min si aún no OK
            │         │ (Celery task)
            │         └────┬──────────────┘
            │              │
            │          (repite hasta ACEPTADO)
            │              │
            └──────┬───────┘
                   ▼
         ┌──────────────────────────────┐
         │ AuditLog: FACTURAR           │
         │ cambios={estado_sri: OK}     │
         └──────┬──────────────────────┘
                │
                ▼
         ┌──────────────────────────────┐
         │ CxC: crear Factura Por Cobrar│
         │ monto, fecha_vencimiento     │
         │ estado='PENDIENTE'           │
         └──────┬──────────────────────┘
                │
                ▼
         ┌──────────────────────────────┐
         │ RentabilidadEngine.calcular │
         │ → VentaRentabilidad snapshot  │
         │ margen = (ingresos - costo)   │
         │ + auditoría: LOG CREATE       │
         └──────┬──────────────────────┘
                │
                ▼
         ┌──────────────────────────────┐
         │ Dashboard Gerente ve:        │
         │ ✓ Ingresos +$2000            │
         │ ✓ Margen +15%                │
         │ ✓ Cliente rentable? SÍ       │
         └──────┬──────────────────────┘
                │
                ▼
         ┌──────────────────────────────┐
         │ Cobro (manual o automático) │
         │ Caja → ingresa monto        │
         │ CxC.estado = 'COBRADO'      │
         │ AuditLog: COBRO             │
         └──────┬──────────────────────┘
                │
                ▼
         ┌────────────────────────────┐
         │ Cierre Diario (Celery 21:00)
         │ ingresos += $2000           │
         │ Contador ve: "Pendientes: 0"
         │ Conciliación sugerida: 1    │
         └────────────────────────────┘
```

---

### 2. Flujo: Detección y Resolución de Rechazo SRI

```
┌─────────────────────────────┐
│ Factura enviada a SRI       │
│ estado='FACTURADO' (intento)│
└──────┬──────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ SRI responde RECHAZADO           │
│ código=26 (datos de cliente)     │
└──────┬───────────────────────────┘
       │
       │ SRIDocumentLog.crear(
       │   factura=x,
       │   estado_sri='RECHAZADO',
       │   codigo=26,
       │   mensaje='RUC no válido'
       │ )
       │
       ▼
┌──────────────────────────────────────────────┐
│ AlertEngine.generar_alertas_negocio()        │
│ (Celery @periodic / ejecuta en tiempo real) │
│ → emite Alert: tipo='SRI_RECHAZO'            │
│ → Alert.contexto = {factura: x, motivo: ...}│
└──────┬───────────────────────────────────────┘
       │
       ▼
     EMAIL → Contador
     "Factura #0001 rechazada: RUC cliente no válido"
       │
       ▼
┌────────────────────────────────────────────────┐
│ Dashboard Contador → Centro de Control SRI    │
│ ve factura #0001 en "RECHAZADOS"              │
│ click → modal "Detalles rechazo"              │
│ → SRIEngine diagnostica:                       │
│   "Código 26: RUC cliente inválido            │
│    Clientes RUC en sistema: 1700123456789"  │
│   Sugerencia: "Verificar cliente"             │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Contador corrige Cliente.ruc → 1700999999999 │
│ (guarda con AuditLog: CAMBIO_CLIENTE)        │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ Contador click "REINTENTAR"                   │
│ POST /api/control/sri/reintentar/{factura_id} │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ SRIEngine.enviar_factura_sri(factura)        │
│ → new SRIDocumentLog: intento_numero=2       │
│ → envía XML actualizado a SRI                │
└────────┬─────────────────────────────────────┘
         │
         ▼
       SRI responde ACEPTADO
         │
         ▼
┌──────────────────────────────────────────────┐
│ SRIDocumentLog.estado_sri = 'ACEPTADO'      │
│ SRIDocumentLog.resuelto = True               │
│ AuditLog: FACTURAR (intento 2, OK)           │
└────────┬─────────────────────────────────────┘
         │
         ▼
     EMAIL → Contador
     "✓ Factura #0001 aceptada por SRI"
     │
     └→ Dashboard Contador refresca
        "RECHAZADOS: 0"
        "ACEPTADOS: 1"
```

---

### 3. Flujo: Aprobación de Descuento Alto

```
┌──────────────────────────────────────┐
│ Vendedor intenta vender con 20%      │
│ descuento (política máx: 15%)        │
└────────┬─────────────────────────────┘
         │ POST /api/pos/aplicar_descuento
         │ descuento_pct=20
         │
         ▼
┌──────────────────────────────────────┐
│ PolicyEngine.validate_discount()     │
│ → rule.tipo = 'DESCUENTO_MANUAL'     │
│ → rule.require_aprobacion = True     │
│ → retorna: {"OK": False, "motivo":   │
│   "exceeds_policy", "requiere": ...} │
└────────┬─────────────────────────────┘
         │
         ▼ API retorna 403 + contexto
    ┌──────────────────────────────────┐
    │ Frontend:                        │
    │ UI muestra modal: "¿Realmente   │
    │ aplicar 20%? Requiere aprobación"│
    │ [Solicitar aprobación]           │
    └────────┬─────────────────────────┘
             │ click "Solicitar"
             │
             ▼
        ┌────────────────────────────┐
        │ ApprovalTicket.crear()     │
        │ tipo='DESCUENTO_ALTO'      │
        │ contexto={pct: 20, cliente}│
        │ estado='PENDIENTE'         │
        │ solicitante=vendedor       │
        └────────┬───────────────────┘
                 │
                 ▼
             EMAIL → Gerente
             "Descuento 20% requiere aprobación"
             Link: /aprobaciones
             │
             ▼
        ┌────────────────────────────┐
        │ Gerente abre app           │
        │ ve ApprovalTicket en list  │
        │ modal: contexto completo   │
        │ Usuario: Vendedor Pepe     │
        │ Cliente: ABC Corp          │
        │ Descuento: 20%             │
        │ [✓ Aprobar] [✗ Rechazar]   │
        └────────┬───────────────────┘
                 │ click "Aprobar"
                 │
                 ▼
        ┌────────────────────────────────────┐
        │ ApprovalTicket.estado='APROBADO'   │
        │ ApprovalTicket.approved_by=Gerente │
        │ ApprovalTicket.approved_at=NOW     │
        │ AuditLog: APPROVE contexto,...    │
        │ EMAIL → Vendedor: "✓ Aprobado"    │
        └────────┬───────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────┐
        │ Frontend: Aplicar descuento │
        │ si ticket.estado='APROBADO' │
        │ POST /api/pos/...           │
        │ con approval_ticket_id      │
        └────────┬────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────┐
        │ Backend: Validar ticket existe +    │
        │ estado=APROBADO                     │
        │ → Aplicar descuento                 │
        │ factura.approval_ticket_id = ticket │
        │ AuditLog: CAMBIO_PRECIO             │
        │ {"antes": 2000, "despues": 1600..   │
        │  "aprobacion_ticket": 123}          │
        └────────┬────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────┐
        │ Dashboard Gerente:      │
        │ "Descuentos aprobados:  │
        │  hoy 1, monto $400"    │
        └─────────────────────────┘
```

---

## Integración de Componentes

### 1. Policy Engine ↔ ApprovalTicket ↔ AuditLog

```
Vendedor intenta acción → PolicyEngine evalúa regla
    ↓
¿Requiere aprobación? → SÍ → ApprovalTicket.crear()
                      → NO → Permitir acción
                      
Aprobador aprueba → ApprovalTicket.estado='APROBADO'
                  → AuditLog: APPROVE (registra decisión)
                  → Ejecutar acción permitida
                  → AuditLog: CAMBIO_PRECIO/FACTURAR/etc
```

### 2. SRI Engine ↔ SRIDocumentLog ↔ AlertEngine

```
Enviar factura a SRI → SRIEngine.enviar()
                    ↓
                    SRIDocumentLog: guardar intento
                    ↓
                 ┌──┴─────┐
                 │        │
            ACEPTADO   RECHAZADO
                 │        │
                 ▼        ▼
            Factura=OK   AlertEngine emite alerta
                         └→ Sugerir diagnóstico
                         └→ Permitir reintento automático (Celery)
```

### 3. RentabilidadEngine ↔ CierreEngine ↔ Dashboard

```
Factura aceptada SRI → RentabilidadEngine.calcular_margen()
                     → VentaRentabilidad snapshot
                     
Fin de día (21:00)  → CierreEngine.generar_cierre_diario()
                    → Resumen ingresos, egresos, margen
                    → Sugerir conciliación bancaria
                    
Dashboard refresa → GET /api/control/dashboard/gerente/
                  → Lee CierreDiario, VentaRentabilidad, Alertas
                  → Muestra métricas en tiempo real
```

---

## Permisos y RBAC

```
Rol GERENTE:
  - Ver: Dashboards, Rentabilidad, Auditoria, Alertas
  - Hacer: Aprobar descuentos, Aprobar notas crédito, Generar reportes

Rol CONTADOR:
  - Ver: Dashboard contador, SRI estado, CxC/CxP, Auditoria
  - Hacer: Ejecutar cierre diario, Conciliar bancos, Reintentar SRI

Rol VENDEDOR:
  - Ver: Dashboard vendedor, Mi cartera, Rentabilidad (solo mis ventas)
  - Hacer: Crear cotización, Solicitar aprobaciones

Rol CAJERO:
  - Ver: Dashboard caja, Tickets abiertos
  - Hacer: Registrar cobro, Cerrar caja

Rol ADMIN (SUPER):
  - Todo: crear políticas, gestionar usuarios, ver todo
```

---

## Escalabilidad y Performance

### Índices Críticos (DB)
```
PolicyRule:
  INDEX (empresa_id, tipo, activa)
  
AuditLog:
  INDEX (empresa_id, timestamp)  -- Dashboard conta
  INDEX (usuario_id, timestamp)
  INDEX (content_type_id, object_id)  -- Auditar cambios en modelo X
  
SRIDocumentLog:
  INDEX (empresa_id, estado_sri, timestamp)  -- Para centro de control
  INDEX (factura_id)  -- Vincular a factura
  
VentaRentabilidad:
  INDEX (empresa_id, cliente_id, created_at)  -- Margen por cliente
  INDEX (margen_neto_pct)  -- Alertar margen bajo
  
CierreDiario:
  INDEX (empresa_id, fecha)  -- Único por empresa/fecha
```

### Caching (Redis)
```
- PolicyRule cache (TTL: 1 hora) → rápidas validaciones
- Dashboard metrics cache (TTL: 5 min) → no recalcular cada request
- AlertEngine cache (TTL: 30 min) → no spam de alertas iguales
```

### Celery Tasks (Concurrentes, No Bloqueantes)
```
reintentar_sri_pendientes()     → cada 15 min
generar_alertas_negocio()       → cada hora
generar_cierre_diario()         → 21:00 diario
calcular_rentabilidad()         → cada hora (batch)
enviar_reportes_ejecutivos()    → 22:00 diario
sincronizar_con_sri()           → cada 30 min
```

---

## Testing Strategy

### Unit Tests (Modelos + Engines)
```
test_policy_engine.py
  - test_validate_discount_ok()
  - test_validate_discount_requiere_aprobacion()
  - test_aplicar_politica_automatica()

test_workflow.py
  - test_approval_ticket_create()
  - test_approval_ticket_approve()
  - test_cant_delete_audit_log()

test_sri_engine.py
  - test_enviar_factura_sri_aceptado()
  - test_enviar_factura_sri_rechazado()
  - test_diagnosticar_error_code_26()
```

### Integration Tests (Flujos End-to-End)
```
test_order_to_cash.py
  - test_quote_to_invoice_to_payment()

test_approvals.py
  - test_high_discount_requires_approval()

test_sri_workflow.py
  - test_rejected_invoice_reintry()
```

### Performance Tests
```
test_dashboard_load_time < 2s
test_audit_query_with_1M_logs < 500ms
```

---

## Deployment & Rollout

### MVP Launch (Semana 4-5)
1. Deploy modelos + migraciones
2. Deploy APIs `/api/control/`
3. Deploy Dashboards por rol
4. Deploy SRI control + reintentos
5. Deploy Celery tasks en worker separado
6. UAT con 1-2 empresas piloto

### Post-Launch (Semana 6+)
1. Monitoreo: Sentry, DataDog
2. Optimizaciones: Índices DB, caché
3. Features adicionales: CRM, rentabilidad avanzada, integraciones bancarias

