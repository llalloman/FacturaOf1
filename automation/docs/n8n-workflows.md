# n8n Workflows

## Convencion de Nombres

Usar nombres numerados y descriptivos para facilitar operacion:

- `01_whatsapp_inbound`
- `02_signature_order_created`
- `03_signature_order_incomplete`
- `04_payment_proof_uploaded`
- `05_payment_validated`
- `06_ready_for_manual_issuance`
- `07_signature_issued`
- `08_pending_follow_up`

Los exports deben guardarse en:

```text
automation/n8n/workflows/
```

## 01_whatsapp_inbound

### Proposito

Clasificar mensajes entrantes por WhatsApp y responder con plantillas controladas.

### Nodos

1. **Webhook**
   - Metodo: `POST`.
   - Path sugerido: `whatsapp-inbound`.
   - Entrada actual: `from`, `body`, `channel`.

2. **Edit Fields**
   - Normaliza `phone`, `message`, `channel`, `received_at`.
   - Genera `conversation_key = channel + ':' + phone`.

3. **Consultar/Crear Lead y Aviso de Privacidad**
   - Crear o actualizar lead con `POST /api/automation/leads/`.
   - En primer contacto o saludo, incluir aviso corto:
     `Al continuar esta conversación, usted autoriza el tratamiento de los datos enviados por este medio para atender su solicitud. Política de Privacidad: /politica-privacidad`
   - Registrar el aviso una sola vez con `POST /api/automation/privacy-consents/`.
   - Si el contacto es `@lid`, no tratarlo como teléfono real; usar `contact_key` y `reply_to_jid`.

4. **Registrar Interaccion Entrante**
   - Endpoint FacturaOF1: `POST /api/automation/interactions/`.
   - Guarda mensaje, hash/idempotency key y origen.

5. **Validar Mensaje**
   - Si `message` esta vacio, no llamar IA.
   - Si `message_type` no es texto, usar plantilla para multimedia.
   - No pedir cédula, código dactilar, certificados, claves ni documentos por WhatsApp.
   - Para firma electrónica, redirigir al formulario oficial.

6. **DeepSeek**
   - Clasifica y resume.
   - Respuesta estricta en JSON.

7. **Parse Response**
   - Maneja JSON invalido.
   - Aplica umbral de confianza.

8. **Switch Category**
   - Rutea por categoria.

9. **Prepare Reply por Categoria**
   - Elige plantilla aprobada.
   - No usa texto libre de IA.

10. **Prepare WhatsApp Payload**
   - Payload para gateway.

11. **WhatsApp Gateway - Send Message**
    - `POST /sendText`.

12. **Registrar Interaccion Saliente**
    - Endpoint FacturaOF1: `POST /api/automation/interactions/`.

### Categorias Recomendadas

- `signature`
- `erp`
- `invoicing`
- `custom_software`
- `automation_ai`
- `chatbot`
- `integration`
- `support`
- `human`
- `unknown`

### Plantillas Base

Las plantillas definitivas deben aprobarse comercialmente antes de activarse.

#### Firma Electronica

```text
Gracias por escribir a OF1 Solutions. Para solicitar tu firma electronica, completa el formulario oficial: {{signature_form_url}}. Asi protegemos tus datos y podemos revisar tu solicitud correctamente. Un asesor te acompanara en el proceso.
```

#### ERP FacturaOF1

```text
Gracias por contactar a OF1 Solutions. Podemos ayudarte con FacturaOF1 ERP para facturacion electronica, inventario, cartera, reportes y gestion empresarial. Un asesor puede coordinar una demostracion contigo.
```

#### Desarrollo a Medida

```text
Gracias por contactar a OF1 Solutions. Podemos ayudarte con sistemas empresariales, portales, apps, integraciones y dashboards. Cuentanos de forma general que proceso deseas digitalizar y un asesor revisara tu caso.
```

#### Automatizacion e IA

```text
Gracias por contactar a OF1 Solutions. Podemos ayudarte con automatizacion de procesos, asistentes inteligentes, integraciones con WhatsApp y dashboards. Un asesor revisara tu necesidad para proponer el siguiente paso.
```

#### Soporte

```text
Gracias por escribir a soporte de OF1 Solutions. Un asesor revisara tu caso. Por favor indica el servicio relacionado y una descripcion general del inconveniente, sin enviar claves ni documentos sensibles por este chat.
```

#### Baja Confianza o Handoff

```text
Gracias por escribir a OF1 Solutions. Para atenderte correctamente, un asesor revisara tu mensaje y te respondera por este medio.
```

## Nuevos Workflows Propuestos

### 02_signature_order_created

Webhook de evento `signature_order.created`.

Nodos sugeridos:

- Webhook.
- Validar evento.
- Consultar solicitud en FacturaOF1.
- Preparar plantilla de confirmacion.
- Enviar WhatsApp.
- Notificar interno si aplica.
- Registrar auditoria.

### 03_signature_order_incomplete

Evento `signature_order.incomplete`.

Nodos sugeridos:

- Webhook.
- Obtener pendientes.
- Preparar plantilla de documentos/datos pendientes.
- Enviar WhatsApp.
- Registrar seguimiento.

### 04_payment_proof_uploaded

Evento `payment.proof_uploaded`.

Nodos sugeridos:

- Webhook.
- Registrar comprobante recibido.
- Notificar operador.
- Enviar confirmacion de recepcion al cliente.

Importante: no validar pago automaticamente.

### 05_payment_validated

Evento `payment.validated` disparado por accion humana.

Nodos sugeridos:

- Webhook.
- Preparar confirmacion de pago validado.
- Enviar WhatsApp.
- Registrar estado.

### 06_ready_for_manual_issuance

Evento `signature_order.ready_for_issuance`.

Nodos sugeridos:

- Webhook.
- Notificar operador responsable.
- Crear tarea interna.
- Registrar auditoria.

### 07_signature_issued

Evento `signature_order.issued`.

Nodos sugeridos:

- Webhook.
- Enviar notificacion de emision.
- Registrar cierre.
- Solicitar feedback si se aprueba comercialmente.

### 08_pending_follow_up

Cron o webhook de seguimiento.

Nodos sugeridos:

- Trigger programado.
- Consultar leads/pedidos pendientes.
- Filtrar por SLA y ultimo contacto.
- Enviar recordatorio controlado.
- Registrar intento.
- Escalar a humano al superar limite.


## Implementacion Backend Disponible

Ya existen endpoints internos para afinar el workflow actual:

- `POST /api/automation/interactions/` para registrar mensajes entrantes y salientes.
- `POST /api/automation/leads/` para crear/actualizar leads.
- `GET /api/automation/leads/context/{phone}/` para recuperar contexto.
- `GET /api/automation/signature-orders/{id_or_request_number}/` para consultar pedidos de firma.
- `PATCH /api/automation/signature-orders/{id_or_request_number}/status/` para cambios de estado autorizados.
- `POST /api/automation/webhook-events/` para registrar eventos.
- `POST /api/automation/audit-events/` para auditoria.

Usar `X-Automation-Token`, no `Authorization: Bearer`, para evitar conflicto con JWT del ERP.

La guia aplicable al canvas actual esta en `automation/n8n/workflows/01_whatsapp_inbound_hardening.md`.
