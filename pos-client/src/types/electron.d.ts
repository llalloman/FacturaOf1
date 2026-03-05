// Tipos globales para el API de Electron
export interface IElectronAPI {
  ventas: {
    crear: (data: any) => Promise<any>;
    listar: (params: any) => Promise<any>;
  };
  productos: {
    listar: (params: any) => Promise<any>;
    buscarPorCodigo: (params: any) => Promise<any>;
  };
  clientes: {
    listar: (params: any) => Promise<any>;
  };
  sync: {
    pendientes: () => Promise<any>;
    obtenerPendientes: () => Promise<any>;
    marcarSincronizado: (id: number) => Promise<any>;
    actualizarCacheProductos: (productos: any[]) => Promise<any>;
    actualizarCacheClientes: (clientes: any[]) => Promise<any>;
  };
  config: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<any>;
  };
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};
