# Design: OF1 WhatsApp Commercial Automation

## Arquitectura Propuesta

```text
WhatsApp real
  -> whatsapp-gateway
  -> n8n 01_whatsapp_inbound
  -> FacturaOF1 API: registrar interaccion / lead
  -> DeepSeek: clasificar y resumir
  -> n8n: seleccionar plantilla
  -> whatsapp-gateway: enviar respuesta
  -> FacturaOF1 API: registrar salida / auditoria
```

Eventos operativos desde FacturaOF1:

```text
FacturaOF1
  -> Webhook Dispatcher
  -> n8n workflow por evento
  -> WhatsApp Gateway / correo interno
  -> FacturaOF1 auditoria
```

## Workflows

### 01_whatsapp_inbound

Se mantiene el flujo existente, agregando de forma incremental:

- Registro de interaccion entrante.
- Idempotencia.
- Clasificacion venta/soporte/consulta.
- Lead upsert por telefono.
- Handoff humano por baja confianza.
- Registro de interaccion saliente.

### 02_signature_order_created

Evento `signature_order.created`.

Objetivo: confirmar solicitud y activar seguimiento inicial.

### 03_signature_order_incomplete

Evento `signature_order.incomplete`.

Objetivo: pedir datos o documentos pendientes sin solicitar datos sensibles por WhatsApp.

### 04_payment_proof_uploaded

Evento `payment.proof_uploaded`.

Objetivo: confirmar recepcion y avisar validacion manual.

### 05_payment_validated

Evento `payment.validated`.

Objetivo: comunicar pago validado y mover el proceso a preparacion.

### 06_ready_for_manual_issuance

Evento `signature_order.ready_for_issuance`.

Objetivo: notificar internamente que un operador debe emitir en Nexus/Uanataca.

### 07_signature_issued

Evento `signature_order.issued`.

Objetivo: notificar emision y registrar cierre.

### 08_pending_follow_up

Trigger cron.

Objetivo: recordar leads/pedidos pendientes con control de frecuencia.

## Payloads Estandar

Todos los eventos deben incluir:

```json
{
  "event_id": "uuid",
  "event_type": "lead.created",
  "occurred_at": "2026-06-16T10:00:00-05:00",
  "source": "facturaof1",
  "version": "1.0",
  "idempotency_key": "event-type:entity-id:timestamp-or-version",
  "data": {}
}
```

### signature_order.created

```json
{
  "event_id": "uuid",
  "event_type": "signature_order.created",
  "occurred_at": "2026-06-16T10:00:00-05:00",
  "source": "facturaof1",
  "version": "1.0",
  "idempotency_key": "signature_order.created:123",
  "data": {
    "order_id": 123,
    "request_number": "FE-000123",
    "request_type": "PERSONA_NATURAL",
    "validity": "1_ANIO",
    "customer_name": "Nombre Apellido",
    "phone": "593999999999",
    "email": "cliente@example.com",
    "status": "CREATED",
    "total": "21.00",
    "currency": "USD",
    "payment_required": true
  }
}
```

### signature_order.incomplete

```json
{
  "event_type": "signature_order.incomplete",
  "data": {
    "order_id": 123,
    "request_number": "FE-000123",
    "phone": "593999999999",
    "missing_fields": ["documentos"],
    "missing_documents": ["cedula_anverso", "cedula_reverso"],
    "form_url": "https://facturaof1.of1solutions.com/solicitar-firma-electronica"
  }
}
```

### payment.proof_uploaded

```json
{
  "event_type": "payment.proof_uploaded",
  "data": {
    "payment_id": 456,
    "order_id": 123,
    "request_number": "FE-000123",
    "phone": "593999999999",
    "uploaded_at": "2026-06-16T10:15:00-05:00",
    "requires_manual_validation": true
  }
}
```

### payment.validated

```json
{
  "event_type": "payment.validated",
  "data": {
    "payment_id": 456,
    "order_id": 123,
    "request_number": "FE-000123",
    "phone": "593999999999",
    "validated_by": "user-id-or-name",
    "validated_at": "2026-06-16T10:30:00-05:00"
  }
}
```

### signature_order.ready_for_issuance

```json
{
  "event_type": "signature_order.ready_for_issuance",
  "data": {
    "order_id": 123,
    "request_number": "FE-000123",
    "request_type": "PERSONA_NATURAL",
    "phone": "593999999999",
    "operator_queue": "signature_issuance",
    "manual_issuance_required": true
  }
}
```

### signature_order.issued

```json
{
  "event_type": "signature_order.issued",
  "data": {
    "order_id": 123,
    "request_number": "FE-000123",
    "phone": "593999999999",
    "issued_at": "2026-06-16T12:00:00-05:00",
    "delivery_status": "READY"
  }
}
```

### lead.created

```json
{
  "event_type": "lead.created",
  "data": {
    "lead_id": 789,
    "phone": "593999999999",
    "name": "Cliente",
    "company": "Empresa",
    "email": "cliente@example.com",
    "interest_type": "erp|signature|software|automation_ai|support|unknown",
    "source_channel": "whatsapp",
    "priority": "low|medium|high"
  }
}
```

### lead.requires_human

```json
{
  "event_type": "lead.requires_human",
  "data": {
    "lead_id": 789,
    "phone": "593999999999",
    "reason": "low_ai_confidence|enterprise_opportunity|support_case|complaint|payment_question",
    "last_message_summary": "Resumen del ultimo mensaje",
    "priority": "medium"
  }
}
```

## Endpoints Propuestos en FacturaOF1

### Leads

`POST /api/automation/leads/`

Crea o actualiza lead comercial por telefono/canal.

### Interacciones WhatsApp

`POST /api/automation/interactions/`

Registra mensaje entrante o saliente.

### Consultar Pedido de Firma

`GET /api/automation/signature-orders/{id}/`

Devuelve resumen operativo sin documentos sensibles.

### Actualizar Estado de Pedido

`PATCH /api/automation/signature-orders/{id}/status/`

Permite cambios de estado autorizados desde workflows aprobados o acciones internas.

### Disparar Webhooks hacia n8n

Servicio interno `AutomationWebhookDispatcher`.

Responsable de construir payload estandar, firmarlo o autenticarlo, reintentar y auditar.

### Auditoria

`POST /api/automation/audit-events/`

Registra eventos de automatizacion, errores, reintentos y resultados.

## Modelos Sugeridos

### CommercialLead

Campos sugeridos:

- `id`
- `phone`
- `normalized_phone`
- `name`
- `company`
- `email`
- `interest_type`
- `source_channel`
- `status`
- `priority`
- `last_interaction_at`
- `assigned_to`
- `created_at`
- `updated_at`

### WhatsAppInteraction

Campos sugeridos:

- `id`
- `lead`
- `signature_order`
- `direction` (`INBOUND`, `OUTBOUND`)
- `phone`
- `message_body`
- `message_type`
- `message_id`
- `idempotency_key`
- `category`
- `intent`
- `ai_confidence`
- `template_key`
- `gateway_status`
- `created_at`

### AutomationWebhookEvent

Campos sugeridos:

- `id`
- `event_id`
- `event_type`
- `entity_type`
- `entity_id`
- `payload`
- `target_url`
- `status`
- `attempt_count`
- `last_error`
- `sent_at`
- `created_at`

### AutomationAuditLog

Campos sugeridos:

- `id`
- `actor_type` (`SYSTEM`, `N8N`, `USER`)
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

## Riesgos

- Duplicidad de mensajes por reintentos.
- Mala clasificacion si no hay umbral de confianza.
- Solicitudes sensibles por WhatsApp.
- Automatizaciones enviando mensajes fuera de horario.
- Dependencia de disponibilidad de WhatsApp Web.
- Logs con datos personales.

## Orden de Implementacion

1. Versionar export actual de `01_whatsapp_inbound`.
2. Crear modelos de leads, interacciones, webhook events y auditoria.
3. Crear endpoints automation protegidos por token.
4. Agregar registro de interacciones al workflow actual.
5. Agregar idempotencia y manejo de mensajes vacios/multimedia.
6. Implementar webhooks desde FacturaOF1 hacia n8n.
7. Crear workflows `02` a `08` de forma incremental.
8. Activar notificaciones internas.
9. QA operativo con casos reales controlados.

## Checklist de Pruebas

- Mensaje de firma electronica clasifica `signature` y responde con plantilla.
- Mensaje de ERP clasifica `erp` y no habla solo de firma.
- Mensaje de desarrollo a medida clasifica `custom_software`.
- Mensaje de soporte clasifica `support`.
- Mensaje ambiguo activa handoff humano.
- Mensaje vacio no llama DeepSeek.
- Multimedia no rompe el flujo.
- Reintento con mismo `idempotency_key` no duplica respuesta.
- Lead nuevo se crea una sola vez por telefono/canal.
- Interaccion entrante y saliente se auditan.
- Evento de comprobante no valida pago automaticamente.
- Evento ready for issuance notifica humano, no emite automaticamente.
