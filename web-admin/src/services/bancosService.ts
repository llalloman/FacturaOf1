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
}

export interface ExtractoRow {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string;
  referencia: string;
  beneficiario: string;
  entrada: number;
  salida: number;
  saldo: number;
  conciliado: boolean;
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
  apiClient.get<CuentaBancaria[]>('/api/bancos/cuentas/').then(r => r.data);

export const getResumen = () =>
  apiClient.get<ResumenBancos>('/api/bancos/cuentas/resumen/').then(r => r.data);

export const crearCuenta = (data: Partial<CuentaBancaria>) =>
  apiClient.post<CuentaBancaria>('/api/bancos/cuentas/', data).then(r => r.data);

export const actualizarCuenta = (id: number, data: Partial<CuentaBancaria>) =>
  apiClient.patch<CuentaBancaria>(`/api/bancos/cuentas/${id}/`, data).then(r => r.data);

// ── Movimientos ───────────────────────────────────────────────────────────

export const getMovimientos = (params: Record<string, string> = {}) =>
  apiClient.get<MovimientoBancario[]>('/api/bancos/movimientos/', { params }).then(r => r.data);

export const crearMovimiento = (data: Partial<MovimientoBancario>) =>
  apiClient.post<MovimientoBancario>('/api/bancos/movimientos/', data).then(r => r.data);

export const conciliarMovimiento = (id: number) =>
  apiClient.post(`/api/bancos/movimientos/${id}/conciliar/`).then(r => r.data);

export const conciliarMultiples = (ids: number[], conciliado: boolean) =>
  apiClient.post('/api/bancos/movimientos/conciliar_multiples/', { ids, conciliado }).then(r => r.data);

export const getExtracto = (cuentaId: number, params: Record<string, string> = {}) =>
  apiClient.get<ExtractoResponse>('/api/bancos/movimientos/extracto/', {
    params: { cuenta: cuentaId, ...params },
  }).then(r => r.data);
