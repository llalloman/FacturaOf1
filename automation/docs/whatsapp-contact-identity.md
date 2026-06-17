# WhatsApp Contact Identity

## Campos

- `phone`: numero telefonico real del cliente. Solo se llena cuando WhatsApp entrega un JID `@s.whatsapp.net`.
- `contact_key`: identificador estable para trazabilidad. Puede ser `phone` o un JID tecnico como `279868742840481@lid`.
- `reply_to_jid`: JID exacto que debe usarse para responder por WhatsApp.
- `from_jid`: remitente tecnico del mensaje.
- `remote_jid`: chat original recibido por Baileys.
- `push_name`: nombre visible de WhatsApp si esta disponible.
- `is_lid`: `true` cuando el identificador es un JID interno `@lid`.

## Regla Principal

Un `@lid` no es un numero telefonico real. Nunca debe guardarse como `phone` ni convertirse a `@s.whatsapp.net`.

Para responder por WhatsApp se debe usar:

```text
reply_to_jid || remote_jid || from_jid || phone
```

Para trazabilidad, leads e idempotencia se debe usar:

```text
contact_key
```

## Payload Entrante Con Numero Real

```json
{
  "phone": "593999999999",
  "contact_key": "593999999999",
  "from_jid": "593999999999@s.whatsapp.net",
  "remote_jid": "593999999999@s.whatsapp.net",
  "reply_to_jid": "593999999999@s.whatsapp.net",
  "from": "593999999999",
  "body": "Hola",
  "channel": "whatsapp",
  "message_id": "BAILEYS_ID",
  "timestamp": 1780000000,
  "message_type": "text",
  "push_name": "Cliente",
  "is_lid": false
}
```

## Payload Entrante Con `@lid`

```json
{
  "phone": null,
  "contact_key": "279868742840481@lid",
  "from_jid": "279868742840481@lid",
  "remote_jid": "279868742840481@lid",
  "reply_to_jid": "279868742840481@lid",
  "from": "279868742840481@lid",
  "body": "Hola",
  "channel": "whatsapp",
  "message_id": "BAILEYS_ID",
  "timestamp": 1780000000,
  "message_type": "text",
  "push_name": "Cliente",
  "is_lid": true
}
```

## Payload Saliente

```json
{
  "to": "279868742840481@lid",
  "message": "Respuesta del bot"
}
```

Si `to` contiene `@`, el gateway lo usa como JID tecnico completo. Solo reemplaza `@c.us` por `@s.whatsapp.net` por compatibilidad.
