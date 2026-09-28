# Frontend products and deployments

## Requirement: Independent repositories

The product frontends and Automation SHALL be maintained as independent
repositories, not only as Docker services in one repository. The backend SHALL
remain a separate repository and the only operational source of truth.

The repositories are `facturaof1-back`, `facturaof1-web`, `facturaof1-pos`,
`facturaof1-firmador`, `of1-automation`, and `of1-admin-web`.

`facturaof1-web` incluye el POS web. `facturaof1-pos` contiene únicamente el
cliente Electron de escritorio y su sincronización offline; no se crea un
repositorio POS web separado.

### Scenario: Product repository changes

- WHEN a frontend product changes
- THEN its repository SHALL build and test without importing source files from
  another product repository
- AND it SHALL consume the backend through versioned API contracts.

## Requirement: Independent frontend builds

The project SHALL produce independent frontend builds and containers for:

- FacturaOF1.
- POS web dentro de FacturaOF1.
- OF1 Firmador.
- OF1 Solutions Admin.
- POS Electron, distributed as an independent desktop product rather than a
  required web container.
- Automation operations, if a dedicated UI is introduced.

The initial migration MAY build the products from the existing web-admin source
with product-specific build targets. Route and module extraction SHALL happen
incrementally after the independent artifacts are verified. The root compose
and the current artifact SHALL remain available for rollback during migration.

### Scenario: Deploy one product

- WHEN the OF1 Solutions Admin frontend is built or deployed
- THEN the FacturaOF1 and Firmador frontend artifacts SHALL remain unchanged
- AND the build SHALL use product-specific environment configuration.

## Requirement: Product navigation

Each product frontend SHALL have an explicit allowlist of routes and modules.
Hiding a route in the menu SHALL not grant or revoke access; the API remains the
authorization authority.
