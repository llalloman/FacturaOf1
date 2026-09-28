# Backend source of truth

## Requirement: Domain ownership

The backend SHALL assign each aggregate to one authoritative domain:

- Platform: organizations, subscriptions, plans, entitlements, leads,
  signature orders, and platform payments.
- FacturaOF1: fiscal documents, ERP transactions, inventory, accounting, and
  tenant operational data.
- Firmador: PDF signing workspaces, certificates, and signed documents.
- Automation: workflow execution and technical logs only.

OF1 Solutions' platform-owner identity SHALL not replace its operating-company
identity. The operating company SHALL be represented by a normal `Empresa`
tenant and SHALL use FacturaOF1 for its own fiscal and business operations.

### Scenario: Cross-domain reference

- WHEN one domain needs data owned by another domain
- THEN it SHALL use a documented service/API contract or event
- AND it SHALL not write the other domain's tables directly.

## Requirement: Tenant isolation

Every tenant-owned ERP query and mutation SHALL be scoped to the authenticated
company unless a platform role has an explicitly audited cross-tenant scope.

### Scenario: Company administrator requests data

- WHEN an `ADMIN_EMPRESA` requests ERP data
- THEN only records belonging to the assigned company SHALL be returned
- AND records from another company SHALL not be selectable by changing an ID.

## Requirement: Cross-domain company scope

Every backend domain SHALL declare whether each aggregate is global-platform,
company-scoped, or linked to a company-scoped aggregate. A company-scoped
aggregate SHALL carry a direct or unambiguous ownership path to `Empresa`.

Financial calculations SHALL also have one declared source of truth. For sales
and electronic invoices, the detail-level gross base, discount amount, net base,
tax, and line total are authoritative. Header totals are derived summaries and
must not reapply a discount already represented in details.

### Scenario: Company-scoped operation

- WHEN a user reads or mutates a bank account, employee, product, invoice,
  inventory record, payment, subscription assignment, or automation event
- THEN the backend SHALL resolve the active company context
- AND SHALL reject records that do not belong to that company
- AND SHALL preserve company ownership in audit data.

### Scenario: Global catalog operation

- WHEN a platform operator changes a global plan or module definition
- THEN the change SHALL not alter company transactions retroactively
- AND company-specific assignments SHALL remain explicitly associated with each
  company.

## Requirement: Company membership

The backend SHALL support users with membership in one or more companies. A
membership SHALL define the user's role, permissions, active status, and scope.
The user's membership SHALL be the source of authorization for tenant ERP data;
the user profile alone SHALL not be the sole company selector.

### Scenario: User belongs to two companies

- GIVEN a user has active memberships in Company A and Company B
- WHEN the user selects Company B as the active context
- THEN ERP reads and writes SHALL be scoped to Company B
- AND Company A data SHALL not be returned in that context
- AND the context switch SHALL be recorded in the audit trail.

## Requirement: Platform and tenant roles

Platform roles SHALL be distinct from tenant roles. A platform role may operate
across companies only through an explicit scope, while a tenant role SHALL be
limited to its active company membership.

### Scenario: Platform operator accesses a company

- GIVEN an `OF1_OPERACIONES` user has an authorized support scope for Company A
- WHEN the user opens Company A
- THEN the backend SHALL create a validated active context
- AND every cross-company action SHALL record actor, target company, reason, and
  timestamp.

## Requirement: Multi-establishment fiscal issuance

Every `Empresa` SHALL support multiple `Establecimiento` records and every
establishment SHALL support multiple `PuntoEmision` records.

### Scenario: Invoice from a selected point

- GIVEN an authenticated user with access to a company
- AND an active establishment and emission point
- WHEN a fiscal document is created
- THEN the document SHALL store the company, establishment, and emission point
- AND its sequence SHALL be isolated by company, document type, establishment,
  and emission point
- AND the XML and RIDE SHALL use the establishment address for the establishment
  address and the company matrix address for the matrix address.

The active fiscal context SHALL include:

```text
active_company
active_establishment
active_emission_point
```

The system MAY derive defaults from the user's membership, caja, channel, or
integration, but a fiscal document SHALL never silently fall back to an
unrelated company's default.

## Requirement: Electronic invoicing provider identity

The RUC of the electronic-invoicing provider SHALL be independent from the
operating company's own RUC. Every company SHALL resolve the provider RUC from
its explicit configuration when present; otherwise the platform default SHALL
be `1793231594001`.

The provider RUC SHALL be emitted consistently in the XML additional
information and RIDE generated by FacturaOF1. It SHALL never be used as the
company tenant identity unless the legal entities are explicitly the same.

### Scenario: Company without provider override

- GIVEN a company has no provider RUC override
- WHEN FacturaOF1 generates XML or RIDE
- THEN the provider RUC SHALL be `1793231594001`
- AND the document issuer RUC SHALL remain the company's own RUC.

### Scenario: Company with approved provider override

- GIVEN a company has an explicit provider RUC
- WHEN FacturaOF1 generates XML or RIDE
- THEN the configured provider RUC SHALL be used consistently.

### Scenario: OF1 Solutions operates its own business

- GIVEN OF1 Solutions is registered as an `Empresa`
- WHEN OF1 Solutions sells a service, pays a supplier, runs payroll, or emits a
  fiscal document
- THEN the operation SHALL be recorded inside the OF1 Solutions tenant
- AND platform administration SHALL retain an auditable reference to the
  acting platform user and company context.
