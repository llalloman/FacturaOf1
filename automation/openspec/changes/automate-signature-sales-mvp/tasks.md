# Tasks

## 1. Infraestructura

- [ ] Configurar `.env` local.
- [ ] Levantar n8n con Docker Compose.
- [ ] Levantar openwa con sesión persistente.

## 2. Backend FacturaOF1

- [ ] Definir endpoint o webhook para eventos de solicitud.
- [ ] Agregar endpoint para registrar observaciones de seguimiento.
- [ ] Confirmar permisos de token interno.

## 3. n8n

- [ ] Crear workflow `signature.lead-intake.v1`.
- [ ] Crear workflow `signature.follow-up.v1`.
- [ ] Exportar workflows a `n8n/workflows/`.

## 4. WhatsApp

- [ ] Definir plantillas de mensajes.
- [ ] Validar formato Ecuador `+593`.
- [ ] Registrar resultado de envío.

## 5. QA

- [ ] Probar solicitud persona natural.
- [ ] Probar solicitud firma + ERP.
- [ ] Probar solicitud con documentos pendientes.
- [ ] Verificar trazabilidad en FacturaOF1.
