import apiClient from './apiClient';
import type { NotaDebito } from '../types';

export const notasDebitoService = {
  getAll: async () => {
    const response = await apiClient.get('/facturacion/notas-debito/');
    const data = response.data as NotaDebito[] | { results: NotaDebito[] };
    return (Array.isArray(data) ? data : (data.results ?? [])) as NotaDebito[];
  },

  create: async (data: Record<string, unknown>) => {
    const response = await apiClient.post<NotaDebito>('/facturacion/notas-debito/', data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/facturacion/notas-debito/${id}/`);
  },

  enviarSRI: async (id: number) => {
    const response = await apiClient.post(`/facturacion/notas-debito/${id}/enviar_sri/`);
    return response.data;
  },

  reprocesar: async (id: number) => {
    const response = await apiClient.post(`/facturacion/notas-debito/${id}/reprocesar/`);
    return response.data;
  },
};
