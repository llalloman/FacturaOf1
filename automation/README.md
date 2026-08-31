# FacturaOF1 Automation

Automatización comercial y operativa de OF1 Solutions con n8n, PostgreSQL, DeepSeek y un WhatsApp Gateway basado en Baileys.

Esta carpeta contiene la infraestructura y documentación de la capa de automatización. La fuente de verdad de datos comerciales, solicitudes de firma, clientes, auditoría y estados debe seguir siendo FacturaOF1.

## Estado Actual

Flujo operativo existente:

```text
WhatsApp real
  -> whatsapp-gateway
  -> n8n
  -> DeepSeek
  -> clasificacion por categoria
  -> Switch en n8n
  -> respuesta por plantilla controlada
  -> WhatsApp Gateway
  -> cliente
```

Componentes versionados actualmente:

- `docker-compose.yml`: levanta PostgreSQL, n8n y `whatsapp-gateway`.
- `whatsapp-gateway/`: servicio Express + Baileys para recibir y enviar mensajes de WhatsApp.
- `n8n/workflows/`: carpeta reservada para exportar workflows. Actualmente solo contiene `.gitkeep`.
- `docs/`: documentación técnica de arquitectura, workflows, gateway y prompts.
- `openspec/`: especificaciones de cambios propuestos.

## Alcance

Incluye automatización para:

- Firma electrónica.
- ERP FacturaOF1.
- Facturación electrónica.
- Desarrollo de sistemas a medida.
- Automatización de procesos con IA.
- Chatbots y asistentes inteligentes.
- Integraciones entre sistemas.
- Soporte técnico relacionado con servicios OF1.

No incluye por ahora:

- Validación bancaria automática.
- Emisión automática en Nexus/Uanataca.
- RPA sobre proveedores de firma.
- Procesamiento automático definitivo de comprobantes de pago.
- Campañas masivas por WhatsApp.
- Respuestas libres generadas por IA sin plantilla controlada.

## Principios Operativos

- DeepSeek solo clasifica, resume y estima confianza.
- Las respuestas finales deben salir de plantillas controladas.
- No se deben inventar precios, requisitos, tiempos ni condiciones.
- WhatsApp no debe solicitar datos sensibles si pueden ingresarse por formulario.
- n8n coordina procesos; FacturaOF1 conserva la trazabilidad principal.
- Los workflows deben documentarse y exportarse en `automation/n8n/workflows/`.
- No versionar `.env`, sesiones de WhatsApp, tokens ni credenciales.

## Servicios Docker

- `postgres`: base de datos para n8n.
- `n8n`: orquestador de workflows.
- `whatsapp-gateway`: puente entre WhatsApp real y n8n.

## Variables de Entorno Esperadas

No documentar valores reales. Solo nombres esperados:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `TZ`
- `N8N_PORT`
- `N8N_HOST`
- `N8N_PROTOCOL`
- `N8N_WEBHOOK_URL`
- `N8N_ENCRYPTION_KEY`
- `N8N_BASIC_AUTH_ACTIVE`
- `N8N_BASIC_AUTH_USER`
- `N8N_BASIC_AUTH_PASSWORD`
- `FACTURAOF1_API_URL`
- `FACTURAOF1_API_TOKEN`
- `AUTOMATION_API_TOKEN`
- `FACTURAOF1_SIGNATURE_FORM_URL`
- `AI_PROVIDER`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `MAIL_FROM`
- `MAIL_INTERNAL_TO`
- `MAIL_INFO_TO`
- `WHATSAPP_GATEWAY_PORT`
- `N8N_WEBHOOK_URL` para el gateway, apuntando al webhook inbound de n8n.

## Documentacion

- `docs/architecture.md`: arquitectura objetivo y responsabilidades.
- `docs/workflows.md`: estado actual y workflows propuestos.
- `docs/whatsapp-gateway.md`: contrato del gateway Baileys.
- `docs/whatsapp-contact-identity.md`: manejo correcto de `phone`, `contact_key`, `reply_to_jid` y JIDs `@lid`.
- `docs/n8n-workflows.md`: detalle n8n del flujo `01_whatsapp_inbound` y nuevos workflows.
- `docs/n8n-session-recovery.md`: recuperacion de sesion n8n, reconexion de WhatsApp Gateway y checklist operativo.
- `docs/deepseek-prompts.md`: prompts y reglas para clasificacion controlada.
- `docs/technical-plan.md`: plan tecnico consolidado para revision antes de implementar.
- `docs/backend-endpoints.md`: endpoints internos ya preparados para integración con n8n.
