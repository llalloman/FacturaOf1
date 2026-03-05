# POS Client - Sistema de Facturación SRI Ecuador

Cliente de escritorio Electron + React + TypeScript para el sistema de facturación electrónica del SRI Ecuador con capacidades offline/online.

## Características

### ✅ Funcionalidad Offline/Online
- Base de datos SQLite local con sincronización bidireccional
- Cola de sincronización automática cada 5 minutos
- Caché de productos y clientes
- Indicador de estado de conexión en tiempo real
- Ventas offline con UUID único

### ✅ Punto de Venta (POS)
- Interfaz rápida y moderna con Tailwind CSS
- Búsqueda por código de barras
- Carrito de compras con ajuste de cantidades
- Múltiples métodos de pago (efectivo, tarjeta, transferencia, etc.)
- Cálculo automático de IVA
- Selección de clientes
- Historial de ventas

### ✅ Gestión de Inventario
- Control de stock en tiempo real
- Actualización automática al completar ventas
- Sincronización con servidor

### ✅ Arquitectura Técnica
- **Electron 28**: Proceso principal con IPC seguro
- **React 18 + TypeScript**: UI moderna y tipada
- **Better-SQLite3**: Base de datos local rápida
- **Zustand**: Estado global reactivo
- **React Query**: Manejo de datos asíncronos
- **Tailwind CSS**: Estilos modernos y responsivos

## Instalación

```bash
cd pos-client
npm install
```

## Desarrollo

```bash
# Iniciar en modo desarrollo (hot reload)
npm run dev
```

Esto iniciará:
1. Vite dev server en `http://localhost:5173`
2. Electron app conectada al servidor Vite

## Producción

```bash
# Compilar la app React
npm run build

# Crear ejecutable de Electron
npm run build:electron
```

Los instaladores se generarán en `dist-electron/`:
- macOS: `.dmg` y `.zip`
- Windows: `.exe` (NSIS) y portable
- Linux: `.AppImage` y `.deb`

## Configuración Inicial

Al iniciar la aplicación por primera vez, configurar:

- **ID Empresa**: ID de la empresa en el backend
- **ID Caja**: ID de la caja registrada
- **ID Usuario**: ID del usuario operador
- **ID Bodega**: Bodega para movimientos de inventario
- **URL del Servidor**: Ejemplo: `http://localhost:8000`

## Estructura del Proyecto

```
pos-client/
├── electron/
│   ├── main.js          # Proceso principal de Electron
│   └── preload.js       # API bridge seguro
├── src/
│   ├── components/      # Componentes React
│   │   ├── Cart.tsx
│   │   ├── ProductList.tsx
│   │   ├── ClientSelector.tsx
│   │   └── PaymentModal.tsx
│   ├── pages/          # Pantallas principales
│   │   ├── POSScreen.tsx
│   │   ├── ConfigScreen.tsx
│   │   └── VentasHistorial.tsx
│   ├── services/       # Lógica de negocio
│   │   ├── apiService.ts      # Cliente HTTP
│   │   └── syncService.ts     # Sincronización
│   ├── store/          # Estado global
│   │   └── posStore.ts
│   ├── types/          # Definiciones TypeScript
│   │   ├── index.ts
│   │   └── electron.d.ts
│   ├── App.tsx         # Componente raíz
│   └── main.tsx        # Entry point
├── package.json
├── vite.config.js
├── tsconfig.json
└── tailwind.config.js
```

## Base de Datos Local (SQLite)

### Tablas principales:

- **ventas**: Ventas registradas (con UUID para sync)
- **detalles_venta**: Items de cada venta
- **productos_cache**: Caché de productos del servidor
- **clientes_cache**: Caché de clientes del servidor
- **sync_queue**: Cola de sincronización pendiente
- **config**: Configuraciones locales

## API Electron (IPC)

### Ventas
```typescript
window.electron.ventas.crear(data)
window.electron.ventas.listar(params)
```

### Productos
```typescript
window.electron.productos.listar({ empresaId, buscar })
window.electron.productos.buscarPorCodigo({ codigo, empresaId })
```

### Clientes
```typescript
window.electron.clientes.listar({ empresaId })
```

### Sincronización
```typescript
window.electron.sync.pendientes()
window.electron.sync.obtenerPendientes()
window.electron.sync.marcarSincronizado(id)
window.electron.sync.actualizarCacheProductos(productos)
window.electron.sync.actualizarCacheClientes(clientes)
```

### Configuración
```typescript
window.electron.config.get(key)
window.electron.config.set(key, value)
```

## Atajos de Teclado

- **F12**: Procesar pago
- **Esc**: Cerrar modales
- **Enter**: Buscar producto

## Conexión con Backend Django

El cliente se conecta al backend Django REST API en:
```
http://localhost:8000/api/
```

Endpoints utilizados:
- `POST /api/auth/login/` - Autenticación JWT
- `GET /api/productos/` - Lista de productos
- `GET /api/clientes/` - Lista de clientes
- `POST /api/ventas/` - Crear venta
- `POST /api/ventas/sync/` - Sincronizar venta offline
- `GET /api/health/` - Verificar conexión

## Sincronización Offline/Online

1. **Modo Offline**: Las ventas se guardan en SQLite con UUID único
2. **Cola de Sync**: Se agregan a `sync_queue` automáticamente
3. **Auto Sync**: Cada 5 minutos intenta enviar al servidor
4. **Resolución**: Al sincronizar exitosamente, se marca como sincronizada
5. **Caché**: Productos y clientes se descargan y actualizan localmente

## Notas de Desarrollo

- La app usa **contextIsolation** para seguridad
- IPC handlers están en `electron/main.js`
- El estado global usa **Zustand** (más ligero que Redux)
- Estilos con **Tailwind CSS** para desarrollo rápido
- TypeScript para type safety

## Próximas Mejoras

- [ ] Impresión de tickets térmicos
- [ ] Firma electrónica offline (XMLDSig)
- [ ] Reportes de ventas
- [ ] Gestión de aperturas/cierres de caja
- [ ] Soporte para múltiples impresoras
- [ ] Backup automático de SQLite
- [ ] Modo kiosko (fullscreen lock)

## Licencia

Propietario
