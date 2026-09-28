# Implementation progress

## Independent Automation project

The deployable Automation project now exists under `of1-automation/` with its
own Git repository, Docker Compose, n8n PostgreSQL volume, n8n volume, WhatsApp
session volume, gateway source, workflow templates, environment contract, and
deployment documentation. Its Compose is included in the independent product
verification script and does not share the ERP database.

The previous `automation/` directory is retained temporarily as a compatibility
archive. It must not receive new production secrets or be used for the final
cutover until the independent project passes staging workflow import, webhook,
WhatsApp session, and rollback checks.

The independent project now also includes a non-secret environment validator,
explicit workflow import tooling, n8n workflow backup tooling, an Nginx HTTPS
reference configuration, and a staging runbook. These tools validate and
prepare the deployment but do not import workflows, connect WhatsApp, or send
production events automatically.

## Repository topology decision

The delivery boundary is now explicitly seven repositories: backend, FacturaOF1,
POS, Solicitudes de Firma, Firmador, Automation, and OF1 Admin. The initial
local extraction is present as six Git repositories under the workspace; the
Solicitudes de Firma repository is intentionally deferred while its current
flow remains active. No remote has been configured; the original checkout
remains a temporary migration workspace and rollback source until the new roots
pass their own builds and deployment checks.

Se agregó `deployments/backend-staging/docker-compose.yml` con PostgreSQL,
Redis y API aislados, puertos y volúmenes propios, `SRI_AMBIENTE=PRUEBAS` y
política de inventario estricta. Docker no pudo ejecutarse en esta sesión por
falta de acceso al daemon; el Compose queda listo para validación en el host.

El backend admite ahora `DJANGO_TEST_DB_NAME` para que el runner de integración
use una base de pruebas explícita y aislada. El Compose de staging la define
como `facturaof1_staging_test`; no se ejecutó contra la conexión configurada en
`.env`.

La configuración rechaza ahora `manage.py test` si no se proporciona ese
nombre explícito, evitando que un test interactivo pueda intentar crear o
eliminar una base derivada de la conexión productiva.

Se corrigió el contrato del kardex para permitir cantidades negativas en
salidas, manteniendo la validación de signos por tipo de movimiento. Se añadió
la migración `0006`, idempotencia al formulario manual y opciones explícitas de
devolución de cliente/proveedor. El build y el drift de migraciones pasan.

El web-admin ahora tiene pruebas de guardas de ruta para sesión no autenticada,
correo no verificado, rol no autorizado y rol autorizado. La suite pasa con 42
pruebas y el build de producción continúa correcto.

El flujo de recepción de compras incluye además un escenario de prueba para
dos recepciones que compiten por el mismo pendiente; su ejecución requiere el
PostgreSQL aislado definido en el runbook de staging.

Se agregó `deployments/verify-backend-safe.ps1` como verificación reproducible
sin base de datos: check Django, drift de migraciones, compilación Python y
19 pruebas unitarias. No crea, elimina ni migra bases o contenedores.

La auditoría de ejecución detectó y corrigió imports/referencias indefinidas en
Firmador, confirmación de compras y reconciliación venta-factura; `manage.py
check`, compilación Python y drift de migraciones vuelven a pasar.

La confirmación de recepciones de compra ahora bloquea la orden y sus detalles
antes de validar cantidades, impidiendo sobre-recepción concurrente. La
generación del número de recepción también bloquea la empresa dentro de la
transacción para evitar duplicados. El flujo de devoluciones y la ejecución de
escenarios completos siguen requiriendo validación de staging.

## Multiempresa: corte 2026-09-23

Completed in this cut:

- Added `EmpresaMembresia` as an additive model with company role, module
  scope, active status, default flag, metadata, and audit creator.
- Added `/api/usuarios/contextos/` to list and validate company context.
- Added `/api/usuarios/membresias/` for scoped administration by platform or
  company administrators.
- Added membership-aware `X-Empresa-ID` validation in `TenantMiddleware`.
- Preserved `Usuario.empresa` as a temporary fallback for existing production
  users; no backfill or destructive migration was executed.
- Added tests for second-company access, cross-company rejection, and legacy
  context compatibility.
- Propagated the active company through the web-admin request interceptor and
  added company-context selection with stateless validation.
- Added `AccesoPlataforma` with explicit platform roles/capabilities, separate
  from `EmpresaMembresia`; central permissions now accept the new scope while
  retaining SUPER_ADMIN compatibility.
- Extended active-tenant resolution to provider purchasing/receipts,
  inventory-related accounting, cartera and cotizaciones instead of assuming
  only `Usuario.empresa`.
- Updated POS sync validation and core inventory/ventas reads to prefer the
  active tenant while retaining the legacy company fallback.
- Added a shared active-company resolver and applied it to clients, payroll,
  orders, sales, inventory, and provider permissions.
- Platform users with an explicit `X-Empresa-ID` are now scoped to that tenant
  in inventory, cash registers, sales, and the middleware subscription check;
  an unscoped platform session retains global administration compatibility.
- Firmas, Firmador, fiscal administration, Automation, and provider writes now
  use capability-aware platform access while retaining legacy `SUPER_ADMIN`.
- Subscription administration, dashboard, banking, payment configuration,
  payment history, POS synchronization, and inventory now apply capability
  checks and tenant scoping when a platform context is selected.
- User administration, membership management, and sequential correction now
  use the same capability-aware boundary instead of role-name checks.
- Login/session payloads expose active memberships and platform capabilities;
  frontend route guards and the platform menu enforce those capabilities while
  preserving legacy `SUPER_ADMIN` behavior.

Still pending before this area is complete:

- Explicit platform scopes and audited cross-company actions for superadmins.
- Backfill plan and staging validation for existing users.
- Propagation of active context to every domain, export, job, notification,
  and frontend store.
- Permission tests for all tenant endpoints.
- Staging evidence for every domain and cross-company export/download path.
- Remaining legacy role checks in scheduled subscription tasks and a few
  company-scoped serializers are tracked for the staging permission audit.

Financial and operational querysets now share `tenant_queryset`: the legacy or
global platform administrator may request a consolidated view without a
tenant, while scoped platform roles (support/auditor) cannot see all companies
without an explicit authorized context. Financial and inventory writes require
an active company. Subscription notifications include active
`EmpresaMembresia` administrators.

The sales projection endpoint now resolves its stock projection from the active
company instead of the user's legacy primary company. Subscription summaries
and trial creation now limit scoped platform roles to the selected company;
only global platform access may operate on the consolidated view.

Global plan/module catalogs now require global platform administration; a
module-scoped subscription role cannot modify platform-wide entitlements.

## Fiscal context: cut 2026-09-23

Completed in this cut:

- Added scoped APIs for `Establecimiento` and `PuntoEmision`.
- Added three-digit code validation and parent-company ownership checks.
- Added company-admin permissions and route registration.
- Kept the legacy issuer fields on `Empresa` as a fallback; new documents may
  now use explicit fiscal context without changing production defaults.

Still pending before fiscal production cutover:

- Isolate sequences by company, document type, establishment, and point.
- Validate historical documents in staging before production migration.

## Comprobantes y RIDE: corte 2026-09-23

Completed in this cut:

- Added nullable fiscal-context references to `ComprobanteElectronico`.
- Added a single resolver with explicit validation and legacy fallback.
- Direct invoice creation accepts `establecimiento_id` and
  `punto_emision_id`.
- Invoice, retention, guide, debit-note, and credit-note creation preserve the
  fiscal context when available.
- SRI XML and RIDE use the establishment address when the reference exists.
- Existing documents remain compatible because legacy string fields are
  preserved and new references are nullable.
- Direct invoice, sale-to-invoice, and POS invoice flows now accept explicit
  context; old flows continue using the configured company pair.
- Online signature-payment configuration can optionally select an establishment
  and emission point; the generated sale preserves that fiscal context while
  retaining the legacy company fallback.
- Added a read-only inventory reconciliation endpoint comparing stock with
  the movement ledger; it does not repair or mutate production balances.

Still pending before production activation:

- Backfill references for historical documents only after staging validation.
- Run Django migration and full fiscal XML/RIDE tests in staging.

## Tesorería y Automation: corte 2026-09-24

Completed in this cut:

- Added auditable treasury closures by company and date, with theoretical
  balance snapshot, declared balances, calculated difference, responsible
  users, and explicit close state.
- Exposed treasury closure APIs separately from POS cash openings and fiscal
  emission points.
- Added frontend service contracts for treasury closures.
- Added the treasury closure panel with snapshot preparation, declared-balance
  capture, difference display, and no-mutation messaging.
- Versioned Automation webhook contracts and added authenticated delivery
  acknowledgement with SENT/FAILED/SKIPPED states, attempt count, and error.
- Added a separate opt-in dispatcher management command with dry-run mode,
  explicit HTTP send flag, idempotency headers, retry backoff, and dead-letter.

Still pending:

- Add configurable obligations/funds for later treasury phases. The closure UI
  now prepares a company-scoped snapshot and records declared balances.
- Execute migrations and API tests in a Django-enabled staging environment.
- Execute the dispatcher in staging with mocked consumers before enabling HTTP
  delivery operationally.

Automation delivery state now includes scheduled retry timestamps, exponential
backoff, dead-letter timestamp after five failed acknowledgements, an
authenticated manual retry endpoint, and a separate opt-in dispatcher. The
external network path remains disabled until staging tests approve it.

Acknowledgement and dead-letter retry endpoints now lock the event row, and
repeated terminal acknowledgements are no-ops. An integration test covers that
idempotent terminal acknowledgement; execution still requires the isolated
PostgreSQL test database.

Automation webhook events now have an additive nullable company context. The
serializer validates active `empresa_id` values when supplied, and the
dispatcher forwards that context to consumers; legacy platform-global events
remain valid without a company.

Automation idempotency now rejects reuse of a key with a different event,
contract, entity, or company context. Integration coverage was added for this
conflict; it requires the isolated PostgreSQL test database to execute.

The signature administration queryset now honors the selected company even for
global platform users; consolidated signature access remains available only
without an active company. Inventory transfers also preserve the legacy
company fallback and make rejection state changes atomic.

Purchasing and supplier `ModelViewSet` mutations now require an active company
and verify the instance belongs to it; consolidated supplier data remains
read-only unless a tenant context is selected.

## POS synchronization: cut 2026-09-24

Completed in this cut:

- Repeated UUIDs remain idempotent when their business payload is identical.
- A repeated UUID with a different company, number, total, or fiscal context is
  rejected as an explicit synchronization conflict.
- Local queue items stop automatic retries after five failures and are exposed
  as dead-letter counts in the POS status bar.
- A controlled manual requeue operation resets a dead-letter item for review.

Still pending:

- Add multi-terminal concurrency tests and a complete dead-letter review screen.

The POS desktop now exposes dead-letter count as an actionable retry control;
the retry operation is available in both Electron entrypoints and preserves
the existing automatic retry limit.

The regular web sale serializer is now transactional across sale, details,
payments, inventory movements, and financial effects; POS sync already uses an
atomic view transaction. Scenario/concurrency evidence remains pending.

Inventory now has an explicit rollout policy flag: legacy-compatible negative
stock remains enabled by default, while staging can set
`INVENTORY_ALLOW_NEGATIVE_STOCK=false` to reject insufficient non-lot exits
under a row lock.

Inventory workflow hardening in this cut also locks purchase receipts and
transfers during state transitions, adds an explicit `recibir` transition for
transfers, prevents cross-company products/bodegas in manual movements, and
keeps repeated confirmation requests idempotent by state.

Purchase receipt confirmation now returns the existing receipt on repeated
confirmation requests instead of treating a completed receipt as a new
operation; the transaction remains protected by the row lock and atomic
boundary.

Transfer creation is now atomic, and repeated dispatch/receipt calls return
the current transfer state without applying inventory effects a second time.

Inventory signals no longer swallow stock/kardex exceptions: a failed stock
effect propagates so the surrounding atomic operation can roll back instead
of confirming a sale with an incomplete ledger.

Inventory stock projections now maintain weighted-average cost through a pure
valuation helper. Negative-stock policy is configurable per company with a
backward-compatible default of `true`; the environment flag remains a
fallback for legacy objects.

## Discounts: cut 2026-09-24

Completed in this cut:

- Established detail discount precedence for new and edited invoices.
- A line discount is reflected in the net taxable base and is not subtracted
  again from the invoice total.
- A legacy/global header discount remains supported when line discounts are
  zero and is applied exactly once.
- POS and web-admin tests continue to cover clamping, percentage, final-price,
  and total scenarios.

Still pending:

- Run backend serializer/service tests in staging and reconcile historical
  invoices before any data correction.

Verification note: the project virtualenv passes `manage.py check` and
`makemigrations --check --dry-run` reports no model/migration drift. The
targeted unit suite passes (17 tests), while full PostgreSQL integration
execution remains a staging gate because the configured local test database
was already present and the runner stalled while handling it; a temporary
SQLite attempt is incompatible with the PostgreSQL-only migration set. No
production database was touched.

The backend now centralizes line arithmetic in `apps/facturacion/pricing.py`.
POS/offline sale synchronization validates that each sent subtotal, IVA, and
total came from gross unit price minus the line discount, and that the header
discount equals the sum of line discounts.

The Empresa model now defaults the provider RUC to `1793231594001` when no
explicit provider is configured. The OF1 tenant audit command remains
read-only by default; its explicit `--apply` mode requires contact data and
creates only a test-environment tenant.

Inventory transfer lifecycle: dispatch now decrements only the origin;
physical receipt increments the destination. Both steps use idempotent
movement references, and receipt recognizes the legacy reference format.

Company-scoped catalog and fiscal-structure endpoints now use the common
tenant queryset/context rules; users with scoped platform access cannot list
all products, clients, payroll records, establishments, or emission points
without an active company.

Sale cancellation now reverses every FEFO output movement separately,
preserving its lot and cost instead of restoring the whole detail quantity to
the first lot. Additional reversals use a movement-specific idempotency key.

The generic inventory movement API is now append-only: it validates the sign
of entries/exits, requires an active company, enforces the company negative
stock policy for manual exits, and no longer permits update/delete operations
that could desynchronize the ledger from the material balance.

Inventory movements now accept an optional company-scoped `idempotency_key`
with a database uniqueness constraint; repeated manual adjustments return the
existing ledger row instead of creating a duplicate, while reusing the key with
a different payload is rejected as a conflict. Historical movements are
unchanged because the field is nullable.

Stock projections are now read-only through the API; lot quantities cannot be
edited directly and lots with movement history cannot be deleted. Inventory
changes must enter through the movement ledger or an atomic business flow.

Platform access now distinguishes global administration from module-scoped
access in users, memberships, payments, subscriptions, sales, cash openings,
and cash movements. Scoped platform users need an active company context for
operational data. Transfer listing applies the same boundary and returns no
cross-company data without that context.

Cash opening creation now locks the cash register and rejects a second active
opening, protecting multi-terminal sessions from duplicate open shifts.

Fiscal document creation now requires the active company for invoices,
withholdings, guides, and debit notes; invoice products and customers are
validated against that company, and scoped platform users cannot manage
consolidated sequentials without selecting a company.

Retentions and debit notes now validate provider, customer, source invoice,
and active-company ownership before creation. Fiscal processing also uses an
atomic non-fiscal claim (`procesamiento_en_curso`) so concurrent Celery/API
workers cannot sign or submit the same document twice; the authorization
poller uses the same claim. This is code-level protection; SRI and staging
concurrency evidence remains pending.

Signature administration, Firmador administration, declarations, and received
document queries now use the active company boundary; only global platform
access receives consolidated signature administration. Automation dispatches
also use an atomic `dispatch_en_curso` claim so concurrent workers cannot
select and send the same pending event at once. These boundaries still require
staging endpoint and authorization evidence.

Both claims now record their start timestamp and reclaim only after a
conservative timeout, allowing recovery from a crashed worker without
changing the functional fiscal or Automation state.

The inventory movement modal now sends the canonical append-only movement
types and signed quantities (`ENTRADA_COMPRA`, `SALIDA_VENTA`, adjustment
variants), removes the unsupported generic transfer/manual date payload, and
reads the backend's `fecha_movimiento` field. This closes a frontend/backend
contract mismatch; inventory scenario execution remains a staging gate.

POS now propagates its configured company through `X-Empresa-ID`, rejects
placeholder IDs in local configuration, and supports explicit establishment
and emission-point IDs for offline sales and invoice intent. Server validation
remains authoritative for all referenced company resources.

The POS configuration form now normalizes cleared optional fiscal IDs to
`undefined` instead of persisting `NaN`; the production build remains valid.

Added `deployments/verify-independent-frontends.ps1` as a reproducible gate
for web-admin tests, web-admin/POS builds, and the three independent Compose configurations.
The script is non-mutating; individual Compose validation passes, with only
the local Docker config permission warning remaining environmental.

POS web mode no longer injects sample products or a hardcoded company/client
when Electron is unavailable. It now reads products and clients from the API
using the configured active company, preserving tenant isolation in both POS
entrypoints.

The Electron receipt template also stopped substituting a fictitious consumer
identification when client data is absent; it now displays an empty value until
the authoritative sale data is available.

The transactional test suite now includes repeated sale inventory registration
and duplicate cash-opening scenarios; these require a staging-capable Django
test database for runtime execution.

The no-database permission suite now covers active-company precedence,
company-admin membership boundaries, scoped platform tenant access, and the
global-versus-scoped distinction (23 targeted unit tests pass). Endpoint-wide
runtime authorization and download tests remain a staging gate.

Operational web-admin pages now resolve the active company context from
`activeEmpresaId` for subscription guards, welcome/subscription queries, user
creation defaults, and signature pricing. Legacy `user.empresa_id` remains
only as a login/legacy fallback and in explicit global subscription
administration; it is no longer used as the tenant selector by those
operational pages. The web-admin test suite (38 tests) and production build
pass after this propagation.

The OF1 Solutions tenant audit command now blocks `--apply` unless the runtime
is explicitly a debug/test environment with `SRI_AMBIENTE=PRUEBAS`, preventing
an accidental tenant write against production. Read-only audit behavior is
unchanged.

The controlled bootstrap now optionally creates the base fiscal structure,
sequences, and an explicit membership for an existing user. It requires the
company's own RUC and no longer defaults the provider RUC to the operating
company identity; the provider RUC remains an independent service setting.

The safe backend verifier now initializes Django for its command-safety tests
and fails on a non-zero unit-test exit code; the database-free suite currently
passes 24 tests, including the certificate-secret response contract.

Automation dispatch failure accounting now counts the HTTP attempt exactly
once: the atomic claim increments the counter and failure handling only records
the result/backoff. A database-free regression test covers this invariant; the
safe suite currently passes 24 tests.

Regular sale creation now validates customer, product, warehouse, and supplier
ownership against the active company and derives every line subtotal, tax, and
total from gross unit price plus monetary discount through the shared pricing
service. Client-sent derived amounts are normalized instead of becoming a
second arithmetic source.

Regular and offline POS sales now reject negative prices, discounts, and
payment amounts, require at least one payment, and require the payment sum to
match the authoritative sale total before financial or inventory effects run.

Empresa administration writes now require `IsCompanyAdmin` or explicit
platform company scope for both `mi_empresa` and generic update actions; module
access alone can no longer modify company configuration.

Empresa responses no longer expose the private certificate file or encrypted
certificate password. They expose only `tiene_certificado`; upload fields remain
write-only and the configuration screens were aligned with that contract.

Certificate passwords are now encrypted at every write boundary: company
serializer create/update and onboarding use `set_password_certificado`; a
database-free regression test verifies ciphertext storage and decryption.

Dashboard and SRI declarations now evaluate module entitlements against
`active_empresa(request)`, not the legacy `user.empresa`, so switching between
companies cannot reuse the wrong subscription/module scope.

Automatic signature-payment application now locks the online payment and its
signature payment before checking `applied_at`, and locks the configured cash
register before creating an opening. Concurrent provider callbacks therefore
cannot create duplicate sales or active cash openings; runtime concurrency
evidence remains a staging gate.

Manual signature transfers are now idempotent per request: the service locks
the signature request, rejects a repeated payment with a different amount, and
reuses/retries the existing payment instead of creating a second sale.

PayPhone signature-payment creation now locks the request and reuses its
pending/redirected payment for the same amount; a repeated request with a
different amount is rejected instead of creating another provider transaction.

`Empresa.save()` no longer clears the persisted binary certificate or logo
copy when an unrelated company field is updated. This prevents production data
loss in ephemeral storage environments; file removal remains an explicit
operation rather than an accidental side effect.

Treasury closure creation now requires an active company explicitly, avoiding
null-company snapshots when a global platform administrator has not selected a
tenant.

Bank movement writes (create, update, delete, and reconcile) now require an
active company and verify account ownership. Global platform users retain
consolidated read access but cannot mutate an unspecified tenant.

The shared `HasModuleAccess` permission now checks object ownership whenever a
company context is selected, including related aggregates such as invoices,
bank movements, cash openings, and fiscal points. Operational ViewSets also
share `ActiveCompanyWriteMixin` for update/delete enforcement across clients,
products, cartera, quotations, accounting, inventory, orders, payroll, POS,
and fiscal structure. Database-free permission coverage now passes 27 tests.

The write mixin's relationship resolver is covered for direct and related
company records; the safe backend suite now passes 30 tests after the
operational ViewSet hardening.

The object-scope guard tolerates absent reverse one-to-one relations without
turning a valid request into a server error; coverage now totals 32 safe
backend tests.

Client/product soft-delete paths and fiscal-point updates now use the same
active-company guard, including validation when a point is reassigned to an
establishment. The final safe backend verification remains green: 32 tests,
system check, Python compilation, and migration drift check.

The effective provider RUC is now resolved through one helper: every company
uses `1793231594001` by default, while an explicitly approved company value is
honored consistently by XML and RIDE generation. Safe verification now passes
35 tests.

An attempted isolated SQLite integration run was intentionally not treated as
staging evidence: the migration graph contains PostgreSQL-specific SQL and
fails on SQLite. No production connection was used; the remaining integration
gate must run on the PostgreSQL staging Compose.

CuentaBancaria, CierreTesoreria, and Empresa administration updates/deletes
now require the active company through the shared write guard; global platform
list/create behavior remains available where it is intentionally central.

Platform identities no longer inherit `Usuario.empresa` as an implicit tenant
when no `X-Empresa-ID` is selected. Global platform sessions remain
consolidated and scoped platform sessions remain unscoped until an authorized
context is selected; legacy operational users retain their company fallback.
The safe suite now passes 36 tests.

Tenant-dependent frontend caches for notifications and enabled modules now
include `activeEmpresaId`. Company switching continues to persist the server
validated context and reload the application, preventing stale data from the
previous company from being rendered after a context change.

The application-level React Query cache is also cleared when the authenticated
user or active company changes. This protects legacy query keys that do not
yet carry a tenant identifier while endpoint-wide cache-key migration remains
an incremental follow-up.

Automation now exposes a pure request-builder contract used by the dispatcher;
database-free tests verify the contract version, bearer token, idempotency key,
tenant identifier, and event payload without performing network delivery. The
safe backend suite passes 33 tests and now includes a localhost HTTP mock that
checks authentication, duplicate delivery, and conflicting idempotency keys.

Fiscal ViewSets now resolve the active company through the shared tenant
helper, preserving selected-company precedence for list, retrieve, export,
XML, RIDE, and fiscal actions. Signature-payment bank accounts use the same
active company; only a global platform user without a selected company may
use the configured legacy default for the public/legacy flow.

The active-company write guard now has explicit unit coverage for the three
critical outcomes: no selected company is rejected, another company's record
is rejected, and a record from the active company is accepted. The safe
backend verification now includes inventory movement-sign and weighted-
valuation contract tests and passes 48 database-free tests.

Platform frontend hydration now refuses to restore a stale browser tenant
unless that tenant is an active membership of the current platform identity.
The independent frontend verification passes 47 web-admin tests, the
web-admin and POS production builds, and all three independent Compose
configuration checks. Docker runtime and staging API execution remain
environmental gates because the local Docker engine is unavailable.

Context selection through `usuarios/contextos` now records an append-only
`SELECCIONAR_CONTEXTO_EMPRESA` audit event, including the selected company,
actor, role and origin, while preserving the stateless `X-Empresa-ID` contract.

Added `deployments/verify-staging-safe.ps1`, a guarded staging runner that
rejects production-like DEBUG, SRI, database names and URLs before optional
integration tests or read-only fiscal audits. It is intentionally not run
locally because the Docker/PostgreSQL staging engine is unavailable.

The backend, frontend and staging PowerShell verifiers now check native
process exit codes explicitly. A failed TypeScript build, test, Python check
or Compose validation cannot be reported as a successful verification.

The backend staging Compose now accepts explicitly approved image overrides
while preserving PostgreSQL 16/Redis 7 defaults. The first staging launch was
attempted with Docker Desktop but stopped before creating containers because
Docker Hub returned an untrusted TLS certificate; no TLS bypass or unverified
image was introduced.

The staging runner also requires a non-empty `DATABASE_URL` and explicit
`STAGING_DATABASE_APPROVED=true`, adding a second confirmation layer before
integration tests can create their isolated test database.

PostgreSQL integration exposed and fixed a real transfer-lock defect:
`aprobar` now uses `select_for_update(of=('self',))` so nullable related users
are not included in the `FOR UPDATE` lock; stock rows remain locked separately.

The isolated PostgreSQL run then passed 79 Django tests (`OK`) across core,
companies, users, fiscalization, inventory, sales, Automation, signatures and
payments. The test run also validated the Automation localhost mock contract;
the temporary PostgreSQL container was stopped afterward and no staging
container remains running.

On a clean ephemeral PostgreSQL database all migrations applied successfully;
`audit_fiscal_context --fail-on-inconsistency` completed with zero records and
zero inconsistencies, and `audit_of1_tenant --ruc <RUC_PROPIO>` performed a
read-only lookup without creating data. The staging runner now requires that
RUC explicitly when fiscal auditing is requested.

POS offline synchronization now executes inside the serializer transaction,
returns business-rule failures such as insufficient stock as HTTP 400 instead
of 500, and preserves the invoice request when an SRI timeout occurs. A
temporary PostgreSQL run passed seven POS scenarios: creation, duplicate
reconnect, UUID conflict, closed cash opening, cross-company context,
insufficient stock rollback, and SRI timeout. The temporary database was
destroyed and the container stopped afterward.

Inventory integration now has five PostgreSQL scenarios covering kardex
receipt and projection reconciliation, idempotent retry and return signs,
transfer dispatch/physical receipt with duplicate-safe effects, insufficient
stock and cross-company references, and FEFO skipping expired lots. The suite
exposed and fixed the PostgreSQL nullable-join lock in transfer receipt.

Signature integration now covers public-origin request data flowing through a
manual transfer payment into exactly one ERP sale and one bank movement, with
an idempotent repeated confirmation, plus platform administration visibility.

Real ViewSet isolation tests now verify that an active-company context filters
list and CSV export, and rejects retrieve/update IDs from another company.
The company-structure permission was hardened so a legacy
`ADMIN_EMPRESA` must match the active company, while an explicit active
membership can grant administration of its own company only. Four PostgreSQL
tests cover those paths.

The guarded staging runner then passed 97 Django tests against a fresh
ephemeral PostgreSQL database, with no migration drift, system-check errors,
or production writes. The temporary test database was destroyed and its
container stopped after the run.

The published API now has a route-level permission contract test in
`apps/core/tests_endpoint_permissions.py`. It inventories every `/api/`
route, excludes only the explicitly documented public intake, validation,
authentication and health routes, and rejects an operational route whose
permission configuration is absent or `AllowAny` only. The contract passed
against the isolated PostgreSQL staging database; the existing endpoint-level
company and tenant tests remain the evidence for data-scope and write rules.

The three web targets were rebuilt independently (`facturaof1`, `of1-admin`,
and `firmador`) and served from separate temporary static roots while a
staging Django API exposed `/api/health/`. The new guarded
`deployments/verify-frontend-runtime-safe.ps1` check passed all three HTTP
artifacts and the API health endpoint. This proves artifact serving and API
reachability; authenticated browser E2E and durable rollback-artifact
retention remain release-promotion gates.

A read-only production audit found OF1 Solutions as Empresa `id=7`, RUC
`1793231594001`, active, in production environment, and with onboarding
completed. It currently has no persisted establishments or emission points,
its provider-RUC field is empty, and production lacks the current
`empresas_empresa.inventario_permite_stock_negativo` column. The production
schema also lacks the new memberships table observed in staging. No write was
performed; registration as a fully configured operating tenant and the
additive production migration remain pending controlled deployment.

The read-only migration ledger audit confirms production is behind the current
code: `empresas` stops at `0008`, `usuarios` at `0004`, `inventarios` at
`0004`, `facturacion` at `0007`, `ventas` at `0005`, `pagos` at `0003`, and
`automation` at `0004`. This explains the missing memberships, fiscal context,
inventory-policy and newer idempotency columns. The required action is an
approved additive migration window with backup and rollback evidence, not an
in-place model workaround.

Added `audit_runtime_schema`, a read-only management command that compares the
database migration ledger and live table/column metadata with the current
models. The production audit reported 18 unapplied migrations and 21 missing
tables/columns, including memberships, fiscal context, treasury closure,
inventory idempotency and Automation dispatch fields. The staging verifier now
executes it with `--fail-on-drift`; no migration or write is performed by the
command.

After adding the runtime-schema gate, the guarded staging runner passed 98
Django tests, zero migration drift, zero runtime schema drift and zero system
check errors on a fresh PostgreSQL database. The test database and temporary
container were destroyed afterward; production was not written.

Added `empresas.0011_backfill_provider_ruc`, an additive data migration that
fills only null/empty provider-RUC values with the canonical OF1 provider
`1793231594001`; its reverse is intentionally a no-op to avoid erasing a
legitimate explicit configuration. This will repair existing tenants such as
OF1 Solutions during the approved migration window while preserving the model
default for future records.

Added `deployments/retain-frontend-artifacts.ps1` to retain the three compiled
frontend targets in an approved release store without overwriting an existing
release. It writes a SHA-256 manifest for each file; a temporary staging run
created and validated a release successfully. The production release-store
location and retention policy still require operational approval before the
frontend rollback task can be checked off.

Added `deployments/verify-frontend-release.ps1`, a read-only SHA-256
verification gate for retained releases. A temporary release was retained and
verified successfully; the task remains open until an approved durable release
store is selected for the real cutover.

The provider-RUC migration was exercised against PostgreSQL by migrating to
`empresas.0010`, creating a tenant whose provider field was empty, applying
`0011`, and verifying the resulting value `1793231594001`. The temporary
database was stopped and discarded; no production data was changed.

Extended `audit_of1_tenant` with `--plan` and a schema-tolerant read-only lookup.
The production audit now reports the stored provider field accurately as empty
(with the canonical default shown separately), zero establishments, zero
emission points, a pending memberships schema, and legacy `001/001` codes.
This makes the required OF1 configuration visible without attempting any
write.

Added `production-cutover-checklist.md` with explicit preconditions, additive
migration sequence, OF1 tenant configuration steps, smoke tests, abort criteria
and rollback evidence. It is documentation only and does not authorize or
execute production changes.

Added `deployments/verify-production-readonly.ps1`, which was executed against
production with OF1 RUC `1793231594001`. It reported the same 19 unapplied
migrations and 21 schema differences, plus the OF1 configuration plan, and
completed without any migration, backfill or write.

The backend safe verifier was rerun after the audit-command changes: system
check, migration drift, compilation and all 48 database-free tests passed.

Reconciled the task ledger with the final guarded staging run: inventory,
multi-terminal POS/concurrency, active-company propagation, API permissions and
the three frontend artifact/runtime checks are now recorded as passed. Only
authenticated browser E2E, durable release-store selection and the controlled
production migration/tenant bootstrap remain promotion or operational gates.

The backend safe verifier remains green after the migration addition: system
check passed, migration generation reported no changes, Python compilation
passed, and 48 database-free tests passed. Database integration remains
covered by the separate guarded staging runner.

The independent frontend verifier was rerun after the release-documentation
changes: 47 web-admin tests passed, web-admin and POS production builds passed,
and all three independent Compose configurations passed. Docker emitted only
the existing local config-file access warning; no container or volume was
started, stopped or changed by this verification.

Documented the release-store contract in `deployments/release-store/README.md`
and excluded compiled releases from Git. The repository now provides the
retention and hash-verification scripts plus a clear durable-store contract;
the operational location itself is intentionally not invented or committed.

Web builds now emit `build-info.json` with the declared product target and API
URL. Release retention rejects a mismatched target, and release verification
checks the target plus every SHA-256 hash. The three targets were rebuilt and
the new release was retained and verified successfully after correcting a
PowerShell interpolation defect in the verifier.

The default workspace artifact was restored to `facturaof1` after the target
matrix test, and its `build-info.json` confirms the expected target. No
generated build directory is treated as the durable rollback store.

Implemented the first independent OF1 Solutions Console UX slice. The
`of1-admin` target now uses a dedicated `AdminLayout` and
`AdminDashboardPage`, with corporate navigation for organization, finance,
company operations, OF1 services and platform governance. FacturaOF1 keeps its
operational layout. The console selector uses the active-company context so a
platform administrator can switch from the global view to the selected
company ERP without mixing the two experiences. Frontend tests (47) and the
production build passed; Django system checks also passed.

The product route boundary was hardened across the three independent web
repositories. `facturaof1-web` owns ERP plus POS web, `of1-admin-web` owns the
corporate console plus OF1 Solutions ERP operations, and `facturaof1-firmador`
is restricted to signing and public validation flows. POS Electron remains in
`facturaof1-pos`; no POS web repository is created. TypeScript/Vite production
builds passed for all three artifacts. Vitest could not be completed in the
temporary containers because it remained without output, so those tests are
not recorded as passed.
