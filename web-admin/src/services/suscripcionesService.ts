import apiClient from './apiClient';
import type { PlanSuscripcion, Suscripcion } from '../types';

export interface ResumenEmpresaSuscripcion {
  empresa_id: number;
  empresa_ruc: string;
  empresa_nombre: string;
  empresa_activa: boolean;
  suscripcion: Suscripcion | null;
}

export const suscripcionesService = {
  getPlanes: async (): Promise<PlanSuscripcion[]> => {
    const { data } = await apiClient.get('/suscripciones/planes/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getSuscripcionActiva: async (): Promise<Suscripcion> => {
    const { data } = await apiClient.get('/suscripciones/suscripciones/activa/');
    return data;
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
};
