# POS offline and synchronization contract

## Status

The POS is an independent Electron product. This specification defines the
safe contract between its local SQLite store and the central FacturaOF1 API.
Existing production sales and data SHALL remain compatible during adoption.

## Requirement: Product boundary

The POS SHALL have its own release, installer, configuration, and operational
context. It SHALL use the central API as the source of truth for company,
users, customers, products, inventory, fiscal documents, receivables, treasury,
and accounting. Local SQLite SHALL be a temporary operational store and cache,
not an independent financial ledger.

## Requirement: Explicit operational context

Every POS installation SHALL use a validated context containing:

```text
company
establishment
fiscal emission point
operational cash register
warehouse
authenticated operator
cash opening
```

The context SHALL be obtained or validated through the API. Production users
SHALL not operate by manually typing arbitrary company, user, cash register,
or warehouse IDs.

## Requirement: Local sale transaction

Creating an offline sale SHALL be one local transaction containing the sale,
all details, local stock projection, payment intent, invoice intent, and sync
queue entry. If any part fails, the complete local operation SHALL roll back.

The local record SHALL preserve the original UUID, timestamps, context, raw
payload version, and validation state.

## Requirement: Idempotent synchronization

Every sale SHALL have a client-generated UUID and an idempotency key. The API
SHALL treat repeated submissions of the same UUID as the same operation and
SHALL return the existing canonical sale without repeating inventory, payment,
receivable, treasury, or invoice effects.

The response SHALL distinguish at least `created`, `already_processed`, and
`rejected` outcomes.

## Requirement: Server-side validation

Before creating the canonical sale, the API SHALL validate that the operator
has access to the company and cash register, the cash register belongs to the
company, the warehouse and products belong to the company, the customer belongs
to the company, and the cash opening is valid for the sale date and register.

The API SHALL recalculate totals from details and SHALL not trust client totals.
It SHALL apply the canonical discount rules from `discount-consistency.md`.

## Requirement: Atomic canonical effects

Synchronization SHALL be transactional. A completed sale SHALL create or link
its details and payments, execute the inventory exit, create the receivable or
financial effect, and record audit evidence as one idempotent workflow. A
partial sale SHALL not be reported as successfully synchronized.

## Requirement: Inventory synchronization

The server SHALL validate stock using the selected warehouse and lock the
affected product, warehouse, and lot rows. It SHALL reject insufficient stock
according to the company's negative-stock policy. Local cache quantities SHALL
never override the server movement ledger.

## Requirement: Invoice intent

The POS SHALL persist whether the operator requested an electronic invoice,
including the selected customer and fiscal context. If the sale is synchronized
while the SRI is unavailable, the invoice intent SHALL remain pending and be
processed by a retryable server workflow. Reconnecting the POS SHALL not lose
that intent or create duplicate invoices.

## Requirement: Payments and treasury handoff

Each payment SHALL preserve method, amount, reference, destination account or
cash register, and payment state. The POS SHALL not invent bank movements
offline. The server SHALL create or link the financial effect idempotently when
the payment is accepted and shall hand it to Treasury when that module is
available.

## Requirement: Retry and conflict handling

The local queue SHALL preserve retry count, last error, next retry time, and a
user-visible state. Permanent validation errors SHALL be separated from
temporary network/SRI errors. Operators SHALL be able to inspect and retry a
pending operation without creating a second sale.

## Required acceptance scenarios

- the same UUID submitted twice creates one canonical sale;
- a sale cannot cross company, cash register, warehouse, customer, or product;
- missing or closed cash opening rejects synchronization;
- a confirmed sale produces one inventory exit;
- insufficient stock leaves no partial sale or stock change;
- an offline invoice request remains pending until processed;
- retrying after an SRI timeout does not create a second invoice;
- a local SQLite failure rolls back sale, cache projection, and queue entry;
- two POS terminals cannot oversell locked stock;
- server stock remains authoritative over stale local cache data.
