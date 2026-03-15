import apiClient from './apiClient';
import type { Secuencial } from '../types';

export const secuencialesService = {
  /** List secuenciales for the current empresa (or all if SUPER_ADMIN) */
  getAll: async (empresaId?: number) => {
    const params = empresaId ? { empresa: empresaId } : {};
    const { data } = await apiClient.get('/facturacion/secuenciales/', { params });
    return Array.isArray(data) ? data : (data.results ?? []) as Secuencial[];
  },

  /** Create the 5 default secuenciales for the empresa (ADMIN_EMPRESA or SUPER_ADMIN) */
  inicializar: async (empresaId?: number) => {
    const payload = empresaId ? { empresa: empresaId } : {};
    const { data } = await apiClient.post<Secuencial[]>('/facturacion/secuenciales/inicializar/', payload);
    return data;
  },

  /** Partial-update a secuencial (sets configurado=True for ADMIN_EMPRESA) */
  patch: async (id: number, payload: Partial<Pick<Secuencial, 'secuencial_actual' | 'establecimiento' | 'punto_emision'>>) => {
    const { data } = await apiClient.patch<Secuencial>(`/facturacion/secuenciales/${id}/`, payload);
    return data;
  },

  /** Create a secuencial (SUPER_ADMIN or auto-init) */
  create: async (payload: Partial<Secuencial>) => {
    const { data } = await apiClient.post<Secuencial>('/facturacion/secuenciales/', payload);
    return data;
  },
};
