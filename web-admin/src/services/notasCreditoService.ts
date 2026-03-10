import apiClient from './apiClient';
import type { NotaCredito } from '../types/index';

export const notasCreditoService = {
  getAll: async (): Promise<NotaCredito[]> => {
    const response = await apiClient.get('/facturacion/notas-credito/');
    const data = response.data as NotaCredito[] | { results: NotaCredito[] };
    return (Array.isArray(data) ? data : (data.results ?? [])) as NotaCredito[];
  },

  reprocesar: async (id: number) => {
    const response = await apiClient.post(`/facturacion/notas-credito/${id}/reprocesar/`);
    return response.data;
  },
};
