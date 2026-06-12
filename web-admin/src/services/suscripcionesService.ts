import apiClient from './apiClient';
import type { PlanSuscripcion, Suscripcion } from '../types';

export interface ResumenEmpresaSuscripcion {
  empresa_id: number;
  empresa_ruc: string;
  empresa_nombre: string;
  empresa_activa: boolean;
  suscripcion: Suscripcion | null;
}

export interface ModuloSistema {
  id?: number;
  seccion?: number | null;
  seccion_codigo?: string;
  seccion_nombre?: string;
  codigo: string;
  label: string;
  ruta: string;
  grupo: string;
  icono?: string;
  orden?: number;
  activo?: boolean;
  external?: boolean;
}

export interface SeccionModulo {
  id?: number;
  codigo: string;
  nombre: string;
  orden?: number;
  activo?: boolean;
}

export const suscripcionesService = {
  getPlanes: async (): Promise<PlanSuscripcion[]> => {
    const { data } = await apiClient.get('/suscripciones/planes/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getTodosPlanes: async (): Promise<PlanSuscripcion[]> => {
    const { data } = await apiClient.get('/suscripciones/planes/?all=1');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  createPlan: async (payload: Partial<PlanSuscripcion>): Promise<PlanSuscripcion> => {
    const { data } = await apiClient.post('/suscripciones/planes/', payload);
    return data;
  },

  updatePlan: async (id: number, payload: Partial<PlanSuscripcion>): Promise<PlanSuscripcion> => {
    const { data } = await apiClient.patch(`/suscripciones/planes/${id}/`, payload);
    return data;
  },

  deletePlan: async (id: number): Promise<void> => {
    await apiClient.delete(`/suscripciones/planes/${id}/`);
  },

  getSuscripcionActiva: async (): Promise<Suscripcion> => {
    const { data } = await apiClient.get('/suscripciones/suscripciones/activa/');
    return data;
  },

  createSuscripcion: async (payload: Partial<Suscripcion>): Promise<Suscripcion> => {
    const { data } = await apiClient.post('/suscripciones/suscripciones/', payload);
    return data;
  },

  updateSuscripcion: async (id: number, payload: Partial<Suscripcion>): Promise<Suscripcion> => {
    const { data } = await apiClient.patch(`/suscripciones/suscripciones/${id}/`, payload);
    return data;
  },

  deleteSuscripcion: async (id: number): Promise<void> => {
    await apiClient.delete(`/suscripciones/suscripciones/${id}/`);
  },

  // ── SUPER_ADMIN ────────────────────────────────────────────────────────────
  getResumenAdmin: async (): Promise<ResumenEmpresaSuscripcion[]> => {
    const { data } = await apiClient.get('/suscripciones/suscripciones/resumen-admin/');
    return data;
  },

  crearTrial: async (empresa_id: number, plan_id: number, dias_prueba = 30): Promise<Suscripcion> => {
    const { data } = await apiClient.post('/suscripciones/suscripciones/crear-trial/', { empresa_id, plan_id, dias_prueba });
    return data;
  },

  activar:  async (id: number): Promise<Suscripcion> => {
    const { data } = await apiClient.post(`/suscripciones/suscripciones/${id}/activar/`);
    return data;
  },

  suspender: async (id: number): Promise<Suscripcion> => {
    const { data } = await apiClient.post(`/suscripciones/suscripciones/${id}/suspender/`);
    return data;
  },

  renovar: async (id: number): Promise<Suscripcion> => {
    const { data } = await apiClient.post(`/suscripciones/suscripciones/${id}/renovar/`);
    return data;
  },

  cancelar: async (id: number): Promise<Suscripcion> => {
    const { data } = await apiClient.post(`/suscripciones/suscripciones/${id}/cancelar/`);
    return data;
  },

  cambiarPlan: async (plan_id: number): Promise<Suscripcion> => {
    const { data } = await apiClient.post('/suscripciones/suscripciones/cambiar-plan/', { plan_id });
    return data;
  },

  toggleAutoRenovar: async (enabled?: boolean): Promise<Suscripcion> => {
    const body = enabled !== undefined ? { enabled } : {};
    const { data } = await apiClient.post('/suscripciones/suscripciones/toggle-auto-renovar/', body);
    return data;
  },

  // ── Módulos / Matriz de permisos ─────────────────────────────────────────
  getMisModulos: async (): Promise<string[]> => {
    const { data } = await apiClient.get('/suscripciones/mis-modulos/');
    return data.modulos ?? [];
  },

  getCatalogModulos: async (): Promise<ModuloSistema[]> => {
    const { data } = await apiClient.get('/suscripciones/modulos-catalogo/');
    return data;
  },

  getModulosSistema: async (): Promise<ModuloSistema[]> => {
    const { data } = await apiClient.get('/suscripciones/modulos/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getSeccionesModulos: async (): Promise<SeccionModulo[]> => {
    const { data } = await apiClient.get('/suscripciones/modulos-secciones/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  createSeccionModulo: async (payload: Partial<SeccionModulo>): Promise<SeccionModulo> => {
    const { data } = await apiClient.post('/suscripciones/modulos-secciones/', payload);
    return data;
  },

  updateSeccionModulo: async (id: number, payload: Partial<SeccionModulo>): Promise<SeccionModulo> => {
    const { data } = await apiClient.patch(`/suscripciones/modulos-secciones/${id}/`, payload);
    return data;
  },

  deleteSeccionModulo: async (id: number): Promise<void> => {
    await apiClient.delete(`/suscripciones/modulos-secciones/${id}/`);
  },

  createModuloSistema: async (payload: Partial<ModuloSistema>): Promise<ModuloSistema> => {
    const { data } = await apiClient.post('/suscripciones/modulos/', payload);
    return data;
  },

  updateModuloSistema: async (id: number, payload: Partial<ModuloSistema>): Promise<ModuloSistema> => {
    const { data } = await apiClient.patch(`/suscripciones/modulos/${id}/`, payload);
    return data;
  },

  deleteModuloSistema: async (id: number): Promise<void> => {
    await apiClient.delete(`/suscripciones/modulos/${id}/`);
  },

  getModulosPlan: async (planId: number): Promise<string[]> => {
    const { data } = await apiClient.get(`/suscripciones/planes/${planId}/modulos/`);
    return data.modulos ?? [];
  },

  setModulosPlan: async (planId: number, modulos: string[]): Promise<string[]> => {
    const { data } = await apiClient.put(`/suscripciones/planes/${planId}/modulos/`, { modulos });
    return data.modulos ?? [];
  },
};
