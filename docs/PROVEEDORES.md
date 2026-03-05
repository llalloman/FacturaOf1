# Módulo de Proveedores y Compras

Sistema completo de gestión de proveedores, órdenes de compra, recepciones y cuentas por pagar integrado con el módulo de inventarios.

## Características

### 🏪 Gestión de Proveedores
- Registro completo de proveedores (RUC, cédula, pasaporte)
- Datos de contacto y comerciales
- Configuración de días de crédito
- Límite de crédito
- Cuenta contable para cuentas por pagar
- Estadísticas por proveedor (compras, deuda, facturas vencidas)

### 📋 Órdenes de Compra
- Creación de órdenes con múltiples productos
- Estados: BORRADOR, ENVIADA, PARCIAL, RECIBIDA, CANCELADA
- Cálculo automático de subtotales, IVA y totales
- Seguimiento de cantidades ordenadas vs recibidas
- Bodega de destino configurable
- Fecha de entrega esperada

### 📦 Recepciones de Compra
- Recepción parcial o completa de órdenes
- Validación automática de cantidades (no permite recibir más de lo ordenado)
- Confirmación de recepción actualiza inventario automáticamente
- Referencia a factura del proveedor
- Genera cuenta por pagar automáticamente al confirmar

### 💰 Cuentas por Pagar
- Generación automática desde recepciones confirmadas
- Cálculo de días de crédito según configuración del proveedor
- Estados: PENDIENTE, PARCIAL, PAGADA, ANULADA
- Consulta de cuentas vencidas
- Consulta de cuentas por vencer
- Resumen de deuda total

### 💳 Pagos a Proveedores
- Registro de pagos con múltiples formas de pago:
  - Efectivo
  - Cheque
  - Transferencia
  - Tarjeta de crédito
  - Nota de crédito
- Actualización automática de saldo de cuentas por pagar
- Cambio de estado automático (PENDIENTE → PARCIAL → PAGADA)
- Validación: no permite pagos mayores al saldo
- Histórico de pagos por proveedor

## Modelos

### Proveedor
```python
- tipo_identificacion (RUC, CEDULA, PASAPORTE)
- identificacion
- razon_social
- nombre_comercial
- direccion, telefono, celular, email
- contacto_principal
- dias_credito
- limite_credito
- cuenta_contable
- activo
```

### OrdenCompra
```python
- uuid (para sincronización)
- proveedor
- bodega_destino
- numero_orden (auto-generado)
- fecha_orden
- fecha_entrega_esperada
- estado (BORRADOR, ENVIADA, PARCIAL, RECIBIDA, CANCELADA)
- subtotal, descuento, iva, total
- detalles (DetalleOrdenCompra)
```

### DetalleOrdenCompra
```python
- orden_compra
- producto
- cantidad
- cantidad_recibida (auto-actualizada)
- precio_unitario
- descuento
- aplica_iva, porcentaje_iva
- subtotal, iva, total (auto-calculados)
```

### RecepcionCompra
```python
- uuid
- orden_compra
- bodega
- numero_recepcion (auto-generado)
- fecha_recepcion
- estado (BORRADOR, RECIBIDA, CANCELADA)
- numero_factura_proveedor
- fecha_factura_proveedor
- detalles (DetalleRecepcion)
```

### DetalleRecepcion
```python
- recepcion
- detalle_orden
- cantidad_recibida
- costo_unitario
```

### CuentaPorPagar
```python
- uuid
- proveedor
- recepcion (opcional)
- numero_cuenta (auto-generado)
- fecha_emision
- fecha_vencimiento
- monto_total
- monto_pagado (auto-actualizado)
- saldo (auto-calculado)
- estado (PENDIENTE, PARCIAL, PAGADA, ANULADA)
```

### PagoProveedor
```python
- uuid
- proveedor
- cuenta_por_pagar
- numero_pago (auto-generado)
- fecha_pago
- forma_pago (EFECTIVO, CHEQUE, TRANSFERENCIA, TARJETA, NOTA_CREDITO)
- monto
- numero_documento (cheque, transferencia, etc.)
- banco
```

## API Endpoints

### Proveedores
```
GET    /api/proveedores/proveedores/              # Listar
POST   /api/proveedores/proveedores/              # Crear
GET    /api/proveedores/proveedores/{id}/         # Detalle
PUT    /api/proveedores/proveedores/{id}/         # Actualizar
DELETE /api/proveedores/proveedores/{id}/         # Eliminar
GET    /api/proveedores/proveedores/{id}/estadisticas/  # Estadísticas
```

### Órdenes de Compra
```
GET    /api/proveedores/ordenes/                  # Listar
POST   /api/proveedores/ordenes/                  # Crear
GET    /api/proveedores/ordenes/{id}/             # Detalle
PUT    /api/proveedores/ordenes/{id}/             # Actualizar
DELETE /api/proveedores/ordenes/{id}/             # Eliminar
POST   /api/proveedores/ordenes/{id}/enviar/      # Enviar al proveedor
POST   /api/proveedores/ordenes/{id}/cancelar/    # Cancelar
GET    /api/proveedores/ordenes/pendientes/       # Órdenes pendientes
```

### Recepciones de Compra
```
GET    /api/proveedores/recepciones/              # Listar
POST   /api/proveedores/recepciones/              # Crear
GET    /api/proveedores/recepciones/{id}/         # Detalle
POST   /api/proveedores/recepciones/{id}/confirmar/  # Confirmar (actualiza inventario)
POST   /api/proveedores/recepciones/{id}/cancelar/   # Cancelar
```

### Cuentas por Pagar
```
GET    /api/proveedores/cuentas-por-pagar/        # Listar
POST   /api/proveedores/cuentas-por-pagar/        # Crear
GET    /api/proveedores/cuentas-por-pagar/{id}/   # Detalle
GET    /api/proveedores/cuentas-por-pagar/vencidas/      # Cuentas vencidas
GET    /api/proveedores/cuentas-por-pagar/por_vencer/    # Por vencer (7 días)
GET    /api/proveedores/cuentas-por-pagar/resumen/       # Resumen general
```

### Pagos a Proveedores
```
GET    /api/proveedores/pagos/                    # Listar
POST   /api/proveedores/pagos/                    # Registrar pago
GET    /api/proveedores/pagos/{id}/               # Detalle
GET    /api/proveedores/pagos/por_proveedor/?proveedor_id={id}  # Por proveedor
```

## Flujo de Trabajo

### 1. Crear Orden de Compra
```bash
POST /api/proveedores/ordenes/
{
  "proveedor": 1,
  "bodega_destino": 1,
  "fecha_orden": "2026-01-29",
  "fecha_entrega_esperada": "2026-02-05",
  "detalles": [
    {
      "producto": 1,
      "cantidad": "50.00",
      "precio_unitario": "25.50",
      "aplica_iva": true,
      "porcentaje_iva": "15.00"
    }
  ]
}

# Respuesta incluye numero_orden auto-generado
# Estado inicial: BORRADOR
```

### 2. Enviar Orden al Proveedor
```bash
POST /api/proveedores/ordenes/{id}/enviar/

# Cambia estado a ENVIADA
```

### 3. Crear Recepción de Compra
```bash
POST /api/proveedores/recepciones/
{
  "orden_compra": 1,
  "bodega": 1,
  "fecha_recepcion": "2026-02-03",
  "numero_factura_proveedor": "FAC-001-002-0000123",
  "fecha_factura_proveedor": "2026-02-03",
  "detalles": [
    {
      "detalle_orden": 1,
      "cantidad_recibida": "50.00",
      "costo_unitario": "25.50"
    }
  ]
}

# Respuesta incluye numero_recepcion auto-generado
# Estado inicial: BORRADOR
```

### 4. Confirmar Recepción
```bash
POST /api/proveedores/recepciones/{id}/confirmar/

# Acciones automáticas:
# 1. Actualiza cantidad_recibida en DetalleOrdenCompra
# 2. Crea MovimientoInventario tipo ENTRADA_COMPRA
# 3. Actualiza StockProducto en la bodega
# 4. Actualiza estado de OrdenCompra (PARCIAL o RECIBIDA)
# 5. Genera CuentaPorPagar automáticamente
# 6. Calcula fecha_vencimiento según dias_credito del proveedor
```

### 5. Registrar Pago
```bash
POST /api/proveedores/pagos/
{
  "proveedor": 1,
  "cuenta_por_pagar": 1,
  "fecha_pago": "2026-02-15",
  "forma_pago": "TRANSFERENCIA",
  "monto": "1467.75",
  "numero_documento": "TRANS-2026-0123",
  "banco": "Banco Pichincha"
}

# Actualiza automáticamente:
# - monto_pagado en CuentaPorPagar
# - saldo en CuentaPorPagar
# - estado de CuentaPorPagar (PENDIENTE → PARCIAL → PAGADA)
```

## Integración con Inventarios

Las recepciones confirmadas crean automáticamente:

### MovimientoInventario
```python
tipo_movimiento = 'ENTRADA_COMPRA'
cantidad = cantidad_recibida
costo_unitario = costo de la recepción
referencia = "Recepción RC-{numero}"
notas = "OC: {numero_orden}"
```

### Actualización de StockProducto
- Incrementa cantidad en bodega
- Actualiza costo_promedio ponderado
- Mantiene trazabilidad completa

## Permisos por Rol

### Proveedores
- **Lectura**: Todos los roles
- **Escritura**: SUPER_ADMIN, ADMIN_EMPRESA, CONTADOR

### Órdenes de Compra
- **Lectura**: Todos los roles
- **Escritura**: SUPER_ADMIN, ADMIN_EMPRESA, CONTADOR

### Recepciones
- **Lectura**: Todos los roles
- **Escritura**: SUPER_ADMIN, ADMIN_EMPRESA, CONTADOR, VENDEDOR

### Cuentas por Pagar y Pagos
- **Lectura**: Todos los roles
- **Escritura**: SUPER_ADMIN, ADMIN_EMPRESA, CONTADOR

## Signals Implementados

### post_save(DetalleOrdenCompra)
- Recalcula totales de la orden automáticamente

### post_save(PagoProveedor)
- Actualiza monto_pagado y saldo de CuentaPorPagar
- Cambia estado de cuenta automáticamente

### post_delete(PagoProveedor)
- Revierte monto pagado si se elimina un pago

## Reportes y Consultas

### Estadísticas de Proveedor
```bash
GET /api/proveedores/proveedores/{id}/estadisticas/

Response:
{
  "total_ordenes": 15,
  "ordenes_pendientes": 3,
  "total_compras": 45678.90,
  "total_deuda": 12345.67,
  "facturas_vencidas": 2
}
```

### Resumen de Cuentas por Pagar
```bash
GET /api/proveedores/cuentas-por-pagar/resumen/

Response:
{
  "total_deuda": 25890.45,
  "cuentas_pendientes": 12,
  "cuentas_vencidas": 3,
  "total_vencido": 5678.90,
  "por_vencer_7dias": 2
}
```

### Pagos por Proveedor
```bash
GET /api/proveedores/pagos/por_proveedor/?proveedor_id=1

Response:
{
  "total_pagado": 67890.12,
  "cantidad_pagos": 24,
  "pagos": [...]
}
```

## Transaccionalidad

Todas las operaciones críticas usan `@transaction.atomic`:
- Creación de órdenes con detalles
- Confirmación de recepciones (inventario + cuentas)
- Registro de pagos
- Cancelaciones

## Validaciones

- ✅ No se puede recibir más cantidad de la ordenada
- ✅ No se puede pagar más del saldo de una cuenta
- ✅ No se puede cancelar una orden ya recibida
- ✅ No se puede confirmar una recepción ya confirmada
- ✅ Fecha de vencimiento calculada automáticamente
- ✅ Numeración secuencial automática (ordenes, recepciones, cuentas, pagos)

## Testing

Suite completa de tests en `apps/proveedores/tests.py`:
- Tests de API para cada endpoint
- Tests de flujo completo (orden → recepción → pago)
- Tests de validaciones
- Tests de integración con inventarios
- Tests de actualización de estados

Ejecutar tests:
```bash
pytest apps/proveedores/tests.py -v
```

## Próximas Mejoras

- [ ] Reportes PDF de órdenes de compra
- [ ] Notificaciones de vencimiento de cuentas
- [ ] Integración con contabilidad
- [ ] Comparación de precios entre proveedores
- [ ] Análisis de rotación de inventario por proveedor
- [ ] Dashboard de compras con gráficos
- [ ] Exportación a Excel de reportes

---

**Módulo completamente funcional y listo para producción** ✅
