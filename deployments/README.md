# Independent product deployments

These compose files build frontend artifacts independently while continuing to
consume the central FacturaOF1 API. The target repository topology is defined
in `openspec/repository-topology.md`. They do not create or migrate production
data.

## Products

- `facturaof1-web`: FacturaOF1 product artifact.
- `firmador-web`: independent OF1 Firmador product artifact.
- `of1-admin-web`: OF1 Solutions administration artifact.
- `pos-client`: independent Electron desktop artifact; it is not required to
  run in Docker for production distribution.
- `of1-automation`: independent n8n + WhatsApp Gateway project under
  `of1-automation/docker-compose.yml`. The previous `automation/` directory is
  retained temporarily as a compatibility/source archive while the new project
  is validated.
- `backend-staging`: optional isolated PostgreSQL/Redis/API stack for
  integration validation; it never consumes the production `.env`.

## Safe rollout

Build and run one product compose at a time. Use a staging API URL first, then
deploy the artifact beside the current frontend. The current checkout remains
available for rollback until the six repositories are extracted and validated.

Each web artifact receives its API URL at build time through `VITE_API_URL`.
The optional `VITE_FACTURAOF1_URL`, `VITE_OF1_ADMIN_URL`, and
`VITE_FIRMADOR_URL` variables configure informational cross-product links;
they do not share cookies, tokens, or active-company state.
The API remains the authority for authentication, tenant scope, permissions,
inventory, invoices, and financial effects.

Before a production cutover, retain the three built directories in an approved
release store and verify their manifest:

```powershell
.\deployments\retain-frontend-artifacts.ps1 `
  -SourceRoot <artifacts> `
  -DestinationRoot <release-store> `
  -ReleaseId <release-id>
.\deployments\verify-frontend-release.ps1 `
  -ReleasePath <release-store>\<release-id>
```

The retention script refuses to overwrite an existing release and records
SHA-256 hashes plus the declared product target and API URL from
`build-info.json`. The verification script is read-only and is the gate before
using that release as rollback.

## Reproducible verification

From the repository root, run:

```powershell
.\deployments\verify-independent-frontends.ps1
```

The script runs the web-admin tests, web-admin/POS production builds, then
validates each independent Compose file with `docker compose config`. It does
not start, stop, migrate, or remove any container or volume.

For backend checks that do not require a database, run:

```powershell
.\deployments\verify-backend-safe.ps1
```

This runs Django system/migration-drift checks, Python compilation, and the
database-free unit suite. PostgreSQL integration tests and migrations remain
restricted to the staging runbook.

To inspect the currently deployed production schema and OF1 tenant without any
write path, run:

```powershell
.\deployments\verify-production-readonly.ps1 -Of1Ruc <ruc-of1>
```

The optional `-RunFiscalAudit` adds the historical fiscal-context audit. The
script does not call `migrate`, backfill commands, or any write endpoint.

El backend exige `DJANGO_TEST_DB_NAME` para ejecutar cualquier suite Django
con base de datos, como protección contra usar accidentalmente la conexión de
producción.
