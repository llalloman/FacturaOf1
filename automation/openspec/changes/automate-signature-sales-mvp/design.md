# Design: Signature Sales Automation MVP

## Flujo principal

1. El usuario envía una solicitud de firma desde la landing.
2. FacturaOF1 guarda la solicitud y emite un evento/webhook.
3. n8n recibe el evento.
4. n8n consulta el detalle de la solicitud mediante API.
5. n8n envía confirmación por WhatsApp usando openwa.
6. n8n registra una observación o cambio de estado en FacturaOF1.

## Integraciones

- FacturaOF1 API: solicitudes, estados, observaciones.
- openwa: envío de mensajes.
- DeepSeek: clasificación y resumen opcional.

## Seguridad

- Autenticación por token para llamadas internas.
- No exponer documentos sensibles por URLs públicas.
- Variables sensibles en `.env`.

## Persistencia

La persistencia principal sigue en FacturaOF1. n8n almacena solo configuración, ejecución y logs operativos.
