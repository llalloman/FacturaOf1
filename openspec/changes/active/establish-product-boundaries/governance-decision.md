# Decisión de gobierno: límites de producto y fuentes de verdad

Estado: aprobada para implementación incremental en septiembre de 2026.

## Productos

- **FacturaOF1**: operación ERP de cada empresa: facturación electrónica,
  ventas, POS, inventario, compras, cartera, bancos, nómina, contabilidad y
  tesorería.
- **OF1 Solutions Admin**: administración de la plataforma, empresas,
  membresías, suscripciones, módulos, permisos, soporte y auditoría global.
- **Firmador**: producto de firma y validación documental, consumiendo los
  servicios centrales de identidad y API.
- **Automation**: integración externa independiente, con contrato versionado,
  autenticación de servicio, idempotencia, reintentos y dead-letter.

Cada frontend se construye y despliega como artefacto Docker independiente.
Los productos pueden consumir el mismo backend, pero no comparten cookies,
tokens ni contexto administrativo implícito.

## Fuentes de verdad

- La API y su base de datos son la fuente de verdad de empresas, membresías,
  permisos, comprobantes, pagos, inventario y efectos financieros.
- El contexto activo se identifica por `X-Empresa-ID`; el backend valida
  membresía, alcance de plataforma y empresa activa.
- `Establecimiento` y `PuntoEmision` son la fuente de verdad fiscal para la
  secuencia, XML, RIDE y documentos relacionados.
- `MovimientoInventario` es el kardex append-only. `StockProducto` y el saldo
  de lotes son proyecciones derivadas.
- Tesorería coordina cierres, bancos, cobros, pagos y conciliación, pero no
  reemplaza los puntos de emisión fiscal ni el kardex.

## Compatibilidad y despliegue

Los campos fiscales nuevos son nullable o tienen fallback compatible; ninguna
migración se aplica a producción desde este cambio. Toda migración,
regularización histórica, registro de OF1 Solutions y activación de
integraciones externas exige una copia de staging, respaldo, conteos antes y
después, y un plan de reversa.
