import apiClient from './apiClient';

export type TipoCuentaBancaria = 'CORRIENTE' | 'AHORROS' | 'CAJA';
export type TipoMovimiento =
  | 'DEPOSITO' | 'RETIRO'
  | 'TRANSFERENCIA_ENTRADA' | 'TRANSFERENCIA_SALIDA'
  | 'NOTA_CREDITO' | 'NOTA_DEBITO'
  | 'CHEQUE' | 'PAGO' | 'OTRO';

export interface CuentaBancaria {
  id: number;
  banco: string;
  numero_cuenta: string;
  tipo: TipoCuentaBancaria;
  moneda: string;
  saldo_inicial: number;
  activa: boolean;
  descripcion: string;
  saldo_actual: number;
  saldo_disponible: number;
}

export interface MovimientoBancario {
  id: number;
  cuenta: number;
  cuenta_label: string;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string;
  referencia: string;
  monto: number;
  conciliado: boolean;
  beneficiario: string;
  notas: string;
  created_at: string;
  es_entrada: boolean;
  origen: 'MANUAL' | 'VENTA' | 'PAGO_PROVEEDOR' | 'NOMINA';
  origen_referencia: string;
  eliminable: boolean;
}

export interface ExtractoRow {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string;
  referencia: string;
  beneficiario: string;
  notas: string;
  entrada: number;
  salida: number;
  saldo: number;
  conciliado: boolean;
  origen: 'MANUAL' | 'VENTA' | 'PAGO_PROVEEDOR' | 'NOMINA';
  origen_referencia: string;
  eliminable: boolean;
}

export interface ExtractoResponse {
  cuenta: CuentaBancaria;
  saldo_inicial: number;
  movimientos: ExtractoRow[];
}

export interface ResumenBancos {
  total_disponible: number;
  total_conciliado: number;
  cuentas: CuentaBancaria[];
}

// ── Cuentas ───────────────────────────────────────────────────────────────

export const getCuentas = () =>
  apiClient.get<CuentaBancaria[] | { results?: CuentaBancaria[]; cuentas?: CuentaBancaria[] }>('/bancos/cuentas/').then(r => {
    const data = r.data;
    if (Array.isArray(data)) return data;
    return data.results ?? data.cuentas ?? [];
  });

export const getResumen = () =>
  apiClient.get<ResumenBancos>('/bancos/cuentas/resumen/').then(r => r.data);

export const crearCuenta = (data: Partial<CuentaBancaria>) =>
  apiClient.post<CuentaBancaria>('/bancos/cuentas/', data).then(r => r.data);

export const actualizarCuenta = (id: number, data: Partial<CuentaBancaria>) =>
  apiClient.patch<CuentaBancaria>(`/bancos/cuentas/${id}/`, data).then(r => r.data);

// ── Movimientos ───────────────────────────────────────────────────────────

export const getMovimientos = (params: Record<string, string> = {}) =>
  apiClient.get<MovimientoBancario[]>('/bancos/movimientos/', { params }).then(r => r.data);

export const crearMovimiento = (data: Partial<MovimientoBancario>) =>
  apiClient.post<MovimientoBancario>('/bancos/movimientos/', data).then(r => r.data);

export const actualizarMovimiento = (id: number, data: Partial<MovimientoBancario>) =>
  apiClient.patch<MovimientoBancario>(`/bancos/movimientos/${id}/`, data).then(r => r.data);

export const eliminarMovimiento = (id: number) =>
  apiClient.delete(`/bancos/movimientos/${id}/`);

export const conciliarMovimiento = (id: number) =>
  apiClient.post(`/bancos/movimientos/${id}/conciliar/`).then(r => r.data);

export const conciliarMultiples = (ids: number[], conciliado: boolean) =>
  apiClient.post('/bancos/movimientos/conciliar_multiples/', { ids, conciliado }).then(r => r.data);

export const getExtracto = (cuentaId: number, params: Record<string, string> = {}) =>
  apiClient.get<ExtractoResponse>('/bancos/movimientos/extracto/', {
    params: { cuenta: cuentaId, ...params },
  }).then(r => r.data);
