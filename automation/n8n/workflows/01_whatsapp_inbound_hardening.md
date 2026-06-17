# 01_whatsapp_inbound Hardening

## Nodo: Normalize + Idempotency

Agregar un nodo `Code` despues de `Edit Fields`.

```javascript
const input = $json;
const phone = String(input.from || input.phone || '').replace(/\D/g, '');
let normalizedPhone = phone;
if (normalizedPhone.startsWith('0')) normalizedPhone = `593${normalizedPhone.slice(1)}`;
if (!normalizedPhone.startsWith('593') && normalizedPhone.length === 9) normalizedPhone = `593${normalizedPhone}`;

const messageBody = String(input.body || input.message || '').trim();
const messageType = input.message_type || (messageBody ? 'text' : 'unknown');
const messageId = input.message_id || '';
const idempotencyKey = messageId
  ? `whatsapp:inbound:${normalizedPhone}:${messageId}`
  : `whatsapp:inbound:${normalizedPhone}:${Buffer.from(`${messageBody}:${input.timestamp || ''}`).toString('base64')}`;

return [{
  json: {
    ...input,
    phone: normalizedPhone,
    message: messageBody,
    message_type: messageType,
    message_id: messageId,
    idempotency_key: idempotencyKey,
    is_empty: !messageBody,
    is_media: Boolean(input.has_media) || !['text', 'unknown'].includes(messageType),
    received_at: new Date((Number(input.timestamp) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  }
}];
```

## Nodo: Register Inbound Interaction

Agregar `HTTP Request` despues de normalizar.

- Method: `POST`
- URL: `{{$env.FACTURAOF1_API_URL}}/api/automation/interactions/`
- Header: `X-Automation-Token: {{$env.AUTOMATION_API_TOKEN}}`
- Body JSON:

```json
{
  "direction": "INBOUND",
  "phone": "={{$json.phone}}",
  "channel": "whatsapp",
  "message_body": "={{$json.message}}",
  "message_type": "={{$json.message_type}}",
  "message_id": "={{$json.message_id}}",
  "idempotency_key": "={{$json.idempotency_key}}",
  "raw_payload": "={{$json}}"
}
```

## Nodo: Duplicate Guard

Agregar `IF` despues de registrar inbound.

Condicion:

```text
{{$json.created}} is false
```

Si es `true`, terminar sin responder.

## Nodo: Empty/Media Guard

Antes de DeepSeek, agregar IF:

```text
{{$node["Normalize + Idempotency"].json.is_empty}} is true
OR
{{$node["Normalize + Idempotency"].json.is_media}} is true
```

Si es multimedia/vacio, no llamar DeepSeek. Usar plantilla:

```text
Gracias por escribir a OF1 Solutions. Para revisar documentos o comprobantes correctamente, utiliza el formulario oficial o espera la ayuda de un asesor. No envies claves ni datos sensibles por este chat.
```

## DeepSeek Output Esperado

El nodo `Code in JavaScript` que parsea DeepSeek debe dejar este shape:

```json
{
  "category": "signature",
  "intent": "sales",
  "summary": "Cliente pregunta por firma electrónica",
  "confidence": 0.91,
  "requires_human": false,
  "suggested_template": "signature_form",
  "lead_priority": "medium"
}
```

## Nodo: AI Confidence Guard

Despues de parsear DeepSeek, si:

```text
confidence < 0.65 OR requires_human = true
```

Enviar plantilla `human_handoff` y notificar internamente.

## Nodo: Register Outbound Interaction

Despues de `WhatsApp Gateway - Send Message`, agregar `HTTP Request`.

- Method: `POST`
- URL: `{{$env.FACTURAOF1_API_URL}}/api/automation/interactions/`
- Header: `X-Automation-Token: {{$env.AUTOMATION_API_TOKEN}}`
- Body JSON:

```json
{
  "direction": "OUTBOUND",
  "phone": "={{$node["Normalize + Idempotency"].json.phone}}",
  "channel": "whatsapp",
  "message_body": "={{$node["Prepare WhatsApp Payload"].json.message}}",
  "message_type": "text",
  "idempotency_key": "={{$node["Normalize + Idempotency"].json.idempotency_key + ':reply'}}",
  "category": "={{$node["Code in JavaScript"].json.category}}",
  "intent": "={{$node["Code in JavaScript"].json.intent}}",
  "ai_confidence": "={{$node["Code in JavaScript"].json.confidence}}",
  "ai_summary": "={{$node["Code in JavaScript"].json.summary}}",
  "requires_human": "={{$node["Code in JavaScript"].json.requires_human}}",
  "template_key": "={{$node["Code in JavaScript"].json.suggested_template}}",
  "gateway_status": "sent"
}
```

## Categorias que deben existir en Switch Intent

- `signature`
- `erp`
- `invoicing`
- `custom_software`
- `automation_ai`
- `chatbot`
- `integration`
- `support`
- `payment`
- `documents`
- `greeting`
- `human`
- `unknown`

Las categorias antiguas como compra firma, precio, estado pedido y envio comprobante pueden mantenerse como subintenciones, pero conviene mapearlas a `category=intent` para trazabilidad.
