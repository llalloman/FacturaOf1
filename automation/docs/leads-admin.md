# Administración de leads

La pantalla `Leads WhatsApp` está disponible solo para usuarios `SUPER_ADMIN` dentro del panel de FacturaOF1.

## Backend

Endpoints protegidos con JWT:

- `GET /api/automation/admin/leads/`: listado paginado.
- `GET /api/automation/admin/leads/{id}/`: detalle del lead.
- `PATCH /api/automation/admin/leads/{id}/`: actualiza `status`, `priority`, `assigned_to` e `internal_notes`.
- `GET /api/automation/admin/leads/stats/`: indicadores del tablero.

Filtros soportados:

- `search`: texto libre sobre teléfono, identificadores técnicos, nombre, empresa, correo, resumen, categoría e intención.
- `status`: estado del lead.
- `priority`: prioridad.
- `interest_type`: tipo de interés del lead.
- `category`: categoría detectada por IA o tipo de interés.
- `source_channel`: canal de origen.
- `is_lid`: `true` o `false`.
- `requires_human`: `true` o `false`.
- `date_from` / `date_to`: rango por fecha de creación o última interacción.
- `ordering`: `last_interaction_at`, `created_at`, `updated_at`, `priority`, `status`.

## Estados

Estados disponibles:

- `new`
- `bot_responded`
- `requires_human`
- `in_follow_up`
- `contacted`
- `qualified`
- `proposal_sent`
- `converted`
- `lost`
- `closed`

## Categorías

Categorías disponibles:

- `signature`
- `erp`
- `invoicing`
- `custom_software`
- `automation_ai`
- `chatbot`
- `integration`
- `support`
- `payment`
- `documents`
- `human`
- `unknown`

## Reglas de identidad WhatsApp

- `@lid` no se muestra como teléfono real.
- Si `phone` está vacío o contiene un JID, la pantalla muestra `Teléfono no disponible`.
- `contact_key`, `reply_to_jid`, `from_jid` y `remote_jid` se muestran como campos técnicos y no son editables desde UI.
- Para responder desde automation/n8n se debe usar `reply_to_jid` cuando no exista teléfono real.

## Auditoría

Cada cambio realizado desde la pantalla sobre `status`, `priority`, `assigned_to`, `summary` o `internal_notes` genera un registro en `automation_audit_logs` con:

- usuario actor,
- entidad afectada,
- campos modificados,
- valor anterior y nuevo valor.
