const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const Store = require('electron-store');

// Configuración persistente
const store = new Store();

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // En desarrollo, cargar desde Vite
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'facturacion.db');
  db = new Database(dbPath);
  
  // Crear tablas si no existen
  db.exec(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      numero_venta TEXT NOT NULL,
      empresa_id INTEGER NOT NULL,
      caja_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      fecha_venta TEXT NOT NULL,
      subtotal REAL NOT NULL,
      descuento REAL DEFAULT 0,
      iva REAL DEFAULT 0,
      total REAL NOT NULL,
      estado TEXT DEFAULT 'COMPLETADA',
      sincronizada INTEGER DEFAULT 0,
      data_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detalles_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      descuento REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      iva REAL DEFAULT 0,
      total REAL NOT NULL,
      costo_unitario REAL DEFAULT 0,
      FOREIGN KEY (venta_id) REFERENCES ventas(id)
    );

    CREATE TABLE IF NOT EXISTS productos_cache (
      id INTEGER PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL,
      costo REAL DEFAULT 0,
      stock_actual REAL DEFAULT 0,
      aplica_iva INTEGER DEFAULT 1,
      porcentaje_iva TEXT DEFAULT '2',
      activo INTEGER DEFAULT 1,
      data_json TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes_cache (
      id INTEGER PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      identificacion TEXT NOT NULL,
      razon_social TEXT NOT NULL,
      email TEXT,
      telefono TEXT,
      direccion TEXT,
      data_json TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ventas_sincronizada ON ventas(sincronizada);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_venta);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
    CREATE INDEX IF NOT EXISTS idx_productos_empresa ON productos_cache(empresa_id, activo);
    CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes_cache(empresa_id);
  `);

  console.log('✅ Base de datos inicializada:', dbPath);
}

// IPC Handlers - Ventas
ipcMain.handle('ventas:crear', async (event, ventaData) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const uuid = uuidv4();
    
    const result = db.prepare(`
      INSERT INTO ventas (uuid, numero_venta, empresa_id, caja_id, usuario_id, 
                         cliente_id, fecha_venta, subtotal, descuento, iva, total, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      ventaData.numero_venta,
      ventaData.empresa_id,
      ventaData.caja_id,
      ventaData.usuario_id,
      ventaData.cliente_id,
      new Date().toISOString(),
      ventaData.subtotal,
      ventaData.descuento,
      ventaData.iva,
      ventaData.total,
      JSON.stringify(ventaData)
    );

    const ventaId = result.lastInsertRowid;

    // Insertar detalles
    const insertDetalle = db.prepare(`
      INSERT INTO detalles_venta (venta_id, producto_id, codigo, nombre, cantidad, 
                                  precio_unitario, descuento, subtotal, iva, total, costo_unitario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const detalle of ventaData.detalles) {
      insertDetalle.run(
        ventaId,
        detalle.producto_id,
        detalle.codigo,
        detalle.nombre,
        detalle.cantidad,
        detalle.precio_unitario,
        detalle.descuento || 0,
        detalle.subtotal,
        detalle.iva || 0,
        detalle.total,
        detalle.costo_unitario || 0
      );

      // Actualizar stock local
      db.prepare(`
        UPDATE productos_cache 
        SET stock_actual = stock_actual - ? 
        WHERE id = ?
      `).run(detalle.cantidad, detalle.producto_id);
    }

    // Agregar a cola de sincronización
    db.prepare(`
      INSERT INTO sync_queue (entity_type, entity_id, operation, data)
      VALUES ('venta', ?, 'CREATE', ?)
    `).run(uuid, JSON.stringify({ ...ventaData, uuid }));

    return { success: true, ventaId, uuid };
  } catch (error) {
    console.error('Error creando venta:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ventas:listar', async (event, { limite = 50, offset = 0 }) => {
  try {
    const ventas = db.prepare(`
      SELECT * FROM ventas 
      ORDER BY fecha_venta DESC 
      LIMIT ? OFFSET ?
    `).all(limite, offset);

    return { success: true, ventas };
  } catch (error) {
    console.error('Error listando ventas:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers - Productos
ipcMain.handle('productos:listar', async (event, { empresaId, buscar = '' }) => {
  try {
    let query = 'SELECT * FROM productos_cache WHERE empresa_id = ? AND activo = 1';
    const params = [empresaId];

    if (buscar) {
      query += ' AND (codigo LIKE ? OR nombre LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`);
    }

    query += ' ORDER BY nombre LIMIT 100';

    const productos = db.prepare(query).all(...params);
    return { success: true, productos };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('productos:buscar-codigo', async (event, { codigo, empresaId }) => {
  try {
    const producto = db.prepare(`
      SELECT * FROM productos_cache 
      WHERE codigo = ? AND empresa_id = ? AND activo = 1
    `).get(codigo, empresaId);

    return { success: true, producto };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handlers - Clientes
ipcMain.handle('clientes:listar', async (event, { empresaId }) => {
  try {
    const clientes = db.prepare(`
      SELECT * FROM clientes_cache 
      WHERE empresa_id = ? 
      ORDER BY razon_social
    `).all(empresaId);

    return { success: true, clientes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handlers - Sincronización
ipcMain.handle('sync:pendientes', async () => {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0').get();
    return { success: true, count: count.count };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:obtener-pendientes', async () => {
  try {
    const pendientes = db.prepare(`
      SELECT * FROM sync_queue 
      WHERE synced = 0 
      ORDER BY timestamp ASC 
      LIMIT 50
    `).all();

    return { success: true, pendientes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:marcar-sincronizado', async (event, { id }) => {
  try {
    db.prepare('UPDATE sync_queue SET synced = 1 WHERE id = ?').run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:actualizar-cache-productos', async (event, { productos }) => {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO productos_cache 
      (id, empresa_id, codigo, nombre, precio, costo, stock_actual, 
       aplica_iva, porcentaje_iva, activo, data_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertMany = db.transaction((productos) => {
      for (const p of productos) {
        stmt.run(
          p.id, p.empresa_id, p.codigo, p.nombre, p.precio,
          p.costo || 0, p.stock_actual || 0, p.aplica_iva ? 1 : 0,
          p.porcentaje_iva, p.activo ? 1 : 0, JSON.stringify(p)
        );
      }
    });

    insertMany(productos);
    return { success: true, count: productos.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:actualizar-cache-clientes', async (event, { clientes }) => {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO clientes_cache 
      (id, empresa_id, identificacion, razon_social, email, telefono, 
       direccion, data_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertMany = db.transaction((clientes) => {
      for (const c of clientes) {
        stmt.run(
          c.id, c.empresa_id, c.identificacion, c.razon_social,
          c.email || '', c.telefono || '', c.direccion || '',
          JSON.stringify(c)
        );
      }
    });

    insertMany(clientes);
    return { success: true, count: clientes.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handlers - Configuración
ipcMain.handle('config:get', async (event, { key }) => {
  try {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return { success: true, value: row ? JSON.parse(row.value) : null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('config:set', async (event, { key, value }) => {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(key, JSON.stringify(value));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) db.close();
});
