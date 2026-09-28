# Gobierno Spec-Driven por repositorio

Cada repositorio mantiene su propia fuente de verdad funcional y tecnica bajo
`specs/`. La fuente de verdad de un repositorio no reemplaza la del backend:
los contratos de API, eventos, permisos y persistencia se definen en
`facturaof1-back` y los demas repositorios los consumen.

## Estructura minima

```text
specs/
  README.md
  product-boundaries.md
  functional/
  api-consumers/
  ux/
  acceptance/
```

Cada cambio debe tener `changes/<change-id>/proposal.md`, `design.md`,
`tasks.md` y `specs/<capability>.md`.

## Responsabilidad por repositorio

- `facturaof1-back`: dominios, modelos, permisos, API, eventos e invariantes.
- `facturaof1-web`: ERP, ventas, facturacion, inventario y operacion empresarial.
- `facturaof1-pos`: venta offline, cola local, sincronizacion y conflictos.
- `facturaof1-firmas`: intake comercial, precios, promociones, cupones, pagos
  y seguimiento de solicitudes.
- `facturaof1-firmador`: certificados, documentos, espacios, firma y validacion.
- `of1-admin-web`: empresas, membresias, suscripciones, soporte y administracion.
- `of1-automation`: workflows, triggers, plantillas, reintentos, idempotencia,
  dead-letter y observabilidad tecnica.

## Regla de desarrollo asistido

No se implementa una funcionalidad nueva sin una especificacion aprobada que
describa actores, permisos, estado, errores, persistencia, eventos y escenarios
Given/When/Then. Codigo, pruebas y despliegue deben enlazarse desde la matriz
de trazabilidad del repositorio.

## Solicitudes de firma y automatizacion

Durante la transicion, la solicitud de firma continua funcionando en el
frontend actual. La extraccion a `facturaof1-firmas` se realizara despues de
congelar el contrato del backend. Automation podra orquestar el flujo, pero la
solicitud, el precio, el pago y el estado final seguiran siendo propiedad del
backend y no de n8n.
