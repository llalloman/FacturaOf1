const { contextBridge, ipcRenderer } = require('electron');

// Exponer API segura al renderer process
contextBridge.exposeInMainWorld('electron', {
  // Ventas
  ventas: {
    crear: (data) => ipcRenderer.invoke('ventas:crear', data),
    listar: (params) => ipcRenderer.invoke('ventas:listar', params),
  },

  // Productos
  productos: {
    listar: (params) => ipcRenderer.invoke('productos:listar', params),
    buscarPorCodigo: (params) => ipcRenderer.invoke('productos:buscar-codigo', params),
  },

  // Clientes
  clientes: {
    listar: (params) => ipcRenderer.invoke('clientes:listar', params),
  },

  // Sincronización
  sync: {
    pendientes: () => ipcRenderer.invoke('sync:pendientes'),
    obtenerPendientes: () => ipcRenderer.invoke('sync:obtener-pendientes'),
    marcarSincronizado: (id) => ipcRenderer.invoke('sync:marcar-sincronizado', { id }),
    actualizarCacheProductos: (productos) => ipcRenderer.invoke('sync:actualizar-cache-productos', { productos }),
    actualizarCacheClientes: (clientes) => ipcRenderer.invoke('sync:actualizar-cache-clientes', { clientes }),
  },

  // Configuración
  config: {
    get: (key) => ipcRenderer.invoke('config:get', { key }),
    set: (key, value) => ipcRenderer.invoke('config:set', { key, value }),
  },
});
