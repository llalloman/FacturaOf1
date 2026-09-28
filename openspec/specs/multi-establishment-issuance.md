# Multi-establishment and emission points

## Requirement: Establishment hierarchy

The system SHALL model the following hierarchy:

```text
Empresa
└── Establecimiento
    └── PuntoEmision
```

Codes SHALL be three-digit values and SHALL be unique within their parent
scope. An establishment address SHALL be distinct from the company's matrix
address.

## Requirement: Issuer context

Every fiscal document SHALL use an explicit establishment and emission point.
The system MAY provide a default context per user, caja, channel, or
integration, but SHALL not rely on one pair of fields on `Empresa` as the only
issuance context.

## Requirement: Sequence isolation

The sequence key SHALL be:

```text
empresa + tipo_comprobante + establecimiento + punto_emision
```

Concurrent issuance for the same key SHALL be serialized. Different keys MAY
advance independently.

## Requirement: Historical integrity

Once a fiscal document is created, its company, establishment, emission point,
matrix address, establishment address, and sequence context SHALL remain
available for historical rendering and audit even if the current catalog is
later edited.
