import apiClient from './apiClient';
import type { Proveedor, ProveedorProducto } from '../types';

export type ProveedorProductoPayload = Pick<ProveedorProducto, 'proveedor' | 'producto' | 'codigo_proveedor' | 'costo_referencia' | 'dias_entrega' | 'es_preferido' | 'activo'>;

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

  getCatalogo: async (params?: Record<string, unknown>): Promise<ProveedorProducto[]> => {
    const { data } = await apiClient.get('/proveedores/catalogo/', { params: { page_size: 500, ...params } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  createRelacion: async (payload: ProveedorProductoPayload): Promise<ProveedorProducto> => {
    const { data } = await apiClient.post('/proveedores/catalogo/', payload);
    return data;
  },

  updateRelacion: async (id: number, payload: Partial<ProveedorProductoPayload>): Promise<ProveedorProducto> => {
    const { data } = await apiClient.patch(`/proveedores/catalogo/${id}/`, payload);
    return data;
  },
};
