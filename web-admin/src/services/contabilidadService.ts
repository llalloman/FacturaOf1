import apiClient from './apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

export type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO';
export type NaturalezaCuenta = 'DEUDORA' | 'ACREEDORA';

export interface CuentaContable {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  nivel: number;
  es_hoja: boolean;
  activa: boolean;
  padre: number | null;
  saldo: number;
  tiene_hijos: boolean;
  hijos?: CuentaContable[];
}

export type TipoAsiento =
  | 'MANUAL' | 'VENTA' | 'COMPRA' | 'PAGO' | 'COBRO' | 'AJUSTE' | 'APERTURA' | 'CIERRE';

export interface LineaAsiento {
  id?: number;
  cuenta: number;
  cuenta_codigo?: string;
  cuenta_nombre?: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface AsientoContable {
  id: number;
  numero: string;
  fecha: string;
  tipo: TipoAsiento;
  descripcion: string;
  referencia: string;
  bloqueado: boolean;
  total_debe: number;
  total_haber: number;
  cuadrado: boolean;
  creado_por: number | null;
  creado_por_nombre: string | null;
  created_at: string;
  lineas: LineaAsiento[];
}

export interface BalanceGeneral {
  al: string;
  activo:     { cuentas: { codigo: string; nombre: string; saldo: number }[]; total: number };
  pasivo:     { cuentas: { codigo: string; nombre: string; saldo: number }[]; total: number };
  patrimonio: { cuentas: { codigo: string; nombre: string; saldo: number }[]; total: number };
  total_pasivo_patrimonio: number;
  cuadra: boolean;
}

export interface EstadoResultados {
  anio: string | null;
  mes: string | null;
  ingresos: { cuentas: { codigo: string; nombre: string; saldo: number }[]; total: number };
  costos:   { cuentas: { codigo: string; nombre: string; saldo: number }[]; total: number };
  gastos:   { cuentas: { codigo: string; nombre: string; saldo: number }[]; total: number };
  utilidad_bruta: number;
  utilidad_neta: number;
}

export interface LibroMayor {
  cuenta: { id: number; codigo: string; nombre: string };
  movimientos: {
    fecha: string;
    numero: string;
    descripcion: string;
    debe: number;
    haber: number;
    saldo: number;
  }[];
}

// ── Cuentas ──────────────────────────────────────────────────────────────────

export const getCuentas = () =>
  apiClient.get<CuentaContable[]>('/contabilidad/cuentas/').then(r => r.data);

export const getCuentasArbol = () =>
  apiClient.get<CuentaContable[]>('/contabilidad/cuentas/arbol/').then(r => r.data);

export const inicializarPlan = () =>
  apiClient.post('/contabilidad/cuentas/inicializar/').then(r => r.data);

export const crearCuenta = (data: Partial<CuentaContable>) =>
  apiClient.post<CuentaContable>('/contabilidad/cuentas/', data).then(r => r.data);

export const actualizarCuenta = (id: number, data: Partial<CuentaContable>) =>
  apiClient.patch<CuentaContable>(`/contabilidad/cuentas/${id}/`, data).then(r => r.data);

// ── Asientos ─────────────────────────────────────────────────────────────────

export const getAsientos = (params: Record<string, string> = {}) =>
  apiClient.get<AsientoContable[]>('/contabilidad/asientos/', { params }).then(r => r.data);

export const crearAsiento = (data: {
  numero?: string;
  fecha: string;
  tipo: TipoAsiento;
  descripcion: string;
  referencia?: string;
  lineas: Omit<LineaAsiento, 'id' | 'cuenta_codigo' | 'cuenta_nombre'>[];
}) => apiClient.post<AsientoContable>('/contabilidad/asientos/', data).then(r => r.data);

export const bloquearAsiento = (id: number) =>
  apiClient.post(`/contabilidad/asientos/${id}/bloquear/`).then(r => r.data);

// ── Informes ─────────────────────────────────────────────────────────────────

export const getBalanceGeneral = (al?: string) =>
  apiClient.get<BalanceGeneral>('/contabilidad/asientos/balance_general/', { params: al ? { al } : {} }).then(r => r.data);

export const getEstadoResultados = (anio?: string, mes?: string) =>
  apiClient.get<EstadoResultados>('/contabilidad/asientos/estado_resultados/', { params: { anio, mes } }).then(r => r.data);

export const getLibroMayor = (cuentaId: number, anio?: string, mes?: string) =>
  apiClient.get<LibroMayor>('/contabilidad/asientos/libro_mayor/', {
    params: { cuenta_id: cuentaId, anio, mes },
  }).then(r => r.data);
