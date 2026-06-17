# Arquitectura de Automatizacion OF1

## Objetivo

Mejorar la automatizacion comercial y operativa de OF1 Solutions sin reemplazar los procesos criticos que requieren revision humana.

La automatizacion debe ayudar a responder rapido, clasificar conversaciones, guardar trazabilidad, levantar leads y activar seguimientos. No debe validar pagos automaticamente ni emitir firmas en Nexus/Uanataca.

## Estado Actual

```text
Cliente WhatsApp
  -> WhatsApp real
  -> whatsapp-gateway (Baileys)
  -> n8n webhook `/webhook/whatsapp-inbound`
  -> DeepSeek clasifica/resume
  -> Switch por categoria
  -> plantilla controlada
  -> whatsapp-gateway `/sendText`
  -> Cliente WhatsApp
```

## Componentes

### FacturaOF1 Backend

Fuente de verdad para:

- Leads comerciales.
- Solicitudes de firma electronica.
- Estados de pedidos.
- Interacciones de WhatsApp.
- Auditoria.
- Webhooks salientes hacia n8n.

### FacturaOF1 Frontend

Responsable de:

- Formularios publicos.
- Carga de documentos.
- Carga de comprobantes cuando se implemente.
- Pantallas administrativas para operadores y superadmin.

### n8n

Responsable de:

- Recibir eventos desde WhatsApp Gateway y FacturaOF1.
- Orquestar llamadas API.
- Clasificar mensajes con DeepSeek.
- Seleccionar plantillas controladas.
- Enviar mensajes por WhatsApp Gateway.
- Notificar internamente a asesores.

n8n no debe ser la base principal de clientes ni solicitudes.

### PostgreSQL de Automation

Usado por n8n para persistencia operativa de workflows, credenciales internas de n8n y ejecuciones. No debe usarse como base principal del ERP.

### WhatsApp Gateway

Servicio Express con Baileys que:

- Mantiene sesion WhatsApp en `whatsapp-gateway/session`.
- Recibe texto entrante.
- Reenvia payload minimo a n8n.
- Expone endpoint `POST /sendText` para enviar mensajes.
- Expone `GET /health`.

### DeepSeek

Uso permitido:

- Clasificar categoria.
- Resumir mensaje.
- Detectar intencion comercial o soporte.
- Estimar confianza.
- Proponer siguiente accion interna.

Uso no permitido:

- Redactar respuesta final libre al cliente.
- Inventar precios, requisitos o plazos.
- Procesar documentos sensibles completos.
- Validar pagos o emitir firmas.

## Responsabilidades por Capa

| Capa | Responsabilidad | No debe hacer |
| --- | --- | --- |
| WhatsApp Gateway | Transporte WhatsApp | Logica comercial compleja |
| n8n | Orquestacion | Persistencia principal del negocio |
| DeepSeek | Clasificacion/resumen | Respuesta final libre |
| FacturaOF1 | Datos, estados y auditoria | Dependencia de mensajes sin trazabilidad |
| Operador humano | Validacion bancaria y emision | Perder registro de decisiones |

## Flujo de Datos Recomendado

1. WhatsApp Gateway recibe mensaje.
2. n8n normaliza y valida payload.
3. n8n registra interaccion en FacturaOF1.
4. DeepSeek clasifica con prompt controlado.
5. n8n decide plantilla o handoff humano.
6. n8n envia respuesta por gateway.
7. n8n registra resultado de envio en FacturaOF1.

## Seguridad y Privacidad

- No leer ni documentar valores reales de `.env`.
- No versionar `whatsapp-gateway/session`.
- No enviar documentos completos a DeepSeek.
- No pedir cedula, codigo dactilar, certificados, claves ni documentos por WhatsApp si existe formulario.
- Usar tokens internos para endpoints automation.
- Registrar auditoria de webhooks, mensajes y cambios de estado.

## Riesgos Principales

- Respuestas duplicadas por reintentos de n8n o WhatsApp.
- Loops si el gateway recibe mensajes enviados por el mismo numero.
- Baja confianza de IA mal manejada.
- Usuarios enviando multimedia o comprobantes por WhatsApp sin registro formal.
- Exponer datos personales en logs.
- Mezclar venta de firmas con posicionamiento principal de OF1 como empresa tecnologica.

## Decisiones de Arquitectura

- Mantener respuestas comerciales en plantillas.
- Crear leads e interacciones en FacturaOF1.
- Usar idempotencia por mensaje/evento.
- Separar workflows por evento.
- Mantener validacion bancaria y emision como pasos humanos.
