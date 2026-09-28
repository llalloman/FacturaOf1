# Tasks

## Governance

- [x] Approve product boundaries and sources of truth in
      `governance-decision.md`.
- [x] Define API versioning and event naming conventions.
- [x] Create traceability matrix for requirements, code, and tests.

## Frontends

- [x] Inventory current routes and classify them by product.
- [x] Add product build targets and environment contracts.
- [x] Add independent Docker build and compose artifacts for FacturaOF1 and
      OF1 Solutions Admin without changing the existing root compose.
- [x] Verify parallel frontend builds against a staging API before production
      cutover.
- [ ] Retain the current frontend artifacts in the approved release store as
      rollback before production cutover.
- [x] Create independent container definitions for OF1 Admin, FacturaOF1,
      and Firmador.
- [x] Add route allowlists and product-specific navigation.
- [x] Add cross-product links without sharing administrative state implicitly.

## Backend

- [x] Define platform, tenant, Firmador, and Automation service boundaries.
- [x] Add company memberships with tenant roles, module scope, active status,
      and audit metadata.
- [x] Add a validated active-company context for platform and tenant users.
- [x] Separate platform roles from roles inside an ERP company.
- [x] Restrict context switching to active membership or explicit platform scope.
- [x] Replace broad Superadmin-only assumptions with platform and tenant roles.
- [x] Add backend permission tests for every moved endpoint.
      Route-level coverage excludes only documented public endpoints; dynamic
      company/module/tenant decisions retain focused endpoint tests.
- [x] Add tenant-scope tests for IDs, list, retrieve, update, and download.
- [x] Define source-of-truth ownership for signatures, payments, and invoices.
- [x] Implement and test the detail-level discount source of truth for sales,
      signature payments, and electronic invoice conversion.
- [x] Add reconciliation evidence when sale and invoice totals differ.
- [x] Create a cross-domain ownership matrix for every backend aggregate.
- [x] Define global catalog versus company-scoped configuration and transaction
      data.
- [x] Define platform role scopes: global, company, module, and read/write.
- [x] Show and propagate active company context across exports, jobs,
      notifications, and Automation events; API and principal UI paths are
      covered. Guarded staging API/runtime evidence has passed; authenticated
      browser E2E remains a promotion gate.
- [ ] Register OF1 Solutions as a normal operating `Empresa` tenant with its
      own ERP configuration and audited platform context.
- [x] Replace the single company default issuer pair with explicit
      establishment and emission-point context.
- [x] Add establishment and emission-point APIs, permissions, and UI.
- [x] Update fiscal XML, RIDE, notes, retentions, guides, and debit notes to
      use the selected establishment address and emission point.
- [x] Add additive migration and read-only historical validation command for
      existing documents; staging execution/backfill remains gated.
- [x] Define treasury as the later financial orchestration layer for cash,
      banks, collections, disbursements, reconciliation, funds, and closures.
- [x] Keep treasury cash boxes distinct from fiscal emission points.
- [x] Define configurable obligations for companies, schools, colleges, clubs,
      leagues, memberships, tuition, events, donations, and sponsorships.
- [x] Audit inventory stock projections against the movement ledger by company,
      product, warehouse, and lot.
- [x] Make the generic inventory ledger append-only, validate movement signs,
      active-company ownership, and the negative-stock policy.
- [x] Make stock and lot balances read-only projections of the inventory ledger.
- [x] Implement atomic/idempotent purchase receipt, sale exit, transfer,
      return movement, and adjustment flows; guarded staging scenarios passed.
- [x] Make transfer dispatch and physical receipt distinct, atomic, and
      idempotent while recognizing legacy movement references.
- [x] Define inventory valuation, negative-stock policy, lot/FEFO rules, and
      accounting integration.
- [x] Define and version the POS offline synchronization contract.
- [x] Validate POS company, establishment, emission point, cash register,
      warehouse, operator, customer, and cash opening on the server.
- [x] Make local POS sale creation transactional across SQLite sale, details,
      local stock projection, payment intent, invoice intent, and sync queue.
- [x] Make POS synchronization idempotent and distinguish created,
      already-processed, and rejected outcomes.
- [x] Execute inventory and financial effects exactly once during POS sync.
- [x] Preserve and retry invoice intent after offline sync or SRI failure.
- [x] Add POS conflict, retry, dead-letter, and user-visible error states.
- [x] Add multi-terminal concurrency tests for stock, repeated movements, and
      duplicate cash openings; guarded staging execution passed.

## Automation

- [x] Version the API/event contract.
- [x] Add service authentication and idempotency keys.
- [x] Define event acknowledgement, retry, and dead-letter behavior.
- [x] Update Automation specs to use the platform domain where appropriate.
- [x] Keep n8n PostgreSQL limited to workflow state and technical execution data.

## Verification

- [x] Build each frontend independently.
- [x] Add automated product-navigation and unauthorized-route guard coverage;
      staging artifact/runtime verification passed; authenticated browser E2E
      remains a promotion gate.
- [x] Run backend permission and tenant-isolation tests.
- [x] Reconcile inventory scenarios: receipt, sale, retry, transfer, return,
      expiry, insufficient stock, and cross-company references.
- [x] Test a signature order from public intake through payment and platform
      administration.
- [x] Test Automation against API mocks before live integrations.
- [x] Test POS offline sale, reconnect, duplicate retry, SRI timeout,
      insufficient stock, closed cash opening, and cross-company rejection.
