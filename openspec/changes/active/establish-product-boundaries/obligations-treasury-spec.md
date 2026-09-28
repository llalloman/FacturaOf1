# Especificación: obligaciones operativas y fondos

## Alcance

Las obligaciones de una escuela, colegio, liga barrial, club, asociación o
empresa no se modelan como facturas ni como declaraciones tributarias. Son
compromisos operativos que pueden generar una cuenta por cobrar, una cuota,
una beca, una donación o un fondo, y que posteriormente pueden cobrarse y
conciliarse en Tesorería.

## Fuente de verdad

- `ObligationDefinition`: empresa, tipo (`MENSUALIDAD`, `CUOTA`, `EVENTO`,
  `DONACION`, `PATROCINIO`, `OTRA`), nombre, periodicidad, moneda, reglas de
  vencimiento, activo y auditoría.
- `ObligationSubject`: tercero o miembro obligado, relación con la empresa,
  estado y datos de contacto. No duplica al cliente; referencia el agregado
  existente cuando corresponda.
- `ObligationInstance`: período/evento, importe original, descuentos, becas,
  recargos, saldo, estado y referencia a la empresa. Es inmutable en sus
  importes una vez publicada; los ajustes generan eventos auditados.
- `Fund`: fondo separado por empresa y finalidad (`OPERATIVO`, `SOCIAL`,
  `DEPORTE`, `PROYECTO`, `OTRO`), con movimientos de entrada, salida,
  transferencia y conciliación.

## Reglas de integración

1. Cada registro lleva `empresa_id`; el contexto activo limita lectura y
   escritura igual que el resto del ERP.
2. La obligación puede originar una cuenta de cartera, pero cartera es la
   fuente de verdad del saldo exigible una vez generado el cargo.
3. El pago se registra una sola vez en Tesorería y se aplica a la obligación
   mediante una clave idempotente; no se modifica manualmente el saldo para
   ocultar diferencias.
4. Una factura electrónica es un documento fiscal derivado, no reemplaza la
   obligación ni el fondo.
5. Las anulaciones, becas, descuentos y devoluciones son ajustes con usuario,
   motivo, fecha y referencia; nunca se eliminan movimientos históricos.
6. La consolidación de fondos se calcula por empresa y período, separada de
   cajas de POS y puntos de emisión fiscal.

## Fases

- Fase 1: catálogo y generación de obligaciones, sin afectar facturación
  existente.
- Fase 2: integración con cartera, pagos y cierres de Tesorería.
- Fase 3: reportes por período, fondo, establecimiento y actividad.

La implementación debe iniciar con migraciones aditivas y pruebas de
aislamiento multiempresa; no se habilita en producción por defecto.
