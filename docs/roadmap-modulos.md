# Roadmap general por modulo

Este documento organiza las mejoras del proyecto FacturaOF1 por prioridad y dependencia. La intencion es que cada modulo crezca sin perder control operativo, permisos ni trazabilidad.

## Fase 1: estabilidad y control

- Centralizar permisos de modulos y mantener fuera de planes tenant las pantallas internas de superadmin.
- Reemplazar errores silenciosos por logs accionables en flujos criticos.
- Agregar auditoria para cambios sensibles: permisos, estados, pagos, anulaciones, firmas y leads.
- Validar build backend/frontend antes de publicar cambios operativos.

## Fase 2: operacion comercial y fiscal

- Ventas: unificar la logica de venta POS y venta administrativa.
- Ventas a credito: generar cartera automaticamente y vincular factura cuando exista.
- Facturacion: crear monitor SRI para pendientes, rechazados, no autorizados y reintentos.
- Cartera: usar aging, pagos parciales, promesas de pago y recordatorios por WhatsApp/correo.
- Clientes: deduplicar por identificacion y mostrar estado de cuenta.

## Fase 3: inventario, compras y finanzas

- Productos: separar claramente producto fisico, servicio y combo.
- Inventario: reforzar kardex, alertas de stock y reservas.
- Proveedores/compras: agregar orden de compra, recepcion parcial y cuentas por pagar.
- Bancos: importar movimientos y conciliar contra pagos/cobros.
- Contabilidad: generar asientos automaticos desde ventas, compras, cartera, bancos y nomina.

## Fase 4: automatizacion y crecimiento

- Leads: convertir la pantalla actual en bandeja comercial con asignaciones, notas y proximos seguimientos.
- WhatsApp/n8n: agregar idempotencia de eventos para evitar duplicados.
- Firmas electronicas: controlar ciclo completo de solicitud, pago, revision, emision y cierre.
- Reportes: crear reportes ejecutivos por ventas, cartera, facturacion, leads y rentabilidad.

## Criterios de calidad por modulo

- Cada flujo critico debe tener permisos claros, auditoria y errores visibles.
- Cada integracion externa debe ser idempotente o tener mecanismo de reintento.
- Cada archivo privado debe servirse con permisos o URL firmada.
- Cada pantalla operativa debe tener estados de carga, vacio, error y confirmacion.
- Cada cambio de alto impacto debe incluir prueba backend o frontend.
