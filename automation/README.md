# FacturaOF1 Automation

Automatización MVP para captación, seguimiento y operación inicial de firmas electrónicas usando OpenWA, n8n y DeepSeek.

## Alcance

Incluye:

- Atención inicial por WhatsApp.
- Envío del link del formulario de FacturaOF1.
- Clasificación de mensajes con DeepSeek.
- Detección de pedidos creados.
- Notificación de comprobantes recibidos.
- Validación humana de pagos.
- Correo interno para emisión manual.
- Notificación al cliente cuando el pago sea validado o la firma sea emitida.

No incluye todavía:

- Automatización bancaria.
- Ingreso automático a Nexus.
- Ingreso automático a Uanataca.
- RPA sobre proveedores.
- Validación automática definitiva de pagos por imagen.
- Campañas masivas por WhatsApp.

## Arquitectura

```text
WhatsApp
  ↓
OpenWA
  ↓
n8n
  ├── DeepSeek API
  ├── FacturaOF1 API
  └── WhatsApp / correo interno
       ↓
Operador humano
       ↓
Emisión manual Nexus / Uanataca