import apiClient from './apiClient';
import type { PlanSuscripcion, Suscripcion } from '../types';

export const suscripcionesService = {
  getPlanes: async (): Promise<PlanSuscripcion[]> => {
    const { data } = await apiClient.get('/suscripciones/planes/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getSuscripcionActiva: async (): Promise<Suscripcion> => {
    const { data } = await apiClient.get('/suscripciones/suscripciones/activa/');
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
};
