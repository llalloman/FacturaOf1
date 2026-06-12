import apiClient from './apiClient';
import type { Cliente } from '../types';

export const clientesService = {
  getAll: async (): Promise<Cliente[]> => {
    const { data } = await apiClient.get('/clientes/');
    // DRF devuelve { count, next, previous, results } cuando hay paginación
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getActivos: async (): Promise<Cliente[]> => {
    const { data } = await apiClient.get('/clientes/', { params: { activo: true } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getById: async (id: number): Promise<Cliente> => {
    const { data } = await apiClient.get(`/clientes/${id}/`);
    return data;
  },

  create: async (cliente: Omit<Cliente, 'id'>): Promise<Cliente> => {
    const { data } = await apiClient.post('/clientes/', cliente);
    return data;
  },

  update: async (id: number, cliente: Partial<Cliente>): Promise<Cliente> => {
    const { data } = await apiClient.put(`/clientes/${id}/`, cliente);
    return data;
  },

  delete: async (id: number): Promise<{ mensaje?: string; accion?: string }> => {
    const { data } = await apiClient.delete(`/clientes/${id}/`);
    return data ?? {};
  },
};
