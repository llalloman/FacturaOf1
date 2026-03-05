import apiClient from './apiClient';
import type { Caja } from '../types';

export const cajasService = {
  getAll: async () => {
    const { data } = await apiClient.get('/ventas/cajas/');
    return Array.isArray(data) ? data : (data.results ?? []) as Caja[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Caja>(`/ventas/cajas/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Caja>) => {
    const response = await apiClient.post<Caja>('/ventas/cajas/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Caja>) => {
    const response = await apiClient.put<Caja>(`/ventas/cajas/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/ventas/cajas/${id}/`);
  },
};
