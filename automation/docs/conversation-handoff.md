# Handoff humano de WhatsApp

Este flujo guarda el estado de conversación en FacturaOF1. n8n clasifica y propone mensajes, el backend controla el estado y registra los mensajes que envía el gateway.

## Configuración

Configurar en el entorno del backend:

- `AUTOMATION_API_TOKEN`: token que usan n8n y el gateway para la API de automation.
- `AUTOMATION_HANDOFF_NOTIFICATION_EMAIL`: correo que recibe cada nueva solicitud de asesor. El valor de ejemplo es `walter.molina@of1solutions.com`; reemplazarlo por el buzón operativo deseado.
- `WHATSAPP_GATEWAY_URL`: URL interna alcanzable desde FacturaOF1, por ejemplo `http://host.docker.internal:8081` si gateway corre en el host.
- `WHATSAPP_GATEWAY_TOKEN`: secreto compartido para el endpoint interno de envío.
- `WHATSAPP_GATEWAY_TIMEOUT_SECONDS`: timeout de envío, por defecto 10 segundos.

Configurar en `automation/.env` (sin guardar este archivo en Git):

- `FACTURAOF1_API_URL`: base URL de FacturaOF1, sin `/api` final o con `/api` final.
- `AUTOMATION_API_TOKEN`: mismo token de automation del backend.
- `WHATSAPP_GATEWAY_TOKEN`: mismo secreto compartido del backend.
- `REDIS_URL`: `redis://redis:6379/0` cuando se usa el Compose de automation.

Copiar primero las claves correspondientes de `.env.example` y usar valores secretos distintos de los ejemplos.

## Flujo de n8n `01_whatsapp_inbound`

1. Mantener los nodos existentes que normalizan el mensaje y registran el inbound en `POST /api/automation/interactions/`. Conservar `lead_id`, `contact_key`, `reply_to_jid`, `message_id` y una `idempotency_key` estable.
2. Después del inbound, obtener el contexto desde `GET /api/automation/leads/context/{contact_key}/?channel=whatsapp`. El objeto `lead` ahora incluye `conversation_mode`, `conversation_stage` y campos de handoff.
3. Antes de DeepSeek y antes de responder, terminar el flujo si `lead.conversation_mode` es `HUMAN_PENDING` o `HUMAN_ACTIVE`. Solo `BOT` continúa.
4. Si DeepSeek decide responder, enviar el texto con `POST /api/automation/leads/{lead_id}/messages/`, no con el `sendText` público del gateway. Usar el token de automation y un identificador idempotente determinístico, por ejemplo `n8n:reply:{inbound_message_id}`:

```json
{
  "message": "Texto aprobado por el flujo",
  "idempotency_key": "n8n:reply:wamid-123"
}
```

Este endpoint vuelve a comprobar que el modo sea `BOT`, registra la interacción como IA y solicita el envío autenticado al gateway.

5. Si la clasificación determina handoff, primero llamar `PATCH /api/automation/leads/{lead_id}/conversation/`:

```json
{
  "conversation_mode": "HUMAN_PENDING",
  "conversation_stage": "handoff",
  "handoff_reason": "customer_requested_human"
}
```

Usar motivos explícitos como `customer_requested_human` o `low_confidence`. El backend registra la transición y envía una alerta de correo una vez por transición a `HUMAN_PENDING`.

6. Enviar una sola respuesta breve mediante el mismo endpoint de mensajes, incluyendo `handoff_ack: true` y `idempotency_key` exactamente con el formato `handoff-ack:{lead_id}:{human_requested_at}`. Para el sufijo, usar el valor ISO de `lead.human_requested_at` devuelto por FacturaOF1; el backend valida que corresponda a la solicitud actual y rechaza cualquier segunda confirmación de esa transición, incluso con otra clave. La interacción queda `sender_type=AI`, `origin=n8n_handoff_ack`. A continuación, terminar el flujo.

No actualizar el modo a `BOT` automáticamente al recibir otro inbound. El asesor devuelve el control desde FacturaOF1.

## Bandeja de FacturaOF1 y mensajes manuales

La bandeja de `/automation/leads` permite a `SUPER_ADMIN`, `ADMIN_EMPRESA` y `VENDEDOR` ver leads WhatsApp sin asignar o propios. Un asesor toma un lead para cambiarlo a `HUMAN_ACTIVE`, responde desde la bandeja y puede devolverlo a `BOT`. La API aplica permisos sobre el responsable asignado y registra las transiciones.

Cuando una persona responde desde WhatsApp Web/dispositivo vinculado, Baileys informa un mensaje `fromMe` nuevo. El gateway descarta grupos, estados y mensajes originados por su propio `/sendText`, y reporta los mensajes manuales a `POST /api/automation/gateway/manual-outbound/`. FacturaOF1 los registra como `HUMAN` y cambia el modo a `HUMAN_ACTIVE`. Si no había responsable asignado, un asesor puede tomar la conversación desde la bandeja. Redis guarda marcadores de origen por cinco minutos; la clave idempotente persistida en FacturaOF1 protege el registro frente a reintentos.

El endpoint legado `POST /sendText` permanece para compatibilidad con n8n y consulta el modo en FacturaOF1 antes de permitir un envío del bot; si falta la URL/token o FacturaOF1 no está disponible, falla cerrado. Para nuevos nodos de respuesta usar el endpoint autenticado de FacturaOF1, que también registra el mensaje antes de completar la solicitud.

## Activación y verificación operativa

Los archivos de este repositorio preparan backend, gateway y UI; no modifican una instancia activa de n8n ni despliegan contenedores. Actualizar/importar el workflow `01_whatsapp_inbound` con la secuencia anterior, aplicar la migración Django y desplegar backend/gateway antes de probar en producción. Reiniciar gateway y backend para que tomen configuración y dependencias.

Verificar primero un inbound con modo `BOT`; luego solicitar handoff y comprobar `HUMAN_PENDING`, una alerta de correo y una sola confirmación. Probar una respuesta manual desde WhatsApp Web y comprobar que FacturaOF1 marca `HUMAN_ACTIVE`; confirmar que nuevos inbound no disparan respuesta de IA. Finalmente devolver la conversación a `BOT` y comprobar respuesta desde la bandeja.

No borrar la sesión del gateway para esta activación: conservar la sesión vinculada de WhatsApp.
