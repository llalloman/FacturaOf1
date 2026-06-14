# Workflows

## signature.lead-intake.v1

Entrada:

- Webhook desde formulario público o evento del backend.

Acciones:

- Validar payload.
- Consultar solicitud en FacturaOF1.
- Enviar mensaje inicial por WhatsApp.
- Notificar al equipo comercial.
- Registrar observación o cambio de estado.

## signature.follow-up.v1

Entrada:

- Cron programado.

Acciones:

- Buscar solicitudes en estado `NUEVA`, `CONTACTADO` o `DOCUMENTOS_PENDIENTES`.
- Generar recordatorio.
- Enviar mensaje si corresponde.
- Registrar evento de seguimiento.

## signature.document-check.v1

Entrada:

- Cambio de estado o carga de documentos.

Acciones:

- Consultar documentos requeridos según tipo de solicitud.
- Detectar faltantes.
- Preparar mensaje de solicitud de documentos pendientes.
