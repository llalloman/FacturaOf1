# Spec: Signature Sales Automation

## ADDED Requirements

### Requirement: Lead intake automation

The system SHALL trigger an automation when a new electronic signature request is created from the public form.

#### Scenario: New public request

- WHEN a public user submits a valid signature request
- THEN the automation receives the request identifier
- AND retrieves the request details from FacturaOF1
- AND sends an initial WhatsApp confirmation

### Requirement: Follow-up traceability

The system SHALL record automated follow-up actions in FacturaOF1.

#### Scenario: WhatsApp confirmation sent

- WHEN the automation sends a WhatsApp message successfully
- THEN the action is registered against the signature request

### Requirement: Sensitive document protection

The system SHALL NOT expose sensitive document URLs through automation messages.

#### Scenario: Missing document reminder

- WHEN documents are missing
- THEN the automation sends a message describing the missing document types
- AND does not include direct public document links

### Requirement: Human handoff

The system SHALL keep a human advisor in the sales process.

#### Scenario: Request needs validation

- WHEN a request is received
- THEN the message indicates that an advisor will continue the process
