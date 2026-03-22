import apiClient from './apiClient';
import type { Producto } from '../types';

export const productosService = {
  getAll: async (params?: Record<string, unknown>): Promise<Producto[]> => {
    const { data } = await apiClient.get('/productos/productos/', { params });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getById: async (id: number): Promise<Producto> => {
    const { data } = await apiClient.get(`/productos/productos/${id}/`);
    return data;
  },

  create: async (producto: Omit<Producto, 'id'>): Promise<Producto> => {
    const { data } = await apiClient.post('/productos/productos/', producto);
    return data;
  },

  update: async (id: number, producto: Partial<Producto>): Promise<Producto> => {
    const { data } = await apiClient.patch(`/productos/productos/${id}/`, producto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/productos/productos/${id}/`);
  },
};
