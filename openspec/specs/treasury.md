# Treasury and cash management

## Status

This capability is part of the target platform and is planned for a later
implementation phase. Existing banking, receivables, payables, payroll, and
online-payment modules SHALL remain compatible with this design.

## Requirement: Treasury scope

Treasury SHALL centralize the control of cash, bank accounts, cash boxes,
collections, disbursements, transfers, reconciliation, and cash closures for
each company. It SHALL not replace invoicing, receivables, payables, payroll,
or accounting; it SHALL orchestrate their financial effects.

## Requirement: Financial ownership and context

Every treasury operation SHALL belong to one company and MAY be associated
with an establishment, operational cash box, bank account, fund, project, or
cost center. Treasury cash boxes SHALL be distinct from fiscal emission points.

## Requirement: Cash boxes and closures

The system SHALL support multiple physical or operational cash boxes per
company, including establishment, user, event, and fixed-fund boxes. A cash
box SHALL support opening, movements, handover, cash count, difference,
approval, and closing. Closed periods and approved closures SHALL not be
silently editable.

## Requirement: Receipts and disbursements

Receipts and disbursements SHALL support configurable concepts, payment
methods, third parties, references, related documents, attachments, approval
state, responsible users, and audit history. They SHALL be linkable to sales,
receivables, supplier payables, payroll, memberships, tuition, events,
donations, sponsorships, and other organization-specific obligations.

## Requirement: Reconciliation and transfers

Treasury SHALL support transfers between cash boxes and bank accounts and
bank reconciliation against imported or manually registered statements.
Reconciliation SHALL preserve unmatched, matched, duplicate, and adjusted
states with an audit trail.

## Requirement: Configurable obligations and funds

The platform SHALL support configurable obligations and concepts for general
companies, schools, colleges, clubs, leagues, and similar organizations.
Examples include tuition, enrollment, memberships, registration, scholarships,
donations, sponsorships, events, and restricted funds. Budgets, funds, and
cost centers MAY constrain or report the use of money without changing the
underlying accounting source of truth.

## Requirement: Segregation of duties

The system SHALL support separate permissions for recording, approving,
paying, reconciling, closing, annulling, and adjusting treasury operations.
High-value disbursements SHOULD support configurable dual approval.

## Requirement: Integration contract

The financial flow SHALL be traceable without duplicating amounts:

```text
Sales / Receivables / Payables / Payroll / Online payments
                         ↓
                      Treasury
                         ↓
                 Bank or cash box
                         ↓
                    Accounting
```

Each integration SHALL be idempotent, auditable, and reversible through an
explicit adjustment or reversal rather than deletion of historical evidence.
