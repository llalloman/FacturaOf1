import apiClient from './apiClient';
import type { Factura } from '../types';

type FacturaQueryParams = Record<string, string | number | boolean | undefined | null>;

const fetchAllFacturasPages = async (params?: FacturaQueryParams) => {
  const all: Factura[] = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get('/facturacion/facturas/', {
      params: { ...params, page },
    });
    const data = response.data as Factura[] | { results?: Factura[]; next?: string | null };

    if (Array.isArray(data)) {
      return data;
    }

    all.push(...(data.results ?? []));

    if (!data.next) {
      break;
    }

    page += 1;
  }

  return all;
};

export const facturasService = {
  getAll: async (params?: FacturaQueryParams) => {
    return fetchAllFacturasPages(params);
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

  anular: async ({ id, motivo }: { id: number; motivo?: string }) => {
    const response = await apiClient.post(`/facturacion/facturas/${id}/anular/`, { motivo });
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

  reprocesar: async (id: number) => {
    const response = await apiClient.post(`/facturacion/facturas/${id}/reprocesar/`);
    return response.data;
  },

  reenviarEmail: async (id: number) => {
    const response = await apiClient.post(`/facturacion/facturas/${id}/reenviar_email/`);
    return response.data;
  },
};
