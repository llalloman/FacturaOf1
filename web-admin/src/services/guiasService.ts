import apiClient from './apiClient';
import type { GuiaRemision } from '../types';

export const guiasService = {
  getAll: async () => {
    const response = await apiClient.get('/facturacion/guias-remision/');
    const data = response.data as GuiaRemision[] | { results: GuiaRemision[] };
    return (Array.isArray(data) ? data : (data.results ?? [])) as GuiaRemision[];
  },

  create: async (data: Record<string, unknown>) => {
    const response = await apiClient.post<GuiaRemision>('/facturacion/guias-remision/', data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/facturacion/guias-remision/${id}/`);
  },

  enviarSRI: async (id: number) => {
    const response = await apiClient.post(`/facturacion/guias-remision/${id}/enviar_sri/`);
    return response.data;
  },

  reprocesar: async (id: number) => {
    const response = await apiClient.post(`/facturacion/guias-remision/${id}/reprocesar/`);
    return response.data;
  },
};
