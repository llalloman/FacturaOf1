# Platform boundaries

## Requirement: Product responsibility

The platform SHALL expose separate product experiences for OF1 Solutions Admin,
FacturaOF1, OF1 Firmador, and Automation.

### Scenario: User opens a product

- WHEN a user opens a product URL
- THEN the frontend SHALL load only the navigation and capabilities relevant to
  that product
- AND the backend SHALL enforce the same boundary independently of the UI.

## Requirement: Shared backend transition

The initial implementation SHALL keep one backend deployment organized by
domain modules while exposing product-specific API namespaces and permissions.

### Scenario: A domain is migrated

- WHEN a capability moves from the shared shell to a product frontend
- THEN its API ownership, source of truth, role rules, and migration evidence
  SHALL be documented before the old route is removed.

## Requirement: Platform owner and operating tenant

The platform owner SHALL be able to administer OF1 Solutions as a complete ERP
tenant without mixing platform records with the company's fiscal records.

### Scenario: Internal OF1 operation

- WHEN an authorized OF1 user selects OF1 Solutions as the active company
- THEN the ERP SHALL apply the same company, establishment, point, and fiscal
  rules used for any other `Empresa`
- AND the platform action SHALL be audited with user, company, and reason.
