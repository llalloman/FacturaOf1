# Rollout Seguro (Sin Impactar Produccion)

Este documento define como desplegar la nueva base de control (`apps.core`) sin afectar el comportamiento actual.

## 1) Estado actual

- Se agregaron modelos nuevos en `apps/core`.
- Se agrego migracion `apps/core/migrations/0001_initial.py`.
- Se agregaron feature flags en `config/settings.py`.
- Todos los flags estan en `False` por defecto.
- No se tocaron endpoints existentes ni logica actual de facturacion/POS.

## 2) Flags disponibles

Variables de entorno (todas opcionales, default `False`):

- `CONTROL_POLICY_ENGINE_ENABLED`
- `CONTROL_WORKFLOW_ENGINE_ENABLED`
- `CONTROL_AUDIT_ENGINE_ENABLED`
- `CONTROL_ALERT_ENGINE_ENABLED`
- `CONTROL_SRI_ENGINE_ENABLED`

## 3) Despliegue recomendado por fases

1. Deploy de codigo con todos los flags en `False`.
2. Ejecutar solo migraciones de `core`:
   - `python manage.py migrate core 0001`
3. Smoke test de negocio actual (POS, facturacion, login, reportes).
4. Activar 1 flag en ambiente `staging`.
5. Validar 24 horas.
6. Activar 1 flag en produccion en ventana controlada.

## 4) Comandos operativos

```bash
# Validacion general
python manage.py check

# Migrar solo core (evita tocar migraciones pendientes de otros apps)
python manage.py migrate core 0001

# Ver estado de migraciones de core
python manage.py showmigrations core
```

## 5) Politica de rollback

- Si hay comportamiento inesperado:
  1. Volver flags a `False`.
  2. Reiniciar app.
  3. Revisar logs.
- Como no hay rutas activas nuevas, el rollback funcional es inmediato al apagar flags.

## 6) Nota importante

Actualmente existen migraciones pendientes en otros apps (`empresas`, `productos`) que no forman parte de esta entrega. Para mantener estabilidad en produccion, no ejecutar `migrate` global hasta planificar esas diferencias.
