# Identity and roles

## Requirement: Platform roles

The system SHALL distinguish platform roles from tenant roles.

Platform roles include `OF1_OWNER`, `OF1_OPERACIONES`, `OF1_FINANZAS`, and
`OF1_COMERCIAL`. Tenant roles include `ADMIN_EMPRESA`, `CONTADOR`, `VENDEDOR`,
and `CONSULTOR`. `FIRMADOR` is a product role.

### Scenario: Operations user manages signature sales

- WHEN an `OF1_OPERACIONES` user opens the platform admin
- THEN they may manage assigned signature orders and documents
- AND they SHALL not obtain unrestricted ERP access for every tenant.

## Requirement: Backend authorization

Every product API SHALL validate authentication, role, product entitlement, and
tenant or platform scope on the backend.
