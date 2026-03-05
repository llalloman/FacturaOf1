import apiClient from './apiClient';
import type { OrdenCompra } from '../types';

export const ordenesCompraService = {
  getAll: async () => {
    const { data } = await apiClient.get('/proveedores/ordenes/');
    return Array.isArray(data) ? data : (data.results ?? []) as OrdenCompra[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<OrdenCompra>(`/proveedores/ordenes/${id}/`);
    return response.data;
  },

  create: async (data: Partial<OrdenCompra>) => {
    const response = await apiClient.post<OrdenCompra>('/proveedores/ordenes/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<OrdenCompra>) => {
    const response = await apiClient.put<OrdenCompra>(`/proveedores/ordenes/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/proveedores/ordenes/${id}/`);
  },

  marcarRecibida: async (id: number) => {
    const response = await apiClient.post(`/proveedores/ordenes/${id}/recibir/`);
    return response.data;
  },
};
