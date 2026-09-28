import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { usePOSStore } from './store/posStore';
import { syncService } from './services/syncService';
import POSScreen from './pages/POSScreen';
import ConfigScreen from './pages/ConfigScreen';
import VentasHistorial from './pages/VentasHistorial';
import ToastContainer from './components/ToastContainer';
import { apiService } from './services/apiService';

function App() {
  const config = usePOSStore((state) => state.config);
  const modoOffline = usePOSStore((state) => state.modoOffline);
  const sincronizando = usePOSStore((state) => state.sincronizando);
  const pendienteSync = usePOSStore((state) => state.pendienteSync);
  const deadLetterSync = usePOSStore((state) => state.deadLetterSync);

  const reintentarDeadLetter = async () => {
    if (!window.electron?.sync?.reintentarDeadLetter) return;
    const result = await window.electron.sync.reintentarDeadLetter();
    if (result?.success) {
      await syncService.sincronizarAhora();
    }
  };

  useEffect(() => {
    // Cargar configuración al iniciar
    const loadConfig = async () => {
      if (window.electron?.config?.get) {
        // En Electron
        const result = await window.electron.config.get('pos_config');
        if (result.value) {
          if (result.value.servidor_url) apiService.setBaseURL(result.value.servidor_url);
          apiService.setEmpresaId(result.value.empresa_id);
          usePOSStore.getState().setConfig(result.value);
        }
      } else {
        // En desarrollo web, cargar de localStorage
        const savedConfig = localStorage.getItem('pos_config');
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed.servidor_url) apiService.setBaseURL(parsed.servidor_url);
          apiService.setEmpresaId(parsed.empresa_id);
          usePOSStore.getState().setConfig(parsed);
        }
      }
    };

    loadConfig();

    // Iniciar sincronización automática solo si hay electron
    if (window.electron) {
      syncService.startAutoSync();
    }

    return () => {
      if (window.electron) {
        syncService.stopAutoSync();
      }
    };
  }, []);

  // Si no hay configuración, mostrar pantalla de configuración
  if (!config) {
    return (
      <>
        <ConfigScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-100">
      {/* Barra de estado */}
      <div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">POS - Caja {config.caja_id}</h1>
          <span className="text-sm opacity-90">Empresa ID: {config.empresa_id}</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Indicador de sincronización */}
          {sincronizando && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              <span className="text-sm">Sincronizando...</span>
            </div>
          )}

          {/* Pendientes de sincronización */}
          {pendienteSync > 0 && (
            <div className="bg-yellow-500 px-3 py-1 rounded-full text-sm font-semibold">
              {pendienteSync} pendientes
            </div>
          )}
          {deadLetterSync > 0 && (
            <button
              type="button"
              className="bg-red-600 px-3 py-1 rounded-full text-sm font-semibold hover:bg-red-700"
              title="Requieren revisión o reintento manual"
              onClick={reintentarDeadLetter}
            >
              {deadLetterSync} errores · reintentar
            </button>
          )}

          {/* Modo offline/online */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            modoOffline ? 'bg-red-500' : 'bg-green-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              modoOffline ? 'bg-white' : 'bg-white animate-pulse'
            }`} />
            <span className="text-sm font-semibold">
              {modoOffline ? 'OFFLINE' : 'ONLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Rutas */}
      <Routes>
        <Route path="/" element={<POSScreen />} />
        <Route path="/config" element={<ConfigScreen />} />
        <Route path="/ventas" element={<VentasHistorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
    <ToastContainer />
    </>
  );
}

export default App;
