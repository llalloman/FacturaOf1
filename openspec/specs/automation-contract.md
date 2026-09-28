# Automation contract

## Requirement: API and event integration

Automation SHALL consume versioned API endpoints or authenticated events from
OF1 domains. It SHALL not connect directly to the FacturaOF1 or platform
database.

### Scenario: New signature order

- WHEN a signature order is created
- THEN the owning domain SHALL publish an event or expose it through the
  automation contract
- AND Automation SHALL acknowledge and process it using an idempotency key.

## Requirement: Safe automation

Automation SHALL not make final fiscal, payment, pricing, or authorization
decisions without an explicit domain API operation.

### Scenario: Missing documents

- WHEN a workflow detects missing documents
- THEN it may notify the customer and create a follow-up
- AND it SHALL not mark the order as issued or paid.
