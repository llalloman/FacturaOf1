# Plan Tecnico: Automatizacion Comercial OF1 WhatsApp

## Alcance

Implementar de forma incremental una automatizacion comercial y operativa para OF1 Solutions sobre el flujo existente de WhatsApp, n8n, DeepSeek y Baileys.

Incluye:

- Captura y actualizacion de leads.
- Registro de interacciones WhatsApp.
- Clasificacion por venta, soporte y consulta.
- Contexto por numero telefonico.
- Handoff humano por baja confianza.
- Eventos de ciclo de vida para pedidos de firma electronica.
- Notificaciones internas.
- Seguimientos pendientes.

No incluye:

- Validacion bancaria automatica.
- Emision automatica en Nexus/Uanataca.
- Lectura o cambio de credenciales.
- Envio de documentos sensibles a DeepSeek.
- Respuestas finales generadas libremente por IA.

## Arquitectura

```text
WhatsApp real
  -> whatsapp-gateway Baileys
  -> n8n 01_whatsapp_inbound
  -> FacturaOF1 API automation
  -> DeepSeek clasifica/resume
  -> n8n selecciona plantilla
  -> whatsapp-gateway /sendText
  -> FacturaOF1 registra salida y auditoria
```

Eventos desde FacturaOF1:

```text
FacturaOF1 evento interno
  -> AutomationWebhookDispatcher
  -> n8n workflow por evento
  -> WhatsApp Gateway / correo interno
  -> FacturaOF1 auditoria
```

## Workflows

| Workflow | Trigger | Objetivo |
| --- | --- | --- |
| `01_whatsapp_inbound` | WhatsApp Gateway | Clasificar mensaje y responder con plantilla. |
| `02_signature_order_created` | `signature_order.created` | Confirmar solicitud creada. |
| `03_signature_order_incomplete` | `signature_order.incomplete` | Recordar datos o documentos pendientes. |
| `04_payment_proof_uploaded` | `payment.proof_uploaded` | Confirmar comprobante recibido y avisar validacion humana. |
| `05_payment_validated` | `payment.validated` | Informar pago validado. |
| `06_ready_for_manual_issuance` | `signature_order.ready_for_issuance` | Notificar emision manual pendiente. |
| `07_signature_issued` | `signature_order.issued` | Notificar firma emitida. |
| `08_pending_follow_up` | Cron/SLA | Dar seguimiento a leads o pedidos sin avance. |

## Endpoints Propuestos

| Endpoint | Metodo | Uso |
| --- | --- | --- |
| `/api/automation/leads/` | `POST` | Crear o actualizar lead por telefono/canal. |
| `/api/automation/interactions/` | `POST` | Registrar interaccion entrante o saliente. |
| `/api/automation/signature-orders/{id}/` | `GET` | Consultar resumen operativo de pedido. |
| `/api/automation/signature-orders/{id}/status/` | `PATCH` | Actualizar estado autorizado. |
| `/api/automation/audit-events/` | `POST` | Registrar auditoria tecnica/operativa. |

Servicio interno:

- `AutomationWebhookDispatcher`: construye eventos estandar, los envia a n8n, reintenta y audita.

## Tablas o Modelos Sugeridos

### CommercialLead

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

### WhatsAppInteraction

- `lead`
- `signature_order`
- `direction`
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

### AutomationWebhookEvent

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

### AutomationAuditLog

- `actor_type`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`

## Payload Base de Eventos

```json
{
  "event_id": "uuid",
  "event_type": "signature_order.created",
  "occurred_at": "2026-06-16T10:00:00-05:00",
  "source": "facturaof1",
  "version": "1.0",
  "idempotency_key": "signature_order.created:123",
  "data": {}
}
```

Eventos iniciales:

- `signature_order.created`
- `signature_order.incomplete`
- `payment.proof_uploaded`
- `payment.validated`
- `signature_order.ready_for_issuance`
- `signature_order.issued`
- `lead.created`
- `lead.requires_human`

## Riesgos

- Duplicacion de respuestas por reintentos.
- Loops de mensajes si no se respeta `fromMe`.
- Baja confianza de IA mal manejada.
- Usuarios enviando documentos o pagos por WhatsApp.
- Logs con datos personales.
- Indisponibilidad de WhatsApp Web.
- Prometer tiempos, precios o requisitos no aprobados.

## Orden de Implementacion

1. Exportar el workflow actual `01_whatsapp_inbound` desde n8n.
2. Validar plantillas comerciales y de soporte.
3. Crear modelos de lead, interaccion, webhook event y auditoria.
4. Crear endpoints protegidos para automation.
5. Agregar registro de interacciones al workflow actual.
6. Agregar idempotencia, mensajes vacios, multimedia y baja confianza.
7. Crear dispatcher de webhooks desde FacturaOF1.
8. Implementar workflows `02` a `08` uno por uno.
9. Ejecutar QA operativo y activar progresivamente.

## Checklist de Pruebas

- [ ] Mensaje de firma responde con formulario oficial.
- [ ] Mensaje de ERP responde como oportunidad ERP.
- [ ] Mensaje de facturacion electronica clasifica correctamente.
- [ ] Mensaje de desarrollo a medida crea lead adecuado.
- [ ] Mensaje de automatizacion IA no se confunde con soporte.
- [ ] Mensaje de soporte se deriva a soporte.
- [ ] Mensaje ambiguo activa handoff humano.
- [ ] Mensaje vacio no llama DeepSeek.
- [ ] Multimedia se maneja sin enviar archivo a IA.
- [ ] Reintento duplicado no envia doble respuesta.
- [ ] Lead existente se actualiza, no se duplica.
- [ ] Comprobante cargado notifica validacion manual.
- [ ] Pago validado solo ocurre por accion humana.
- [ ] Ready for issuance no emite en Nexus/Uanataca.
- [ ] Todos los eventos quedan auditados.
