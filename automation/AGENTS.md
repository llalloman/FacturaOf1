# Automation Agent Notes

## Objetivo

Mantener la automatización como una capa separada del ERP principal. Los workflows deben consumir APIs públicas o autenticadas de FacturaOF1, no acceder directamente a la base de datos.

## Reglas

- No commitear `.env`, sesiones de WhatsApp ni tokens.
- Documentar cada workflow en `docs/workflows.md`.
- Exportar workflows n8n en `n8n/workflows/`.
- Tratar documentos de identidad y archivos de firma como datos sensibles.
- No exponer URLs públicas directas para documentos.

## Convenciones

- Nombre de workflow: `domain.action.version`, por ejemplo `signature.lead-intake.v1`.
- Webhooks públicos deben validar payload mínimo y origen cuando sea posible.
- Mensajes automáticos deben dejar claro que un asesor continuará el proceso.
