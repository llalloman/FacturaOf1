import apiClient from './apiClient';
import type { Retencion } from '../types';

export const retencionesService = {
  getAll: async () => {
    const response = await apiClient.get('/facturacion/retenciones/');
    const data = response.data as Retencion[] | { results: Retencion[] };
    return (Array.isArray(data) ? data : (data.results ?? [])) as Retencion[];
  },

  create: async (data: Record<string, unknown>) => {
    const response = await apiClient.post<Retencion>('/facturacion/retenciones/', data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/facturacion/retenciones/${id}/`);
  },

  enviarSRI: async (id: number) => {
    const response = await apiClient.post(`/facturacion/retenciones/${id}/enviar_sri/`);
    return response.data;
  },

  reprocesar: async (id: number) => {
    const response = await apiClient.post(`/facturacion/retenciones/${id}/reprocesar/`);
    return response.data;
  },
};
