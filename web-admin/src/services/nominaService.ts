import apiClient from './apiClient';

export type TipoContrato = 'INDEFINIDO' | 'FIJO' | 'OBRA' | 'HONORARIOS' | 'PASANTIA';
export type EstadoEmpleado = 'ACTIVO' | 'INACTIVO';
export type EstadoRol = 'BORRADOR' | 'APROBADO' | 'PAGADO';

export interface Empleado {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  cargo: string;
  departamento: string;
  tipo_contrato: TipoContrato;
  estado: EstadoEmpleado;
  fecha_ingreso: string;
  fecha_salida: string | null;
  sueldo_base: number;
  afiliado_iess: boolean;
  numero_iess: string;
  cuenta_bancaria: string;
  banco: string;
  email: string;
  telefono: string;
}

export interface RolPago {
  id: number;
  empleado: number;
  empleado_nombre: string;
  anio: number;
  mes: number;
  estado: EstadoRol;
  sueldo_base: number;
  horas_extra_25: number;
  horas_extra_100: number;
  comisiones: number;
  bonos: number;
  otros_ingresos: number;
  aporte_patronal: number;
  decimo_tercero: number;
  decimo_cuarto: number;
  fondos_reserva: number;
  vacaciones: number;
  aporte_personal: number;
  impuesto_renta: number;
  anticipos: number;
  otros_descuentos: number;
  total_ingresos: number;
  total_descuentos: number;
  liquido_a_pagar: number;
  notas: string;
  created_at: string;
}

export interface ResumenNomina {
  anio: string | null;
  mes: string | null;
  empleados: number;
  total_ingresos: number;
  total_descuentos: number;
  total_liquido: number;
  total_aporte_patronal: number;
  total_decimo_tercero: number;
  total_decimo_cuarto: number;
  total_vacaciones: number;
}

// ── Empleados ──────────────────────────────────────────────────────────────

export const getEmpleados = (params: Record<string, string> = {}) =>
  apiClient.get<Empleado[]>('/nomina/empleados/', { params }).then(r => r.data);

export const crearEmpleado = (data: Partial<Empleado>) =>
  apiClient.post<Empleado>('/nomina/empleados/', data).then(r => r.data);

export const actualizarEmpleado = (id: number, data: Partial<Empleado>) =>
  apiClient.patch<Empleado>(`/nomina/empleados/${id}/`, data).then(r => r.data);

export const generarRoles = (anio: number, mes: number) =>
  apiClient.post('/nomina/empleados/generar_roles/', { anio, mes }).then(r => r.data);

// ── Roles de Pago ──────────────────────────────────────────────────────────

export const getRoles = (params: Record<string, string> = {}) =>
  apiClient.get<RolPago[]>('/nomina/roles/', { params }).then(r => r.data);

export const crearRol = (data: Partial<RolPago>) =>
  apiClient.post<RolPago>('/nomina/roles/', data).then(r => r.data);

export const actualizarRol = (id: number, data: Partial<RolPago>) =>
  apiClient.patch<RolPago>(`/nomina/roles/${id}/`, data).then(r => r.data);

export const aprobarRol = (id: number) =>
  apiClient.post(`/nomina/roles/${id}/aprobar/`).then(r => r.data);

export const marcarPagadoRol = (id: number) =>
  apiClient.post(`/nomina/roles/${id}/marcar_pagado/`).then(r => r.data);

export const getResumenNomina = (anio?: string, mes?: string) =>
  apiClient.get<ResumenNomina>('/nomina/roles/resumen/', { params: { anio, mes } }).then(r => r.data);
