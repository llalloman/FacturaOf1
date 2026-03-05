import apiClient from './apiClient';
import type { Factura } from '../types';

export const facturasService = {
  getAll: async () => {
    const response = await apiClient.get('/facturacion/facturas/');
    const data = response.data as Factura[] | { results: Factura[] };
    return (Array.isArray(data) ? data : (data.results ?? [])) as Factura[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Factura>(`/facturacion/facturas/${id}/`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await apiClient.post<Factura>('/facturacion/facturas/', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await apiClient.patch<Factura>(`/facturacion/facturas/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/facturacion/facturas/${id}/`);
  },

  enviarSRI: async (id: number) => {
    const response = await apiClient.post(`/facturacion/facturas/${id}/enviar_sri/`);
    return response.data;
  },

  anular: async (id: number) => {
    const response = await apiClient.post(`/facturacion/facturas/${id}/anular/`);
    return response.data;
  },

  descargarXML: async (id: number) => {
    const response = await apiClient.get(`/facturacion/facturas/${id}/xml/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  descargarPDF: async (id: number) => {
    const response = await apiClient.get(`/facturacion/facturas/${id}/pdf/`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
