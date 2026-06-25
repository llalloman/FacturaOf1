import apiClient from './apiClient';

const normalizeList = <T>(data: T[] | { results?: T[] }): T[] => Array.isArray(data) ? data : (data.results ?? []);

export type PagoOnlineEstado = 'PENDING' | 'APPROVED' | 'FAILED' | 'CANCELLED';
export type PagoOnlineOrigen = 'FIRMA' | 'SUSCRIPCION' | 'VENTA' | 'CARTERA' | 'OTRO';
export type PagoOnlineMetodo = 'PAYPHONE' | 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA' | 'MANUAL';

export interface PagoConfiguracion {
  id?: number;
  empresa?: number | null;
  cuenta_payphone: number | null;
  caja_ventas: number | null;
  usuario_ventas: number | null;
  auto_generar_venta_firmas: boolean;
  auto_generar_venta_suscripciones: boolean;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PagoOnline {
  id: number;
  empresa: number | null;
  empresa_nombre?: string;
  origen: PagoOnlineOrigen;
  origen_id: string;
  provider: 'PAYPHONE';
  metodo: PagoOnlineMetodo;
  estado: PagoOnlineEstado;
  currency: string;
  base_amount: string;
  processing_fee: string;
  processing_fee_tax: string;
  total_amount: string;
  client_transaction_id: string;
  provider_transaction_id: string;
  authorization_code: string;
  venta: number | null;
  venta_numero?: string;
  pago_venta: number | null;
  movimiento_bancario: number | null;
  pago_suscripcion: number | null;
  raw_request?: Record<string, unknown>;
  raw_response?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error_message: string;
  application_error: string;
  confirmed_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoOnlineFilters {
  estado?: string;
  origen?: string;
  metodo?: string;
  provider?: string;
  search?: string;
  empresa?: string | number;
}

export const defaultPagoConfiguracion: PagoConfiguracion = {
  cuenta_payphone: null,
  caja_ventas: null,
  usuario_ventas: null,
  auto_generar_venta_firmas: true,
  auto_generar_venta_suscripciones: true,
  activo: true,
};

export const pagosService = {
  getConfiguracion: async (empresa?: number | string): Promise<PagoConfiguracion | null> => {
    const { data } = await apiClient.get('/pagos/configuracion/', { params: empresa ? { empresa } : undefined });
    return normalizeList<PagoConfiguracion>(data)[0] ?? null;
  },

  saveConfiguracion: async (payload: PagoConfiguracion): Promise<PagoConfiguracion> => {
    const body = {
      ...payload,
      cuenta_payphone: payload.cuenta_payphone || null,
      caja_ventas: payload.caja_ventas || null,
      usuario_ventas: payload.usuario_ventas || null,
    };
    if (payload.id) {
      const { data } = await apiClient.patch(`/pagos/configuracion/${payload.id}/`, body);
      return data;
    }
    const { data } = await apiClient.post('/pagos/configuracion/', body);
    return data;
  },

  listOnline: async (filters: PagoOnlineFilters = {}): Promise<PagoOnline[]> => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const { data } = await apiClient.get('/pagos/online/', { params });
    return normalizeList<PagoOnline>(data);
  },

  retryApplication: async (id: number): Promise<PagoOnline> => {
    const { data } = await apiClient.post(`/pagos/online/${id}/reintentar-aplicacion/`);
    return data;
  },
};
