import apiClient from './apiClient';
import type { Secuencial } from '../types';

export const secuencialesService = {
  /** List secuenciales for the current empresa (or all if SUPER_ADMIN) */
  getAll: async (empresaId?: number) => {
    const params = empresaId ? { empresa: empresaId } : {};
    const { data } = await apiClient.get('/facturacion/secuenciales/', { params });
    return Array.isArray(data) ? data : (data.results ?? []) as Secuencial[];
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
