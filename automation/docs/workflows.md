# Workflows de Automatizacion

## Estado Actual

El workflow operativo descrito es `01_whatsapp_inbound`.

No existe export versionado en `automation/n8n/workflows/`; la carpeta contiene solo `.gitkeep`. Cuando el workflow sea exportado desde n8n, debe guardarse como:

```text
automation/n8n/workflows/01_whatsapp_inbound.json
```

## 01_whatsapp_inbound

### Objetivo

Atender mensajes entrantes de WhatsApp, clasificarlos con DeepSeek y responder con plantillas controladas segun categoria.

### Entrada

Origen: `whatsapp-gateway`.

Webhook esperado:

```http
POST /webhook/whatsapp-inbound
```

Payload actual enviado por gateway:

```json
{
  "from": "593999999999",
  "body": "mensaje del cliente",
  "channel": "whatsapp"
}
```

### Nodos Documentados

#### 1. Webhook

Recibe el mensaje entrante desde `whatsapp-gateway`.

Validaciones recomendadas:

- `from` requerido.
- `channel` debe ser `whatsapp`.
- `body` debe tener texto util.
- Rechazar o derivar mensajes vacios.

#### 2. Edit Fields

Normaliza campos para el flujo:

- `phone`
- `message`
- `channel`
- `received_at`
- `message_hash` recomendado para idempotencia.

#### 3. DeepSeek

Clasifica y resume el mensaje.

Debe devolver JSON controlado:

```json
{
  "category": "signature|erp|invoicing|custom_software|automation_ai|chatbot|integration|support|human|unknown",
  "intent": "sales|support|question|complaint|payment|documents|other",
  "summary": "resumen corto",
  "confidence": 0.0,
  "requires_human": false
}
```

#### 4. Parse Response

Convierte la salida de DeepSeek a campos estructurados.

Reglas:

- Si el JSON es invalido, usar categoria `unknown`.
- Si `confidence < 0.65`, activar `requires_human`.
- No usar texto generado por IA como respuesta final.

#### 5. Switch Category

Rutea por categoria:

- `signature`: firma electronica.
- `erp`: FacturaOF1 ERP.
- `invoicing`: facturacion electronica.
- `custom_software`: sistemas a medida.
- `automation_ai`: automatizacion e IA.
- `chatbot`: chatbots y asistentes.
- `integration`: integraciones.
- `support`: soporte tecnico.
- `human` o `unknown`: asesor humano.

#### 6. Prepare Reply por Categoria

Selecciona una plantilla controlada.

Ejemplo de reglas:

- Firma electronica: enviar link del formulario, no pedir datos sensibles por WhatsApp.
- ERP: invitar a demo o asesor comercial.
- Desarrollo a medida: pedir descripcion general del proyecto, empresa y correo si no existen.
- Soporte: pedir identificador no sensible o derivar al equipo.
- Baja confianza: respuesta neutral y notificacion interna.

#### 7. Prepare WhatsApp Payload

Construye payload para el gateway:

```json
{
  "to": "593999999999",
  "message": "plantilla final"
}
```

#### 8. WhatsApp Gateway - Send Message

Llama:

```http
POST http://whatsapp-gateway:8081/sendText
```

## Mejoras Propuestas para `01_whatsapp_inbound`

- Registrar lead comercial si no existe.
- Registrar cada interaccion de WhatsApp en FacturaOF1.
- Guardar contexto por numero telefonico.
- Diferenciar venta, soporte y consulta.
- Agregar idempotencia por `message_id` o hash.
- Ignorar mensajes enviados por el propio gateway.
- Manejar mensajes multimedia con plantilla que invite a usar formulario o canal correcto.
- Manejar mensajes vacios sin llamar a DeepSeek.
- Si hay baja confianza, usar plantilla de handoff humano.
- Notificar internamente leads importantes.

## Workflows Propuestos

### 02_signature_order_created

Entrada: `signature_order.created` desde FacturaOF1.

Acciones:

- Registrar evento recibido.
- Consultar resumen del pedido si hace falta.
- Enviar confirmacion por WhatsApp con numero de solicitud.
- Incluir link de pago/formulario si aplica.
- Notificar internamente si el pedido es empresarial o de alta prioridad.

### 03_signature_order_incomplete

Entrada: `signature_order.incomplete`.

Acciones:

- Listar documentos o datos pendientes sin exponer archivos.
- Enviar recordatorio por plantilla.
- Registrar seguimiento.

### 04_payment_proof_uploaded

Entrada: `payment.proof_uploaded`.

Acciones:

- Confirmar recepcion del comprobante.
- Notificar a operador para validacion manual.
- No validar banco automaticamente.

### 05_payment_validated

Entrada: `payment.validated` desde accion humana en FacturaOF1.

Acciones:

- Notificar al cliente que el pago fue validado.
- Registrar proximo paso.
- Mover pedido a preparacion manual.

### 06_ready_for_manual_issuance

Entrada: `signature_order.ready_for_issuance`.

Acciones:

- Notificar al operador interno.
- Enviar resumen operacional sin documentos sensibles.
- Mantener emision en Nexus/Uanataca como tarea humana.

### 07_signature_issued

Entrada: `signature_order.issued`.

Acciones:

- Notificar al cliente que la firma fue emitida.
- Enviar instrucciones controladas de entrega/uso segun proceso aprobado.
- Registrar cierre de workflow.

### 08_pending_follow_up

Entrada: cron o evento de SLA.

Acciones:

- Buscar leads o pedidos sin avance.
- Enviar recordatorio si no se ha enviado recientemente.
- Evitar duplicados por ventana de tiempo.
- Notificar humano si supera el limite de intentos.
