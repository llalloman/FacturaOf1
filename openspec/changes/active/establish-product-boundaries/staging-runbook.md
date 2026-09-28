# Runbook de staging seguro

La auditoria fiscal admite `--fail-on-inconsistency` como puerta automatizada;
antes de un backfill puede agregarse `--fail-on-legacy` para bloquear mientras
existan comprobantes historicos sin referencia fiscal nueva.

Este procedimiento valida la migración sin modificar producción. La base de
staging debe ser una copia controlada y separada, con credenciales y URLs de
prueba; no se deben usar `down -v`, `migrate reset` ni `db push`.

## Secuencia

Para automatizar las comprobaciones sin reutilizar credenciales productivas,
exportar las variables de staging y ejecutar
`deployments/verify-staging-safe.ps1`. El runner exige `DEBUG=True`,
`SRI_AMBIENTE=PRUEBAS`, un `DJANGO_TEST_DB_NAME` temporal y rechaza URLs o
nombres que parezcan productivos. Sin switches solo ejecuta comprobaciones
estáticas; agregar `-RunIntegrationTests` y/o `-RunFiscalAudit` únicamente
contra la base de staging preparada.

Antes de ejecutar el runner se debe definir también
`STAGING_DATABASE_APPROVED=true` como confirmación explícita de que
`DATABASE_URL` apunta a staging.

Si se usa `-RunFiscalAudit`, agregar también `-Of1Ruc <RUC_PROPIO_OF1>`; el
comando nunca infiere ni reutiliza `1793231594001`, que pertenece al proveedor
de facturación.

El Compose permite fijar imágenes previamente aprobadas mediante
`STAGING_POSTGRES_IMAGE` y `STAGING_REDIS_IMAGE`; si no se definen conserva
`postgres:16-alpine` y `redis:7-alpine`. No se debe desactivar TLS ni sustituir
imágenes por fuentes no verificadas para resolver una descarga fallida.

La creaciÃ³n controlada de OF1 Solutions mediante `audit_of1_tenant --apply`
solo estÃ¡ permitida con `DEBUG=True` y `SRI_AMBIENTE=PRUEBAS`; el comando
rechaza cualquier otro entorno para evitar escrituras accidentales en
producciÃ³n.

1. Respaldar la base de staging y registrar conteos de `Empresa`, `Usuario`,
   `ComprobanteElectronico`, `Factura`, `Venta`, `MovimientoInventario` y
   `AutomationWebhookEvent`.
2. Ejecutar `venv/Scripts/python.exe manage.py check` y
   `venv/Scripts/python.exe manage.py makemigrations --check --dry-run`.
3. Ejecutar `venv/Scripts/python.exe manage.py migrate --plan`; revisar que
   solo aparezcan migraciones esperadas y luego aplicar con
   `migrate --noinput` únicamente sobre staging.
4. Repetir los conteos y validar que las referencias fiscales nuevas sean
   nulas para históricos, que no cambien números existentes y que las
   secuencias estén aisladas por empresa, tipo, establecimiento y punto.
   Ejecutar también `python manage.py audit_fiscal_context --limit 50` y
   revisar sus inconsistencias antes de cualquier backfill.
   Ejecutar `python manage.py audit_of1_tenant` para comprobar si OF1 Solutions
   ya existe como `Empresa`; `--plan` agrega un diagnóstico read-only de
   establecimientos, puntos, membresías y códigos legacy. Este comando es de
   solo lectura.
   Para inicializarla en staging, usar el RUC propio de la empresa y datos
   reales aprobados: `python manage.py audit_of1_tenant --apply --ruc
   <RUC_PROPIO_OF1> --direccion "<direccion>" --telefono "<telefono>"
   --email "<email>" --bootstrap-erp --user-email "<usuario_existente>"`.
   `1793231594001` sigue siendo el RUC del proveedor de facturacion y no debe
   reutilizarse como RUC de OF1 Solutions salvo que legalmente sean la misma
   entidad.
5. Ejecutar las pruebas Django de permisos, contexto, descuentos, inventario,
   pagos y Automation. Si el runner encuentra una base de test preexistente,
   detenerse y crear una base temporal administrada por staging; nunca borrar
   la base encontrada. Configurar `DJANGO_TEST_DB_NAME` con un nombre único de
   staging antes de ejecutar el runner.
6. Ejecutar `python manage.py dispatch_automation_events --limit 20` en modo
   inspección. Para el contrato HTTP usar un consumidor mock y habilitar
   `--send` solo con `AUTOMATION_DISPATCH_URL` de staging.
7. Construir cada artefacto por separado: `web-admin`, `pos-client` y los
   compose de `deployments/facturaof1-web`, `deployments/of1-admin-web`,
   `deployments/firmador-web` y `automation`.
   Antes del corte, conservar los tres directorios compilados en el almacén
   aprobado usando `deployments/retain-frontend-artifacts.ps1 -SourceRoot
   <artifacts> -DestinationRoot <release-store> -ReleaseId <release-id>`.
   El script no sobrescribe releases existentes y genera `manifest.json` con
   hashes SHA-256 para rollback.
8. Ejecutar flujos manuales: cambio de empresa, emisión por dos puntos,
   descuento de firma, recepción/salida/transferencia/devolución, cierre de
   tesorería, venta POS offline/reintento y firma pública → pago → venta →
   factura.

## Criterio de promoción

Promover solo si los conteos históricos coinciden, los casos cross-company
devuelven 403/404 según contrato, el total fiscal coincide con el cobrado y
los artefactos anteriores están conservados como rollback. Las migraciones de
este cambio no se ejecutan automáticamente desde Docker.
