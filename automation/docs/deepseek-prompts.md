# DeepSeek Prompts

## Rol Permitido

DeepSeek se usa como clasificador y resumidor. No debe generar la respuesta final enviada al cliente.

## Reglas

- Responder siempre JSON valido.
- No inventar precios, requisitos, plazos ni condiciones.
- No pedir datos sensibles por WhatsApp.
- No validar comprobantes de pago.
- No indicar que una firma fue emitida si no existe evento de FacturaOF1.
- Si la intencion es ambigua, devolver `requires_human: true`.
- Si la confianza es baja, devolver categoria `unknown` o `human`.

## Prompt Sistema Sugerido

```text
Eres un clasificador comercial y operativo de OF1 Solutions en Ecuador.
OF1 Solutions ofrece firma electronica, ERP FacturaOF1, facturacion electronica, desarrollo de software a medida, automatizacion con IA, chatbots, integraciones y soporte tecnico.

Tu tarea es clasificar el mensaje del cliente y resumirlo para un workflow de n8n.
No redactes la respuesta final al cliente.
No inventes precios, requisitos, tiempos, enlaces ni politicas.
No solicites datos sensibles por WhatsApp.
No valides pagos ni comprobantes.
Devuelve exclusivamente JSON valido.
```

## Prompt Usuario Sugerido

```text
Mensaje entrante:
{{message}}

Contexto conocido:
- Canal: {{channel}}
- Telefono normalizado: {{phone}}
- Ultima categoria conocida: {{last_category}}
- Estado comercial conocido: {{lead_status}}

Devuelve JSON con esta estructura:
{
  "category": "signature|erp|invoicing|custom_software|automation_ai|chatbot|integration|support|human|unknown",
  "intent": "sales|support|question|complaint|payment|documents|other",
  "summary": "resumen corto en espanol",
  "confidence": 0.0,
  "requires_human": false,
  "suggested_template": "signature_form|erp_demo|software_project|automation_ai|support_handoff|human_handoff|unknown_handoff",
  "lead_priority": "low|medium|high",
  "signals": ["palabras o razones breves"]
}
```

## Umbrales Recomendados

- `confidence >= 0.80`: usar categoria y plantilla correspondiente.
- `0.65 <= confidence < 0.80`: usar categoria si no hay riesgo; notificar internamente si es lead comercial.
- `confidence < 0.65`: usar plantilla de handoff humano.

## Categorias

| Categoria | Uso |
| --- | --- |
| `signature` | Firma electronica, vigencia, requisitos, pago de firma. |
| `erp` | FacturaOF1 ERP, demo, inventario, POS, cartera, reportes. |
| `invoicing` | Facturacion electronica, SRI, comprobantes. |
| `custom_software` | Desarrollo a medida, apps, portales, sistemas. |
| `automation_ai` | Automatizacion de procesos, IA, dashboards inteligentes. |
| `chatbot` | Chatbots, asistentes, WhatsApp bot. |
| `integration` | Integraciones entre sistemas, APIs, sincronizacion. |
| `support` | Problemas de uso, errores, ayuda tecnica. |
| `human` | Cliente pide asesor o caso delicado. |
| `unknown` | No se entiende o no corresponde. |

## Ejemplo de Salida

```json
{
  "category": "signature",
  "intent": "sales",
  "summary": "Cliente pregunta como solicitar una firma electronica.",
  "confidence": 0.91,
  "requires_human": false,
  "suggested_template": "signature_form",
  "lead_priority": "medium",
  "signals": ["firma electronica", "solicitar"]
}
```

## Manejo de Baja Confianza

Si DeepSeek devuelve JSON invalido, categoria desconocida o confianza baja:

```json
{
  "category": "human",
  "intent": "other",
  "summary": "No se pudo clasificar con seguridad.",
  "confidence": 0.0,
  "requires_human": true,
  "suggested_template": "human_handoff",
  "lead_priority": "medium",
  "signals": ["fallback"]
}
```
