import { apiService } from './apiService';
import { usePOSStore } from '../store/posStore';

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  // Iniciar sincronización automática cada 5 minutos
  startAutoSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.sincronizar();
    }, 5 * 60 * 1000); // 5 minutos

    // Primera sincronización inmediata
    this.sincronizar();
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async sincronizar() {
    // No sincronizar si no estamos en Electron
    if (!window.electron) {
      console.log('⚠️ Sincronización solo disponible en modo Electron');
      return;
    }

    if (this.isSyncing) {
      console.log('⏳ Sincronización ya en proceso...');
      return;
    }

    this.isSyncing = true;
    const store = usePOSStore.getState();
    store.setSincronizando(true);

    console.log('🔄 Iniciando sincronización...');

    try {
      // 1. Verificar conexión
      const isOnline = await apiService.verificarConexion();
      store.setModoOffline(!isOnline);

      if (!isOnline) {
        console.log('❌ Sin conexión al servidor');
        store.setSincronizando(false);
        this.isSyncing = false;
        return;
      }

      // 2. Obtener registros pendientes de sincronización
      const pendientesResult = await window.electron.sync.obtenerPendientes();
      
      if (!pendientesResult.success) {
        throw new Error('Error obteniendo pendientes');
      }

      const pendientes = pendientesResult.pendientes || [];
      console.log(`📦 Pendientes de sincronización: ${pendientes.length}`);

      // 3. Sincronizar cada registro
      for (const item of pendientes) {
        try {
          if (item.entity_type === 'venta') {
            const ventaData = JSON.parse(item.data);
            const result = await apiService.sincronizarVenta(ventaData);

            if (result.success) {
              await window.electron.sync.marcarSincronizado(item.id);
              console.log(`✅ Venta ${item.entity_id} sincronizada`);
            }
          }
        } catch (error) {
          console.error(`❌ Error sincronizando ${item.entity_type} ${item.entity_id}:`, error);
        }
      }

      // 4. Descargar datos actualizados del servidor
      await this.descargarDatosServidor();

      // 5. Actualizar estado
      const countResult = await window.electron.sync.pendientes();
      store.setPendienteSync(countResult.count || 0);
      store.setUltimaSync(new Date());

      console.log('✅ Sincronización completada');
    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      store.setModoOffline(true);
    } finally {
      store.setSincronizando(false);
      this.isSyncing = false;
    }
  }

  async descargarDatosServidor() {
    try {
      const config = usePOSStore.getState().config;
      if (!config) return;

      // Descargar productos
      console.log('⬇️ Descargando productos...');
      const productos = await apiService.getProductos(config.empresa_id);
      await window.electron.sync.actualizarCacheProductos(productos);
      console.log(`✅ ${productos.length} productos actualizados`);

      // Descargar clientes
      console.log('⬇️ Descargando clientes...');
      const clientes = await apiService.getClientes(config.empresa_id);
      await window.electron.sync.actualizarCacheClientes(clientes);
      console.log(`✅ ${clientes.length} clientes actualizados`);
    } catch (error) {
      console.error('❌ Error descargando datos del servidor:', error);
    }
  }

  // Sincronización manual forzada
  async sincronizarAhora() {
    await this.sincronizar();
  }
}

export const syncService = new SyncService();
