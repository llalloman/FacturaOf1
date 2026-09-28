# Checklist de corte productivo

Este documento es una guía operativa. No autoriza por sí mismo cambios en
producción y no debe ejecutarse desde Docker automáticamente.

## Precondiciones

- [ ] Ventana y responsable aprobados.
- [ ] Backup verificable de la base y prueba de restauración registrada.
- [ ] Release frontend nuevo y release anterior retenidos en el almacén
      oficial; ambos manifests pasan `verify-frontend-release.ps1`.
- [ ] `verify-production-readonly.ps1 -Of1Ruc <RUC>` ejecutado y archivado.
- [ ] No existen procesos de facturación, POS o Automation críticos en vuelo.
- [ ] Se conoce el usuario existente que recibirá la membresía administrativa.
- [ ] Dirección matriz, teléfono, correo y códigos fiscales fueron aprobados.

## Secuencia controlada

1. Ejecutar nuevamente la auditoría read-only y guardar su salida.
2. Revisar `migrate --plan`; deben aparecer únicamente migraciones de este
   cambio. No usar `db push`, `migrate reset` ni eliminar volúmenes.
3. Aplicar `migrate --noinput` solamente en la base productiva aprobada,
   desde el release de backend validado y con monitoreo activo.
4. Ejecutar `audit_runtime_schema --fail-on-drift` y
   `audit_fiscal_context --fail-on-inconsistency`.
5. Verificar que `empresas.0011_backfill_provider_ruc` se aplicó; solo llena
   valores nulos o vacíos y no reemplaza configuraciones explícitas.
6. Registrar o validar OF1 Solutions como tenant operativo usando sus datos
   legales aprobados. Crear el establecimiento matriz, puntos de emisión,
   secuenciales, bodegas, cajas, cuentas bancarias y membresías solo con datos
   confirmados; no inferirlos del RUC proveedor.
7. Ejecutar smoke tests autenticados: cambio de empresa, emisión por dos
   puntos, venta, inventario, cierre de tesorería, POS offline/reintento,
   Automation idempotente y firma pública a pago/venta.
8. Publicar los frontends independientes de forma gradual, manteniendo el
   release anterior disponible.

## Criterios de abortar

Abortar y restaurar el release anterior si aparece cualquier error de
migración, drift posterior, inconsistencia fiscal, pérdida de contexto de
empresa, duplicidad de efectos POS/Automation, diferencia de totales o fallo
de emisión.

## Evidencia de cierre

Guardar: identificador de ventana, backup, plan de migración, salida de las
auditorías, hashes de releases, conteos antes/después, resultados de smoke
tests y decisión de promoción/rollback.
