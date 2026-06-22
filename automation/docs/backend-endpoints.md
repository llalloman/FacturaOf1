# Backend Automation Endpoints

Endpoints internos agregados para que n8n registre trazabilidad en FacturaOF1.

## Autenticacion

Usar header:

```http
X-Automation-Token: valor configurado en una credencial HTTP Header Auth de n8n
```

El backend lee el valor desde `AUTOMATION_API_TOKEN`. Si no esta configurado, los endpoints responden no autorizado. Tambien debe estar disponible en n8n como variable de entorno con el mismo nombre.

## Health

```http
GET /api/automation/health/
```

## Crear o Actualizar Lead

```http
POST /api/automation/leads/
```

Payload recomendado:

```json
{
  "phone": "593995298989",
  "source_channel": "whatsapp",
  "interest_type": "erp",
  "status": "new",
  "priority": "medium",
  "summary": "Cliente pregunta por ERP FacturaOF1",
  "last_category": "erp",
  "last_intent": "sales",
  "last_ai_confidence": "0.910"
}
```

El lead se actualiza por `normalized_phone + source_channel`.

## Registrar Interaccion WhatsApp

```http
POST /api/automation/interactions/
```

Payload inbound:

```json
{
  "direction": "INBOUND",
  "phone": "593995298989",
  "channel": "whatsapp",
  "message_body": "Quiero informacion del ERP",
  "message_type": "text",
  "message_id": "wamid-or-baileys-id",
  "idempotency_key": "whatsapp:inbound:593995298989:message-id",
  "category": "erp",
  "intent": "sales",
  "ai_confidence": "0.910",
  "ai_summary": "Cliente pregunta por ERP",
  "requires_human": false,
  "raw_payload": {}
}
```

Respuesta esperada:

- `201` y `created=true` si se registro por primera vez.
- `200` y `created=false` si es duplicado.

Payload outbound:

```json
{
  "direction": "OUTBOUND",
  "phone": "593995298989",
  "channel": "whatsapp",
  "message_body": "Plantilla enviada al cliente",
  "message_type": "text",
  "idempotency_key": "whatsapp:inbound:593995298989:message-id:reply",
  "category": "erp",
  "intent": "sales",
  "template_key": "erp_demo",
  "gateway_status": "sent"
}
```

## Registrar Aviso de Privacidad

```http
POST /api/automation/privacy-consents/
```

Uso: n8n debe llamarlo una sola vez por lead/contacto y versión de política, después de enviar el aviso corto de privacidad al usuario por WhatsApp.

```json
{
  "lead_id": 123,
  "contact_key": "593999999999@s.whatsapp.net",
  "phone": "593999999999",
  "privacy_notice_version": "privacidad-2026-06-22",
  "consent_source": "whatsapp",
  "consent_status": "informed",
  "metadata": {
    "workflow": "01_whatsapp_inbound",
    "message_id": "ABC123"
  }
}
```

Reglas:

- Si el contacto es `@lid`, no enviar ese valor como teléfono real; usarlo en `contact_key` y dejar `phone` vacío.
- El endpoint es idempotente por `contact_key + privacy_notice_version + consent_source`.
- `consent_status` debe ser `informed` para WhatsApp.
- El consentimiento explícito fuerte se mantiene solo en formularios oficiales como solicitud de firma electrónica.

## Consultar Contexto por Telefono

```http
GET /api/automation/leads/context/{phone}/?channel=whatsapp
```

Devuelve lead y ultimas 10 interacciones.

## Consultar Pedido de Firma

```http
GET /api/automation/signature-orders/{id_or_request_number}/
```

Devuelve resumen operativo sin URLs de documentos sensibles.

## Actualizar Estado de Pedido de Firma

```http
PATCH /api/automation/signature-orders/{id_or_request_number}/status/
```

Payload:

```json
{
  "status": "CONTACTADO",
  "comment": "Actualizado por workflow n8n."
}
```

## Registrar Evento Webhook

```http
POST /api/automation/webhook-events/
```

Guarda evento recibido/enviado para auditoria e idempotencia.

## Registrar Auditoria

```http
POST /api/automation/audit-events/
```

Payload:

```json
{
  "actor_type": "N8N",
  "actor_id": "01_whatsapp_inbound",
  "action": "whatsapp.reply.sent",
  "entity_type": "lead",
  "entity_id": "123",
  "metadata": {}
}
```
