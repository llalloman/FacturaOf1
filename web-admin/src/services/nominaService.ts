import apiClient from './apiClient';

export type TipoContrato = 'INDEFINIDO' | 'FIJO' | 'OBRA' | 'HONORARIOS' | 'PASANTIA';
export type EstadoEmpleado = 'ACTIVO' | 'INACTIVO';
export type EstadoRol = 'BORRADOR' | 'APROBADO' | 'PAGADO';
export type TipoRubroNomina = 'INGRESO' | 'DESCUENTO' | 'PROVISION';

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

export interface RubroNomina {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoRubroNomina;
  tipo_label: string;
  aplica_iess: boolean;
  aplica_ir: boolean;
  es_recurrente: boolean;
  automatico: boolean;
  activo: boolean;
  orden: number;
}

export interface DetalleRolPago {
  id?: number;
  rubro: number;
  rubro_nombre?: string;
  tipo?: TipoRubroNomina;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total?: number;
  aplica_iess?: boolean;
  aplica_ir?: boolean;
  automatico?: boolean;
  orden?: number;
}

export interface PagoRol {
  id: number;
  cuenta_bancaria: number | null;
  cuenta_label: string;
  movimiento_bancario_id: number | null;
  fecha_pago: string;
  monto: number;
  referencia: string;
  notas: string;
  created_at: string;
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
  detalles: DetalleRolPago[];
  pago_nomina?: PagoRol | null;
}

export interface ConceptoEmpleadoNomina {
  id: number;
  empleado: number;
  empleado_nombre: string;
  rubro: number;
  rubro_nombre: string;
  rubro_tipo: TipoRubroNomina;
  descripcion: string;
  valor: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  notas: string;
}

export interface ParametroNomina {
  id: number;
  anio: number;
  sbu: number;
  aporte_personal_iess: number;
  aporte_patronal_iess: number;
  decimo_tercero_factor: number;
  vacaciones_factor: number;
  fondo_reserva_factor: number;
  activo: boolean;
  notas: string;
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

export const getEmpleados = (params: Record<string, string> = {}) =>
  apiClient.get<Empleado[]>('/nomina/empleados/', { params }).then(r => r.data);

export const crearEmpleado = (data: Partial<Empleado>) =>
  apiClient.post<Empleado>('/nomina/empleados/', data).then(r => r.data);

export const actualizarEmpleado = (id: number, data: Partial<Empleado>) =>
  apiClient.patch<Empleado>(`/nomina/empleados/${id}/`, data).then(r => r.data);

export const generarRoles = (anio: number, mes: number) =>
  apiClient.post('/nomina/empleados/generar_roles/', { anio, mes }).then(r => r.data);

export const getRoles = (params: Record<string, string> = {}) =>
  apiClient.get<RolPago[]>('/nomina/roles/', { params }).then(r => r.data);

export const crearRol = (data: Partial<RolPago>) =>
  apiClient.post<RolPago>('/nomina/roles/', data).then(r => r.data);

export const actualizarRol = (id: number, data: Partial<RolPago>) =>
  apiClient.patch<RolPago>(`/nomina/roles/${id}/`, data).then(r => r.data);

export const aprobarRol = (id: number) =>
  apiClient.post(`/nomina/roles/${id}/aprobar/`).then(r => r.data);

export const marcarPagadoRol = (id: number, data: { cuenta_bancaria?: number | null; fecha_pago?: string; referencia?: string; notas?: string } = {}) =>
  apiClient.post(`/nomina/roles/${id}/marcar_pagado/`, data).then(r => r.data);

export const getResumenNomina = (anio?: string, mes?: string) =>
  apiClient.get<ResumenNomina>('/nomina/roles/resumen/', { params: { anio, mes } }).then(r => r.data);

export const getRubros = (params: Record<string, string> = {}) =>
  apiClient.get<RubroNomina[]>('/nomina/rubros/', { params }).then(r => r.data);

export const crearRubro = (data: Partial<RubroNomina>) =>
  apiClient.post<RubroNomina>('/nomina/rubros/', data).then(r => r.data);

export const actualizarRubro = (id: number, data: Partial<RubroNomina>) =>
  apiClient.patch<RubroNomina>(`/nomina/rubros/${id}/`, data).then(r => r.data);

export const sembrarRubrosBase = () =>
  apiClient.post('/nomina/rubros/sembrar_base/').then(r => r.data);

export const getConceptosEmpleado = (params: Record<string, string> = {}) =>
  apiClient.get<ConceptoEmpleadoNomina[]>('/nomina/conceptos-empleado/', { params }).then(r => r.data);

export const crearConceptoEmpleado = (data: Partial<ConceptoEmpleadoNomina>) =>
  apiClient.post<ConceptoEmpleadoNomina>('/nomina/conceptos-empleado/', data).then(r => r.data);

export const actualizarConceptoEmpleado = (id: number, data: Partial<ConceptoEmpleadoNomina>) =>
  apiClient.patch<ConceptoEmpleadoNomina>(`/nomina/conceptos-empleado/${id}/`, data).then(r => r.data);

export const getParametrosNomina = (params: Record<string, string> = {}) =>
  apiClient.get<ParametroNomina[]>('/nomina/parametros/', { params }).then(r => r.data);

export const crearParametroNomina = (data: Partial<ParametroNomina>) =>
  apiClient.post<ParametroNomina>('/nomina/parametros/', data).then(r => r.data);

export const actualizarParametroNomina = (id: number, data: Partial<ParametroNomina>) =>
  apiClient.patch<ParametroNomina>(`/nomina/parametros/${id}/`, data).then(r => r.data);
