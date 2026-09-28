# Multi-company platform administration

## Requirement: Full multi-company administration

OF1 Solutions Admin SHALL administer multiple companies across their complete
business lifecycle, not only their registration or subscription.

For every company, authorized platform users SHALL be able to manage or inspect
the permitted scope of company profile, users, memberships, subscriptions,
modules, establishments, emission points, sequences, banks, cash, payments,
products, customers, suppliers, inventory, purchases, sales, invoices,
receivables, accounting, payroll, signature orders, Firmador resources,
Automation integrations, and audit records.

## Requirement: Scope-aware platform roles

Platform roles SHALL have explicit scopes:

```text
global platform scope
company scope
module scope
read/write scope
```

No platform user SHALL receive unrestricted cross-company write access merely by
having a generic administrator role.

## Requirement: Company context continuity

The active company context SHALL remain visible in every administrative screen
and SHALL be included in relevant API requests, audit records, exports, jobs,
notifications, and Automation events.

### Scenario: Operator changes company

- WHEN an authorized operator switches from Company A to Company B
- THEN all subsequent screens and operations SHALL use Company B
- AND the interface SHALL clearly display Company B
- AND cached data from Company A SHALL be invalidated or isolated
- AND the switch SHALL be auditable.

## Requirement: Suspension safety

- Suspending a company SHALL block operational access without deleting fiscal or
  financial history.
- Deactivating a subscription SHALL change entitlements without deleting
  company-owned records.
- Deleting a platform user SHALL preserve audit history and business ownership.
