# Guía de Transaccionalidad y Concurrencia

## 🔒 Mejoras Implementadas

### 1. **Transacciones Atómicas (@transaction.atomic)**

Todas las operaciones críticas ahora usan `@transaction.atomic`:

```python
@transaction.atomic
def operacion_critica():
    # Si cualquier operación falla, TODO se revierte
    crear_venta()
    actualizar_stock()
    crear_factura()
    # Si algo falla aquí, TODO lo anterior se deshace
```

#### Aplicado en:
- ✅ Creación de ventas con detalles y pagos
- ✅ Sincronización de ventas desde POS offline
- ✅ Anulación de ventas (revierte inventario)
- ✅ Aprobación de transferencias
- ✅ Cierre de caja
- ✅ Signals de actualización de inventario

### 2. **Locks Optimistas (select_for_update)**

Para evitar **race conditions** en operaciones concurrentes:

```python
# ANTES (❌ Peligro de race condition)
stock = StockProducto.objects.get(producto=producto)
stock.cantidad_actual -= cantidad
stock.save()

# DESPUÉS (✅ Lock seguro)
stock = StockProducto.objects.select_for_update().get(producto=producto)
stock.cantidad_actual -= cantidad
stock.save()
```

#### Aplicado en:
- ✅ Actualización de stock en ventas
- ✅ Transferencias entre bodegas
- ✅ Movimientos de inventario
- ✅ Signals de actualización

### 3. **Validación de Stock ANTES de Operaciones**

```python
@transaction.atomic
def aprobar_transferencia():
    # 1. LOCK y VERIFICAR stock disponible
    for detalle in detalles:
        stock = StockProducto.objects.select_for_update().get(...)
        
        if stock.cantidad_actual < detalle.cantidad:
            raise ValueError('Stock insuficiente')
    
    # 2. Si todo OK, proceder
    crear_movimientos()
```

### 4. **Manejo de Errores Robusto**

```python
try:
    with transaction.atomic():
        operacion_critica()
except ValueError as e:
    # Error de negocio (ej: stock insuficiente)
    return Response({'error': str(e)}, status=400)
except Exception as e:
    # Error inesperado
    logger.error(f'Error: {str(e)}')
    return Response({'error': 'Error en transacción'}, status=500)
```

## 🎯 Niveles de Aislamiento

### PostgreSQL por Defecto: READ COMMITTED

```python
# Para operaciones que necesitan mayor aislamiento:
from django.db import transaction

with transaction.atomic():
    # Usa SERIALIZABLE para máximo aislamiento
    cursor = connection.cursor()
    cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
    
    operacion_critica()
```

### Configurar en settings.py:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'OPTIONS': {
            'isolation_level': psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED,
        },
    }
}
```

## 📊 Escenarios Protegidos

### Escenario 1: Venta Concurrente del Mismo Producto

**Problema:** 2 vendedores venden el último producto al mismo tiempo

```
Vendedor A: Lee stock = 1
Vendedor B: Lee stock = 1
Vendedor A: Vende 1, stock = 0
Vendedor B: Vende 1, stock = -1 ❌
```

**Solución:**
```python
with transaction.atomic():
    stock = StockProducto.objects.select_for_update().get(...)
    if stock.cantidad_actual < cantidad:
        raise ValueError('Stock insuficiente')
    # Solo UNO pasará, el otro esperará y fallará
```

### Escenario 2: Transferencia + Venta Simultánea

**Problema:** Transferir producto mientras se vende

```
Transferencia: Lee stock = 10
Venta: Lee stock = 10
Transferencia: Envía 10, stock = 0
Venta: Vende 5, stock = -5 ❌
```

**Solución:** select_for_update() bloquea la fila

### Escenario 3: Fallo en Medio de Venta

**Problema:** Se crea venta pero falla al crear detalles

```
1. Crear Venta ✅
2. Crear Detalles ❌ (falla)
3. Resultado: Venta sin productos ❌
```

**Solución:** @transaction.atomic revierte TODO

## 🧪 Pruebas de Concurrencia

### Test 1: Ventas Concurrentes

```python
import threading

def vender_producto(producto_id, cantidad):
    # Intentar vender el mismo producto
    crear_venta(producto_id, cantidad)

# Simular 100 ventas simultáneas
threads = []
for i in range(100):
    t = threading.Thread(target=vender_producto, args=(1, 1))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

# Verificar que stock final sea correcto
assert stock.cantidad_actual >= 0
```

### Test 2: Transferencias Concurrentes

```python
def test_transferencias_concurrentes():
    # Stock inicial = 100
    # 10 transferencias de 10 unidades cada una
    
    threads = [
        Thread(target=transferir, args=(10,))
        for _ in range(10)
    ]
    
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    
    # Stock final debe ser 0, no negativo
    assert stock_origen.cantidad_actual == 0
    assert stock_destino.cantidad_actual == 100
```

## 📈 Monitoreo de Locks

### Ver Locks Activos en PostgreSQL:

```sql
SELECT 
    pid,
    usename,
    pg_blocking_pids(pid) as blocked_by,
    query as blocked_query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

### Detectar Deadlocks:

```python
# En settings.py agregar:
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}
```

## ⚡ Optimizaciones

### 1. Usar bulk_create() para Detalles

```python
# ANTES (N queries)
for detalle in detalles:
    DetalleVenta.objects.create(...)

# DESPUÉS (1 query)
DetalleVenta.objects.bulk_create([
    DetalleVenta(**detalle) for detalle in detalles
])
```

### 2. Select Related para Reducir Queries

```python
ventas = Venta.objects.select_related(
    'cliente', 'caja', 'usuario'
).prefetch_related(
    'detalles__producto', 'pagos'
)
```

### 3. Cache para Productos de Alta Demanda

```python
from django.core.cache import cache

def get_producto(codigo):
    key = f'producto_{codigo}'
    producto = cache.get(key)
    
    if not producto:
        producto = Producto.objects.get(codigo=codigo)
        cache.set(key, producto, 300)  # 5 minutos
    
    return producto
```

## 🔐 Resumen de Garantías

| Operación | Atomicidad | Locks | Validaciones |
|-----------|-----------|-------|--------------|
| Crear Venta | ✅ | ✅ | ✅ Stock |
| Anular Venta | ✅ | ✅ | ✅ Estado |
| Transferencia | ✅ | ✅ | ✅ Stock origen |
| Cierre Caja | ✅ | ✅ | ✅ Cálculos |
| Sync Offline | ✅ | ✅ | ✅ Duplicados |
| Update Stock | ✅ | ✅ | ⚠️ Permite negativo con log |

## 📚 Referencias

- [Django Transactions](https://docs.djangoproject.com/en/5.0/topics/db/transactions/)
- [PostgreSQL Isolation Levels](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Select For Update](https://docs.djangoproject.com/en/5.0/ref/models/querysets/#select-for-update)

---

**Sistema ahora con transaccionalidad de nivel empresarial** 🚀🔒
