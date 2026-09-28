# OF1 Platform Project Context

## Products

- **OF1 Solutions Admin**: central platform administration, customers,
  subscriptions, commercial operations, signature sales, payments, support,
  entitlements, and global reporting.
- **FacturaOF1**: tenant ERP for electronic invoicing and business operations:
  sales, POS web, inventory, purchases, receivables, banks, accounting, payroll,
  SRI configuration, and fiscal documents.
- **OF1 Firmador**: PDF signing, certificates, workspaces, signed documents,
  public validation, and usage limits.
- **Automation**: n8n, WhatsApp gateway, AI classification, notifications,
  retries, and workflow execution. It consumes APIs and events; it does not own
  commercial or fiscal master data.

## OF1 Solutions as an operating company

OF1 Solutions has two distinct identities that must not be conflated:

1. **Platform owner**: manages products, subscriptions, entitlements, support,
   commercial operations, and internal users.
2. **Legal operating company**: exists as a regular `Empresa` tenant in
   FacturaOF1, with its own RUC, fiscal certificate, establishments, emission
   points, sales, banks, payroll, accounting, inventory, and all other ERP
   capabilities.

The platform administration may switch to the OF1 Solutions tenant through an
audited company context. It must not bypass the ERP tenant model or issue fiscal
documents from an abstract platform account.

## Fiscal issuer structure

Every `Empresa`, including OF1 Solutions, may have multiple establishments and
multiple emission points per establishment. Fiscal sequences are isolated by
company, document type, establishment, and emission point. A fiscal document
must preserve the issuer context used at emission time.

## Initial deployment assumption

The backend remains a modular monolith initially. The three product frontends
and Automation are deployed independently. Backend extraction and database
separation are future changes, not implied by frontend separation.

## Repository topology

The target delivery topology is seven repositories: `facturaof1-back`,
`facturaof1-web`, `facturaof1-pos`, `facturaof1-firmas`,
`facturaof1-firmador`, `of1-automation`, and `of1-admin-web`. The backend remains one deployment and one operational
source of truth. Repository extraction is incremental and must preserve a
rollback copy until each repository passes its build, contract, security, and
deployment checks.

## Source of truth

| Domain | Authoritative product |
|---|---|
| OF1 organizations, subscriptions, plans, entitlements, leads, signature sales | OF1 Solutions Admin domain |
| Fiscal documents, ERP sales, inventory, purchases, accounting, payroll | FacturaOF1 domain |
| PDF certificates, workspaces, signed documents | OF1 Firmador domain |
| Workflow runs, retries, technical execution logs | Automation |

Automation may cache operational references, but must not become authoritative
for business, payment, customer, signature, or fiscal state.

## Multi-company operating model

OF1 Solutions Admin SHALL be multi-company across all administrative and
operational aspects. It is not merely a company selector or a read-only global
dashboard. It must administer multiple companies while preserving strict data
ownership and scope for each company's records.

The current implementation has partial tenant isolation: most records belong to
one `Empresa`, while a user normally has one assigned company and only
`SUPER_ADMIN` can select another company through the request context.

The target model is explicit company membership:

```text
Usuario
└── EmpresaMembership
    ├── Empresa
    ├── rol dentro de la empresa
    ├── permisos
    └── estado
```

An authenticated session SHALL have one active company context. ERP operations
must resolve the active company, establishment, and emission point through a
validated server-side context. Platform roles may have cross-company scope only
when that scope is explicitly granted and audited.

Company scope applies to users, subscriptions, entitlements, sales, fiscal
documents, establishments, emission points, sequences, customers, products,
warehouses, inventory, suppliers, purchases, banks, cash, payments, payroll,
accounting, signature orders, Firmador resources, notifications, audit records,
and Automation events. Global plan definitions, module definitions, role
definitions, and integration definitions may remain platform-wide catalogs.
