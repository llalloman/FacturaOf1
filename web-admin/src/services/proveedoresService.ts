import apiClient from './apiClient';
import type { Proveedor } from '../types';

export const proveedoresService = {
  getAll: async () => {
    const { data } = await apiClient.get('/proveedores/proveedores/');
    return Array.isArray(data) ? data : (data.results ?? []) as Proveedor[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Proveedor>(`/proveedores/proveedores/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Proveedor>) => {
    const response = await apiClient.post<Proveedor>('/proveedores/proveedores/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Proveedor>) => {
    const response = await apiClient.put<Proveedor>(`/proveedores/proveedores/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/proveedores/proveedores/${id}/`);
  },
};
