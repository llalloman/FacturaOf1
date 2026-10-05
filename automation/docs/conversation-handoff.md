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

## Expiracion y reanudacion del bot

El `GET /api/automation/leads/context/{contact_key}/?channel=whatsapp` comprueba transaccionalmente los modos humanos antes de serializar el lead. Si `HUMAN_PENDING` supera `AUTOMATION_HUMAN_PENDING_TIMEOUT_MINUTES` desde `human_requested_at`, o `HUMAN_ACTIVE` supera `AUTOMATION_HUMAN_ACTIVE_TIMEOUT_MINUTES` desde `human_last_activity_at` (con `human_active_at` como fallback), registra una transicion de sistema a `BOT`, pone la etapa en `active`, limpia `handoff_reason` y guarda `bot_resumed_at`. El inbound que provoco la consulta puede continuar por el mismo guard de n8n. No se borran interacciones, resumen, categoria ni intencion.

Los valores por defecto son 10 minutos para `HUMAN_PENDING` y 30 minutos para `HUMAN_ACTIVE`; valores configurados menores a 1 se ajustan a 1. El backend actualiza `human_last_activity_at` al tomar la conversacion, al enviar desde el panel y al registrar un mensaje con `sender_type=HUMAN`, incluido el outbound manual detectado por el gateway.

La accion existente `PATCH /api/automation/admin/leads/{lead_id}/conversation/` con `{"conversation_mode":"BOT"}` devuelve al bot desde `HUMAN_PENDING` o `HUMAN_ACTIVE`, registra el actor y conserva todo el historial. La bandeja muestra la ultima actividad humana y la hora de reanudacion; tambien permite devolver directamente a BOT mientras espera asesor.

En n8n, `confidence < 0.65` por si sola no debe activar handoff. Para baja confianza en consultas normales, responde con una pregunta aclaratoria; reserva `requires_human=true` para solicitud explicita, pago por validar, reclamo, incidencia critica o limite tecnico. Actualiza esa condicion en el workflow activo siguiendo `automation/n8n/workflows/01_whatsapp_inbound_hardening.md`; el cambio local no modifica la instancia activa de n8n.

## Contexto comercial para n8n

FacturaOF1 expone el contexto comercial para clientes internos autenticados. El endpoint es de solo lectura y no modifica leads ni sus estados `BOT`, `HUMAN_PENDING` o `HUMAN_ACTIVE`.

`GET /api/automation/commercial-context/?channel=whatsapp`

Enviar `X-Automation-Token: $AUTOMATION_API_TOKEN` o `Authorization: Bearer $AUTOMATION_API_TOKEN`. La respuesta contiene información de servicios, enlaces oficiales, catálogo activo de firmas electrónicas con promociones vigentes y cupones vigentes marcados `public_to_ai`. Los precios provienen de `FirmaPrecioElectronica` y las promociones de `FirmaPromocionElectronica`; los cupones no se exponen hasta habilitar `Visible para automation` en el admin.

Ejemplo de estructura (los montos, promociones y cupones reales salen de la base de datos):

```json
{
  "source_of_truth": "FacturaOF1",
  "generated_at": "2026-10-04T12:00:00+00:00",
  "channel": "whatsapp",
  "service_info": {
    "company": "OF1 Solutions",
    "country": "Ecuador",
    "services": [
      {
        "code": "signature",
        "name": "Firma electrónica",
        "description": "Emisión de certificados de firma electrónica para personas y empresas."
      }
    ],
    "links": {
      "website": "https://of1solutions.com/",
      "signature_request": "https://facturaof1.of1solutions.com/solicitar-firma-electronica"
    }
  },
  "signature_catalog": [
    {
      "code": "1_ANIO",
      "name": "1 año",
      "regular_price": "115.00",
      "current_price": "115.00",
      "currency": "USD",
      "price_includes_tax": true,
      "tax_rate": "15.00",
      "promotion": null
    }
  ],
  "public_coupons": []
}
```

`POST /api/automation/commercial-context/validate-coupon/`

Usa los mismos encabezados de autenticación. Cuerpo:

```json
{
  "channel": "whatsapp",
  "code": "FIRMA10",
  "plan_code": "1_ANIO",
  "identification": "0102030405"
}
```

`plan_code` usa los códigos del catálogo (`7_DIAS`, `1_MES`, `1_ANIO`, `2_ANIOS`, etc.). `identification`, `email` o `phone` son opcionales; si se omiten, el endpoint no puede comprobar el límite de usos por cliente. La respuesta es una cotización informativa, no reserva el cupón; la solicitud final vuelve a validar disponibilidad y registra el uso.

Alcance del catálogo de promociones y cupones: el API refleja las reglas actuales del checkout. Los cupones tienen límites globales y por cliente. Las promociones existentes se aplican por vigencia y rango de fechas, sin reglas por tipo de cliente o límite de usos.
