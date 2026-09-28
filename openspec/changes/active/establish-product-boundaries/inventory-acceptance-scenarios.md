# Escenarios de aceptación de inventario

Estos escenarios son la fuente de verificación para staging. No deben
ejecutarse contra producción ni sustituyen un respaldo y un plan de reversa.

## Recepción y valoración

1. Registrar una entrada de 10 unidades a costo 5.00: el stock queda en 10 y
   el costo promedio en 5.00.
2. Registrar 10 unidades a costo 7.00: el stock queda en 20 y el costo
   promedio queda en 6.00.
3. Registrar una salida de 5 unidades: el stock queda en 15 y el costo
   promedio no cambia.
4. Si la política de la empresa no permite negativo, una salida mayor al
   disponible se rechaza y no deja movimiento ni cambio de saldo.

## Transferencia

1. Aprobar una transferencia de 4 unidades: el origen disminuye en 4, el
   destino todavía no aumenta y queda estado `EN_TRANSITO`.
2. Recibirla: el destino aumenta en 4, el detalle registra la cantidad
   recibida y queda estado `RECIBIDA`.
3. Repetir aprobar o recibir: la operación se rechaza por estado y no crea
   movimientos adicionales.
4. Repetir la recepción de una transferencia histórica con referencia
   `Transferencia #<id>`: no se duplica la entrada.
5. Intentar cruzar empresas con bodega, producto o transferencia: la API
   responde rechazo y no crea movimientos.

## Venta y reintento

1. Completar una venta inventariable: se crea una salida por detalle y se
   actualiza stock una sola vez.
2. Repetir el registro de inventario de la misma venta: devuelve el estado
   idempotente y no duplica la salida.
3. Vender un producto con lotes: consume FEFO, excluye lotes vencidos y
   actualiza el saldo del lote.

## Reconciliación

Después de cada escenario, consultar `GET /api/inventarios/stock/reconciliacion`
y confirmar que no existan diferencias entre el saldo material y la suma del
kardex. Toda diferencia histórica debe investigarse antes de corregirse.
## Devoluciones y ajustes

1. Registrar `DEVOLUCION_ENTRADA` con cantidad positiva: el stock aumenta y
   la repetición de la misma clave de idempotencia no duplica el movimiento.
2. Registrar `DEVOLUCION_SALIDA` con cantidad negativa: el stock disminuye y
   se aplica la política de stock negativo de la empresa.
3. Intentar cantidad cero o un signo contrario al tipo: la API rechaza la
   operación sin crear movimiento.
