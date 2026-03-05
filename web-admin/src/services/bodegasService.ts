import apiClient from './apiClient';
import type { Bodega } from '../types';

export const bodegasService = {
  getAll: async () => {
    const { data } = await apiClient.get('/inventarios/bodegas/');
    return Array.isArray(data) ? data : (data.results ?? []) as Bodega[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Bodega>(`/inventarios/bodegas/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Bodega>) => {
    const response = await apiClient.post<Bodega>('/inventarios/bodegas/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Bodega>) => {
    const response = await apiClient.put<Bodega>(`/inventarios/bodegas/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/inventarios/bodegas/${id}/`);
  },
};
