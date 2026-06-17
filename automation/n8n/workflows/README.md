# n8n Workflow Implementation

Esta carpeta contiene plantillas y guias para afinar los workflows de n8n sin romper el flujo activo.

## Prioridad inmediata sobre el workflow actual

En el canvas existente `01_whatsapp_inbound`, agrega estas piezas alrededor de lo que ya funciona:

1. Despues de `Edit Fields`, agregar `Normalize + Idempotency`.
2. Despues de normalizar, agregar `Register Inbound Interaction` contra FacturaOF1.
3. Si `created=false`, terminar el flujo para evitar respuesta duplicada.
4. Si `message_type != text` o `body` esta vacio, responder con plantilla multimedia/vacio sin llamar DeepSeek.
5. Mantener DeepSeek como clasificador.
6. Despues de `Code in JavaScript`, validar `confidence`.
7. Si `confidence < 0.65`, usar plantilla de handoff humano.
8. Antes de enviar WhatsApp, preparar payload como ya haces.
9. Despues de enviar WhatsApp, agregar `Register Outbound Interaction`.

## Endpoints FacturaOF1 disponibles

Todos requieren header:

```http
X-Automation-Token: valor configurado en una credencial HTTP Header Auth de n8n
```

Endpoints:

- `POST {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/leads/`
- `POST {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/interactions/`
- `GET {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/leads/context/{{phone}}/`
- `GET {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/signature-orders/{{id_or_request_number}}/`
- `PATCH {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/signature-orders/{{id_or_request_number}}/status/`
- `POST {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/webhook-events/`
- `POST {{FACTURAOF1_API_URL_CONFIGURADO_EN_NODO}}/api/automation/audit-events/`

## Archivos

- `01_whatsapp_inbound_hardening.md`: instrucciones exactas para ajustar el workflow actual.
- `01_whatsapp_inbound_hardened.template.json`: plantilla base importable/referencial.
- `event-workflows.template.json`: skeleton de workflows `02` a `08` para construir por evento.
