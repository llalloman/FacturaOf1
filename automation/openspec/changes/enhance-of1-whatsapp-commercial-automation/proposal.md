# Proposal: Enhance OF1 WhatsApp Commercial Automation

## Problema

El flujo actual de WhatsApp ya responde mensajes con n8n, DeepSeek y plantillas, pero todavia no deja una trazabilidad comercial completa en FacturaOF1 ni separa claramente ventas, soporte, seguimiento de firmas, comprobantes y casos que requieren humano.

Esto limita:

- Seguimiento de leads importantes.
- Visibilidad de conversaciones por numero telefonico.
- Prevencion de respuestas duplicadas.
- Manejo controlado de baja confianza de IA.
- Escalamiento operativo para pedidos de firma.

## Propuesta

Diseñar una mejora incremental para automatizar la atencion comercial y operativa de OF1 Solutions sin romper el flujo actual.

La mejora incluye:

- Documentar el estado actual de `automation/`.
- Estandarizar payloads de eventos desde FacturaOF1 hacia n8n.
- Proponer endpoints minimos en FacturaOF1 para leads, interacciones, pedidos, webhooks y auditoria.
- Separar workflows n8n por evento comercial/operativo.
- Mantener DeepSeek como clasificador/resumidor.
- Mantener respuestas finales en plantillas controladas.

## Alcance

Incluye diseno para:

- Leads comerciales por WhatsApp.
- Interacciones entrantes y salientes.
- Contexto por numero telefonico.
- Pedidos de firma electronica.
- Comprobantes cargados.
- Validacion manual de pagos.
- Preparacion para emision manual.
- Seguimientos pendientes.

## Fuera de Alcance

- Automatizar validacion bancaria.
- Automatizar emision en Nexus/Uanataca.
- Leer o cambiar credenciales.
- Procesar documentos sensibles con IA.
- Permitir respuestas libres de IA al cliente.
- Implementar cambios grandes en backend o n8n en esta fase.

## Resultado Esperado

Una propuesta tecnica en Markdown y OpenSpec lista para revision, que sirva como base para implementar en etapas sin afectar el flujo activo.
