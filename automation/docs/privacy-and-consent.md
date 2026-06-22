# Privacidad y Consentimiento en Automation

## Alcance

Este documento aplica al flujo WhatsApp -> n8n -> DeepSeek -> backend de FacturaOF1.

El canal WhatsApp puede tratar datos personales como teléfono, nombre visible, mensajes, identificadores técnicos, resumen IA, categoría, intención e historial de conversación.

## Regla Principal

WhatsApp debe usarse para orientación, soporte comercial y seguimiento. No se deben solicitar datos sensibles por WhatsApp.

Para trámites de firma electrónica, el bot debe redirigir al formulario oficial:

`/solicitar-firma-electronica`

Ese formulario contiene el consentimiento explícito fuerte:

- aceptación de Términos y Condiciones
- autorización de tratamiento de datos personales
- IP
- User-Agent
- fecha/hora
- versiones legales
- solicitud asociada

## Aviso Corto para Primer Contacto

En el primer contacto o saludo, n8n debe incluir este aviso:

> Al continuar esta conversación, usted autoriza el tratamiento de los datos enviados por este medio para atender su solicitud. Política de Privacidad: /politica-privacidad

El aviso debe enviarse una sola vez por `lead` o `contact_key` y por versión de política.

## Endpoint Interno

`POST /api/automation/privacy-consents/`

Protección:

```http
X-Automation-Token: <AUTOMATION_API_TOKEN>
```

Payload recomendado:

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
    "message_id": "ABC123",
    "notice_text": "Al continuar esta conversación..."
  }
}
```

Si el contacto llega como `@lid`, no se debe enviarlo como teléfono real:

```json
{
  "contact_key": "279868742840481@lid",
  "phone": "",
  "privacy_notice_version": "privacidad-2026-06-22",
  "consent_source": "whatsapp",
  "consent_status": "informed"
}
```

El backend normaliza el teléfono. Si recibe un JID no telefónico como `@lid`, conserva `contact_key` y deja `phone` vacío.

## Idempotencia

El backend registra una sola evidencia por:

- `contact_key`
- `privacy_notice_version`
- `consent_source`

Si n8n llama el endpoint de nuevo con la misma combinación, se actualiza el registro existente y responde sin duplicar evidencia.

## Flujo n8n Recomendado

1. Recibir mensaje desde `whatsapp-gateway`.
2. Normalizar identidad:
   - usar `phone` solo si es teléfono real.
   - usar `contact_key`/`reply_to_jid` si es `@lid`.
3. Consultar contexto del lead.
4. Si no existe aviso de privacidad para el lead/contacto:
   - enviar el aviso corto en la respuesta.
   - llamar `POST /api/automation/privacy-consents/`.
5. Registrar interacción inbound/outbound.
6. Clasificar con DeepSeek.
7. Responder sin pedir datos sensibles.

## Datos Visibles en Administración

La pantalla de leads muestra:

- aviso de privacidad enviado: sí/no
- fecha
- versión de política
- fuente

## Prohibiciones Operativas

No pedir por WhatsApp:

- cédula completa para trámites sensibles
- código dactilar
- documentos de identidad
- certificados digitales
- claves
- comprobantes con datos sensibles cuando exista formulario oficial

Para esos casos, redirigir al formulario oficial o a un asesor humano.
