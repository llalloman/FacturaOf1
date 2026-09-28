# API and event boundaries

## Ownership

- FacturaOF1 owns fiscal documents, sales, inventory, treasury operations and
  company ERP data.
- Firmador owns signature requests, document signing state and signature
  evidence; it may request billing through the billing contract.
- OF1 Solutions Admin owns platform companies, subscriptions, memberships,
  module entitlements and cross-company audit actions.
- Automation owns workflow execution state and technical delivery attempts;
  it does not become the source of truth for invoices, payments or signatures.

Platform access is represented by `AccesoPlataforma` and is separate from
`EmpresaMembresia`: `ADMIN_GLOBAL` is global, while support, billing and audit
roles require explicit capability strings. Existing `SUPER_ADMIN` accounts
remain a compatibility path until a controlled backfill is approved.

## Context contract

Tenant requests use `X-Empresa-ID`. The backend validates the header against an
active membership or an explicit platform scope. Legacy `Usuario.empresa` is a
temporary fallback only.

## Event contract

Automation webhook events carry `event_id`, `idempotency_key`,
`contract_version`, `event_type`, entity identity and payload. Consumers must
acknowledge with `SENT`, `FAILED`, or `SKIPPED`; the separated dispatcher uses
the same idempotency key, exponential retry schedule, and dead-letter threshold.
Operational events may additionally carry nullable `empresa_id`, validated
against an active company; null remains valid for platform-global events.
Network dispatch remains opt-in until staging approval.

Inventory movement endpoints are append-only. Their `cantidad` sign must
match the movement type, writes require an active company context, and stock
exits honor the company negative-stock policy. Corrections are represented by
new adjustment or return movements; existing ledger rows are not edited or
deleted through the API.

## Versioning convention

- Existing `/api/<domain>/` routes remain backward compatible during migration.
- Breaking contracts use `/api/v2/<domain>/`; additive fields are preferred in
  the current route until the v2 cutover is approved.
- Event names use `<bounded_context>.<aggregate>.<past_tense_event>`, for
  example `facturacion.invoice.authorized` and
  `firmador.signature_order.completed`.
