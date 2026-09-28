# Frontend route inventory

## FacturaOF1 / ERP tenant

`/facturacion`, `/documentos-recibidos`, `/inventarios`, `/proveedores`,
`/productos`, `/clientes`, `/ventas`, `/reportes`, `/configuracion`,
`/retenciones`, `/guias-remision`, `/notas-debito`, `/notas-credito`,
`/cartera`, `/declaraciones`, `/cotizaciones`, `/contabilidad`, `/bancos`,
`/nomina`, `/usuarios`, `/pedidos`, `/pedidos/:id`, `/pos`.

## OF1 Solutions platform administration

`/empresas`, `/suscripciones-admin`, `/matriz-permisos`, `/catalogo-modulos`,
`/firmas-electronicas`, `/firmas-electronicas/precios`, `/firmador-admin`,
`/automation/leads`.

These routes remain in the current application during the migration but are
classified and filtered by `productTarget`. They are candidates for the
independent OF1 Admin artifact.

## Firmador

`/firmador`, `/firmador/inicio`, `/firmador/validar`, plus public registration
and payment-result routes. These remain API-backed and must not inherit the
platform administration state implicitly.

## Public/shared

`/login`, `/registro`, `/bienvenida`, `/onboarding`, password recovery,
verification, terms, privacy, demo, and signature request routes.

## Acceptance checks

- A route outside the selected product target must redirect or render the
  product boundary fallback.
- A tenant user must not reach platform routes merely because the route exists
  in the shared bundle.
- Cross-product links must carry only an explicit destination and never copy a
  company context silently.
