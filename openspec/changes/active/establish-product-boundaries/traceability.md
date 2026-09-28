# FacturaOF1 traceability matrix

This matrix is the working source of truth for the migration. A checked item
means the repository contains the implementation artifact; staging evidence is
tracked separately and is never inferred from a build.

| Requirement | Backend source | Frontend/source | Verification state |
|---|---|---|---|
| Active company context | `apps/usuarios`, `apps/empresas/middleware.py`, `apps/core/tenant.py`, tenant-aware domain views | `authStore`, `apiClient`, `Layout` | Unit/static/build; scoped/global role tests; integration runtime pending |
| Establishment and emission point | `apps/empresas/urls.py`, `apps/facturacion/services/fiscal_context.py`, `apps/facturacion/serializers.py` | `empresasService`, invoice/sale dialogs | Static/build; active-company and cross-tenant checks; fiscal staging pending |
| Fiscal sequence isolation | `Secuencial` + fiscal resolver | Selected context payload | Code path; concurrency test pending |
| Fiscal submission idempotency | `ComprobanteElectronico.procesamiento_en_curso` + timestamp, claim in `factura_service.py`, views and Celery poller | Status/retry UI | Static/unit source review; staging SRI concurrency pending |
| Discount source of truth | `apps/ventas/serializers.py`, `factura_service.py` | POS and invoice calculations | Static; end-to-end pending |
| Inventory ledger and valuation | `apps/ventas/inventory.py`, `apps/ventas/signals.py`, `apps/inventarios/valuation.py`, `apps/inventarios/views.py`, `apps/proveedores/views.py`, `apps/ventas/views.py` | Existing inventory UI and company policy, signed return movements with idempotency | Reconciliation endpoint, locked/idempotent receipt and transfer transitions, FEFO, weighted-average cost, per-company negative-stock policy, lot-aware sale reversal; acceptance scenarios in `inventory-acceptance-scenarios.md` |
| Treasury closure | `apps/bancos/models.py`, `CierreTesoreriaViewSet` | `bancosService.ts`, `BancosPage.tsx` | Static/build; staging API pending |
| POS offline sync | `apps/ventas/serializers.py`, POS sync service | Electron transaction/retry flow and `X-Empresa-ID` propagation | POS build; multi-terminal test artifact added, staging runtime pending |
| Automation contract | `apps/automation`, dispatcher command, `AutomationWebhookEvent` with nullable `empresa` context | Independent automation compose | Static; staging mock pending |
| Automation dispatch concurrency | `AutomationWebhookEvent.dispatch_en_curso` + timestamp, dispatcher claim | Automation status/dead-letter UI | Static; staging mock concurrency pending |
| Product boundaries | `openspec`, deployment compose files | `productTarget`, route allowlist, `ProtectedRoute` | Artifact/build; 42 frontend tests including unauthorized-route guards; staging parallel run pending |
| Governance decision | `governance-decision.md` | Product targets and deployment README | Approved; rollout evidence pending |
| Inventory transfer lifecycle | `apps/inventarios/views.py`, `MovimientoInventario` | Transfer API/screens | Static; staging receipt/concurrency scenario pending |

## Verification rules

- A migration is not considered production-ready until applied to a staging
  copy and checked against existing counts, constraints, and sequences.
- A frontend build proves compilation only; it does not prove tenant isolation,
  SRI behavior, or authorization.
- Historical documents retain legacy string fields; nullable references are
  backfilled only after a reversible staging validation.
