# Design: Establish OF1 product boundaries

## Initial topology

```text
of1-admin-web  ─┐
facturaof1-web ─┼─> modular FacturaOF1 backend API
firmador-web   ─┘

automation (n8n + WhatsApp gateway) ──> authenticated API/events
```

The backend remains one deployment initially, but modules declare ownership,
API namespace, permissions, and source of truth.

## Frontend strategy

Start with independent Vite build targets and containers from the existing
frontend codebase. Extract shared UI and auth utilities only after the product
route allowlists are stable.

## Migration strategy

1. Baseline current routes and role behavior.
2. Add product identities and allowlists.
3. Build OF1 Admin shell.
4. Move platform operations without deleting legacy routes.
5. Add API contracts and event acknowledgements for Automation.
6. Verify tenant isolation and cross-product navigation.
7. Remove or redirect superseded routes only after evidence is recorded.
