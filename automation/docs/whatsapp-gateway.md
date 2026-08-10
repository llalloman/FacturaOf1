# WhatsApp Gateway

## Proposito

`whatsapp-gateway` es un servicio Node.js con Express y Baileys que conecta WhatsApp real con n8n.

No contiene logica comercial. Solo transporta mensajes entrantes y salientes.

## Stack

- Node.js 20.
- Express.
- `@whiskeysockets/baileys`.
- Axios.
- `qrcode-terminal`.
- Pino.

## Archivos

- `whatsapp-gateway/index.js`: aplicacion principal.
- `whatsapp-gateway/package.json`: dependencias y script `npm start`.
- `whatsapp-gateway/Dockerfile`: imagen del gateway.
- `whatsapp-gateway/session/`: sesion persistente de WhatsApp. No debe versionarse.

## Variables de Entorno

- `WHATSAPP_GATEWAY_PORT`: puerto HTTP del gateway. Default interno: `8081`.
- `N8N_WEBHOOK_URL`: webhook inbound de n8n. Default interno: `http://n8n:5678/webhook/whatsapp-inbound`.
- `TZ`: zona horaria.

No documentar valores reales de credenciales o tokens.

## Endpoints

### GET /health

Respuesta:

```json
{
  "ok": true,
  "ready": true
}
```

`ready` indica si la sesion WhatsApp esta conectada.

### POST /sendText

Envia un mensaje de texto por WhatsApp.

Acepta variantes para compatibilidad:

```json
{
  "to": "593991840854",
  "message": "Texto a enviar"
}
```

Tambien acepta:

- `phone` en lugar de `to`.
- `text` en lugar de `message`.
- `args[0]` y `args[1]`.
- JIDs completos como `593999999999@s.whatsapp.net`, `279868742840481@lid` o `120363xxxxx@g.us`.

Respuesta exitosa:

```json
{
  "ok": true,
  "to": "593991840854@s.whatsapp.net",
  "message": "Mensaje enviado."
}
```

Si `to` contiene `@`, el gateway lo usa como JID tecnico completo. Solo reemplaza `@c.us` por `@s.whatsapp.net`.

## Mensajes Entrantes

El gateway escucha `messages.upsert` y descarta mensajes enviados por la propia cuenta (`fromMe`).

Payload enviado a n8n:

```json
{
  "phone": "593999999999",
  "contact_key": "593999999999",
  "from_jid": "593999999999@s.whatsapp.net",
  "remote_jid": "593999999999@s.whatsapp.net",
  "reply_to_jid": "593999999999@s.whatsapp.net",
  "from": "593999999999",
  "body": "mensaje del cliente",
  "channel": "whatsapp",
  "message_id": "baileys-message-id",
  "message_type": "text|image|audio|video|document|unknown",
  "timestamp": 1780000000,
  "has_media": false,
  "push_name": "Cliente",
  "is_lid": false
}
```

`from`, `body` y `channel` se mantienen para compatibilidad con el workflow actual. Para responder, n8n debe conservar `reply_to_jid`.

Si WhatsApp entrega un identificador `@lid`, `phone` se envia como `null`, `contact_key` conserva el JID completo y `reply_to_jid` debe usarse tal cual para responder.

## Normalizacion de Telefonos

La funcion `normalizePhone`:

- Elimina caracteres no numericos.
- Convierte numeros locales que empiezan con `0` a prefijo `593`.
- Si recibe 9 digitos sin prefijo, agrega `593`.
- Devuelve JID WhatsApp con sufijo `@s.whatsapp.net`.
- No se debe usar para valores `@lid`; un `@lid` no es un telefono real.

Ver tambien `docs/whatsapp-contact-identity.md`.

## Limitaciones Actuales

- Reenvia texto, captions y metadatos de multimedia; no descarga archivos.
- No implementa firma/verificacion del webhook hacia n8n.
- No implementa cola de reintentos para envio saliente.

## Mejoras Recomendadas

Sin romper el flujo actual:

- Mantener `message_id`, `timestamp`, `message_type` y `has_media` en el payload inbound.
- Para multimedia, seguir enviando solo metadatos minimos a n8n, no el archivo.
- Usar idempotencia por `message_id` en FacturaOF1/n8n.
- Mantener `fromMe` para evitar loops.
- Registrar fallos de envio en FacturaOF1.
- Agregar token interno opcional entre gateway y n8n si se expone fuera de Docker network.
