# Tasks

## 1. Documentacion

- [x] Documentar estado actual de `automation/`.
- [x] Documentar arquitectura actual y objetivo.
- [x] Documentar `whatsapp-gateway`.
- [x] Documentar workflow `01_whatsapp_inbound`.
- [x] Documentar reglas de DeepSeek.
- [x] Proponer workflows `02` a `08`.
- [x] Proponer payloads estandar.
- [x] Proponer endpoints y modelos backend.

## 2. Preparacion Antes de Implementar

- [ ] Exportar workflow actual `01_whatsapp_inbound` desde n8n a `automation/n8n/workflows/01_whatsapp_inbound.json`.
- [ ] Validar plantillas comerciales con el equipo.
- [ ] Definir estados finales de pedidos de firma en FacturaOF1.
- [ ] Definir permisos del token interno para automation.
- [ ] Definir canal de notificacion interna.

## 3. Backend FacturaOF1

- [ ] Crear modelo `CommercialLead`.
- [ ] Crear modelo `WhatsAppInteraction`.
- [ ] Crear modelo `AutomationWebhookEvent`.
- [ ] Crear modelo `AutomationAuditLog`.
- [ ] Crear endpoint para crear/actualizar lead.
- [ ] Crear endpoint para registrar interacciones WhatsApp.
- [ ] Crear endpoint para consultar pedido de firma.
- [ ] Crear endpoint para actualizar estado de pedido.
- [ ] Crear servicio `AutomationWebhookDispatcher`.
- [ ] Agregar idempotencia por evento y mensaje.

## 4. n8n

- [ ] Actualizar `01_whatsapp_inbound` con registro de interacciones.
- [ ] Agregar manejo de mensajes vacios.
- [ ] Agregar manejo de multimedia sin descargar archivos.
- [ ] Agregar baja confianza y handoff humano.
- [ ] Crear `02_signature_order_created`.
- [ ] Crear `03_signature_order_incomplete`.
- [ ] Crear `04_payment_proof_uploaded`.
- [ ] Crear `05_payment_validated`.
- [ ] Crear `06_ready_for_manual_issuance`.
- [ ] Crear `07_signature_issued`.
- [ ] Crear `08_pending_follow_up`.

## 5. QA

- [ ] Probar clasificacion por cada categoria comercial.
- [ ] Probar soporte tecnico.
- [ ] Probar baja confianza.
- [ ] Probar mensajes duplicados.
- [ ] Probar multimedia.
- [ ] Probar eventos de firma de inicio a cierre manual.
- [ ] Confirmar que no se automatiza validacion bancaria.
- [ ] Confirmar que no se automatiza emision Nexus/Uanataca.
