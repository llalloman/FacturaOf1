# Company memberships and active context

## Requirement: Membership-based access

The system SHALL model access through a company membership rather than assuming
that each user belongs to exactly one company.

Each membership SHALL include:

- user;
- company;
- tenant role;
- optional module scope;
- active/inactive state;
- effective dates when required;
- audit metadata.

## Requirement: Active company context

The active company context SHALL be resolved by the backend from an authenticated
session or an authenticated context-switch operation. A client-supplied company
ID SHALL not grant access by itself.

### Scenario: Invalid company switch

- WHEN a user requests a company for which no active membership or platform scope
  exists
- THEN the backend SHALL reject the switch
- AND SHALL not change the current context
- AND SHALL record the denied attempt when security auditing is enabled.

## Requirement: ERP context

For ERP operations, the active context SHALL resolve in this order:

```text
company → establishment → emission point
```

Each selected object SHALL belong to its parent and active company. The backend
must reject mismatched combinations even when valid IDs are supplied.

## Requirement: OF1 Solutions operating tenant

OF1 Solutions SHALL have a normal company membership and tenant context for its
own ERP operations. Platform administration SHALL not create a parallel fiscal
company outside the ERP model.
