# Architecture

## Contexto

La automatización complementa FacturaOF1 ERP con procesos de venta y soporte para firma electrónica.

## Componentes

- FacturaOF1 Backend: fuente de verdad para solicitudes, estados y clientes.
- FacturaOF1 Frontend: formularios públicos y administración.
- n8n: orquestador de eventos, webhooks, llamadas API y notificaciones.
- openwa: canal operativo para WhatsApp.
- DeepSeek: asistencia para clasificación, resumen y generación de respuestas sugeridas.

## Principios

- El ERP mantiene la propiedad del dato.
- n8n solo coordina procesos.
- WhatsApp no debe ser la única fuente de trazabilidad.
- Cada cambio de estado importante debe quedar registrado en FacturaOF1.

## Datos Sensibles

Las solicitudes de firma incluyen datos personales y documentos de identidad. Los workflows deben usar identificadores de solicitud y consultar documentos solo mediante endpoints protegidos.
