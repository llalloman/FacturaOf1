import apiClient from './apiClient';
import type {
  CuentaPorCobrar,
  AgingBucket,
  CarteraResumen,
  PagoCliente,
} from '../types/index';

const BASE = '/cartera';

export const carteraService = {
  // ── Cuentas por Cobrar ────────────────────────────────────────────────────

  getCuentas: async (): Promise<CuentaPorCobrar[]> => {
    const res = await apiClient.get(`${BASE}/cuentas/`);
    const data = res.data as CuentaPorCobrar[] | { results: CuentaPorCobrar[] };
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getCuenta: async (id: number): Promise<CuentaPorCobrar> => {
    const res = await apiClient.get(`${BASE}/cuentas/${id}/`);
    return res.data as CuentaPorCobrar;
  },

  createCuenta: async (data: {
    cliente: number;
    factura?: number;
    numero_cuenta?: string;
    fecha_emision: string;
    fecha_vencimiento: string;
    monto_total: number;
    notas?: string;
  }): Promise<CuentaPorCobrar> => {
    const res = await apiClient.post(`${BASE}/cuentas/`, data);
    return res.data as CuentaPorCobrar;
  },

  marcarIncobrable: async (id: number): Promise<void> => {
    await apiClient.post(`${BASE}/cuentas/${id}/marcar_incobrable/`);
  },

  getAging: async (): Promise<AgingBucket[]> => {
    const res = await apiClient.get(`${BASE}/cuentas/aging/`);
    return res.data as AgingBucket[];
  },

  getResumen: async (): Promise<CarteraResumen> => {
    const res = await apiClient.get(`${BASE}/cuentas/resumen/`);
    return res.data as CarteraResumen;
  },

  // ── Pagos ─────────────────────────────────────────────────────────────────

  getPagosDeCuenta: async (cuentaId: number): Promise<PagoCliente[]> => {
    const res = await apiClient.get(`${BASE}/pagos/?cuenta=${cuentaId}`);
    const data = res.data as PagoCliente[] | { results: PagoCliente[] };
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  registrarPago: async (data: {
    cuenta: number;
    fecha_pago: string;
    monto: number;
    forma_pago: string;
    referencia?: string;
    notas?: string;
  }): Promise<PagoCliente> => {
    const res = await apiClient.post(`${BASE}/pagos/`, data);
    return res.data as PagoCliente;
  },
};
