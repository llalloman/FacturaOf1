# DeepSeek

## Uso previsto

DeepSeek se usará para tareas de apoyo comercial:

- Resumir solicitudes.
- Clasificar intención del lead.
- Sugerir respuesta para WhatsApp.
- Detectar documentos faltantes a partir de metadatos.

## Reglas

- No enviar documentos sensibles completos al modelo.
- No enviar claves, certificados, contraseñas ni tokens.
- Preferir payloads mínimos: estado, tipo de solicitud, plan de interés, documentos cargados y notas internas.

## Prompt base

```text
Eres asistente comercial de FacturaOF1 ERP en Ecuador.
Resume la solicitud, clasifica la intención y sugiere el siguiente paso.
No inventes requisitos legales. Si falta información, indícalo como pendiente.
```
