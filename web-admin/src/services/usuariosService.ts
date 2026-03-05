import apiClient from './apiClient';
import type { Usuario } from '../types';

export const usuariosService = {
  getAll: async () => {
    const response = await apiClient.get<{ results: Usuario[] } | Usuario[]>('/usuarios/');
    const data = response.data;
    return Array.isArray(data) ? data : data.results;
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Usuario>(`/usuarios/${id}/`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await apiClient.post<Usuario>('/usuarios/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Usuario>) => {
    const response = await apiClient.patch<Usuario>(`/usuarios/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/usuarios/${id}/`);
  },

  activar: async (id: number) => {
    const response = await apiClient.post(`/usuarios/${id}/activar/`);
    return response.data;
  },

  desactivar: async (id: number) => {
    const response = await apiClient.post(`/usuarios/${id}/desactivar/`);
    return response.data;
  },

  resetPassword: async (id: number, password: string) => {
    const response = await apiClient.post(`/usuarios/${id}/reset_password/`, { password });
    return response.data;
  },
};
