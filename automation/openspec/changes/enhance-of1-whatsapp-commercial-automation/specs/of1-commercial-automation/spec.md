# Spec: OF1 Commercial Automation

## ADDED Requirements

### Requirement: WhatsApp inbound messages shall be traceable

The system SHALL register inbound and outbound WhatsApp interactions related to commercial leads, support cases, or signature orders in FacturaOF1.

#### Scenario: Inbound text message received

- WHEN the WhatsApp Gateway receives an inbound text message
- THEN n8n SHALL send it to FacturaOF1 as an inbound interaction
- AND FacturaOF1 SHALL store phone, channel, direction, message body, timestamp, and idempotency key

#### Scenario: Outbound template sent

- WHEN n8n sends a controlled template through the WhatsApp Gateway
- THEN n8n SHALL register the outbound interaction in FacturaOF1
- AND the interaction SHALL include the selected template key and gateway result

### Requirement: AI shall only classify and summarize

The system SHALL use DeepSeek only to classify, summarize, estimate confidence, and suggest an internal template key.

#### Scenario: AI classification succeeds

- WHEN DeepSeek returns a valid category with sufficient confidence
- THEN n8n SHALL select a controlled response template
- AND n8n SHALL NOT send free-form AI output to the customer

#### Scenario: AI confidence is low

- WHEN DeepSeek confidence is below the configured threshold
- THEN n8n SHALL use a human handoff template
- AND n8n SHALL create or update a lead requiring human attention

### Requirement: Commercial leads shall be created or updated by phone

The system SHALL create or update commercial leads from WhatsApp conversations using normalized phone and channel as matching keys.

#### Scenario: New ERP lead writes by WhatsApp

- WHEN a customer asks about FacturaOF1 ERP
- THEN the system SHALL create or update a lead with interest type `erp`
- AND the system SHALL preserve the conversation summary

#### Scenario: Existing lead writes again

- WHEN a known phone sends a new message
- THEN the system SHALL update the existing lead context
- AND SHALL NOT create duplicate leads for the same channel and phone

### Requirement: Responses shall avoid sensitive data collection over WhatsApp

The system SHALL direct customers to official forms when sensitive information or documents are required.

#### Scenario: Signature request asks for requirements

- WHEN a customer wants to request an electronic signature
- THEN the response SHALL provide the official form URL
- AND SHALL NOT ask for identification documents, fingerprint code, certificates, passwords, or tokens over WhatsApp

### Requirement: Duplicate responses shall be prevented

The system SHALL use idempotency keys for inbound messages and backend events.

#### Scenario: n8n retries the same inbound message

- WHEN the same message idempotency key is processed more than once
- THEN FacturaOF1 SHALL identify the duplicate
- AND n8n SHALL NOT send duplicate customer responses

### Requirement: Empty and multimedia messages shall be handled safely

The system SHALL not fail or call AI unnecessarily when a message is empty or multimedia-only.

#### Scenario: Empty message

- WHEN an inbound message has no usable text
- THEN the system SHALL skip DeepSeek classification
- AND SHALL use a controlled fallback or no-op according to workflow rules

#### Scenario: Multimedia message

- WHEN an inbound message contains image, audio, video, or document metadata
- THEN the system SHALL register metadata only
- AND SHALL NOT send the file content to DeepSeek

### Requirement: Signature order events shall be standardized

FacturaOF1 SHALL emit standardized automation events for signature order lifecycle changes.

#### Scenario: Signature order created

- WHEN a public signature order is created
- THEN FacturaOF1 SHALL emit `signature_order.created`
- AND the event SHALL include event id, type, occurred at, source, version, idempotency key, and order summary

#### Scenario: Payment proof uploaded

- WHEN a customer uploads a payment proof
- THEN FacturaOF1 SHALL emit `payment.proof_uploaded`
- AND the automation SHALL notify a human operator for manual validation
- AND the automation SHALL NOT validate the bank transaction automatically

#### Scenario: Order ready for issuance

- WHEN a signature order is ready for issuance
- THEN FacturaOF1 SHALL emit `signature_order.ready_for_issuance`
- AND the automation SHALL notify the operator for manual Nexus/Uanataca issuance
- AND the automation SHALL NOT perform automatic issuance

### Requirement: Automation actions shall be auditable

The system SHALL record automation events, retries, errors, and state changes in FacturaOF1.

#### Scenario: Webhook dispatch fails

- WHEN FacturaOF1 fails to deliver an event to n8n
- THEN the failure SHALL be recorded with attempt count and last error
- AND the event SHALL remain available for retry

#### Scenario: Workflow updates order status

- WHEN an approved workflow updates a signature order status
- THEN FacturaOF1 SHALL record actor, action, entity, previous state, new state, and timestamp
