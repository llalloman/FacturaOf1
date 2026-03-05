export interface Producto {
  id: number;
  empresa_id: number;
  codigo: string;
  nombre: string;
  precio: number;
  costo: number;
  stock_actual: number;
  aplica_iva: boolean;
  porcentaje_iva: '0' | '2' | '3' | '4';
  activo: boolean;
}

export interface Cliente {
  id: number;
  empresa_id: number;
  identificacion: string;
  razon_social: string;
  email?: string;
  telefono?: string;
  direccion?: string;
}

export interface DetalleVenta {
  producto_id: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  iva: number;
  total: number;
  costo_unitario: number;
}

export interface Venta {
  id?: number;
  uuid?: string;
  numero_venta: string;
  empresa_id: number;
  caja_id: number;
  usuario_id: number;
  cliente_id: number;
  fecha_venta: string;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  estado: 'COMPLETADA' | 'ANULADA';
  detalles: DetalleVenta[];
  pagos?: PagoVenta[];
}

export interface PagoVenta {
  metodo_pago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CHEQUE' | 'CREDITO';
  monto: number;
  referencia?: string;
}

export interface ConfigPOS {
  empresa_id: number;
  caja_id: number;
  usuario_id: number;
  bodega_id: number;
  servidor_url: string;
  token_auth?: string;
  modo_offline: boolean;
}

// Declaración global de la API de Electron
declare global {
  interface Window {
    electron?: {
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
        actualizarCacheProductos: (productos: any) => Promise<any>;
        actualizarCacheClientes: (clientes: any) => Promise<any>;
      };
      config: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
      };
    };
  }
}
