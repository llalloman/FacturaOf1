import apiClient from './apiClient';
import type { Empresa } from '../types';

export interface EstablecimientoFiscal {
  id: number;
  empresa: number;
  codigo: string;
  nombre: string;
  direccion?: string;
  activo: boolean;
}

export interface PuntoEmisionFiscal {
  id: number;
  empresa: number;
  establecimiento: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export const empresasService = {
  getAll: async () => {
    const response = await apiClient.get<{ results: Empresa[] } | Empresa[]>('/empresas/empresas/');
    const data = response.data as any;
    return (data.results ?? data) as Empresa[];
  },
  getMiEmpresa: async () => {
    const response = await apiClient.get<Empresa>('/empresas/empresas/mi_empresa/');
    return response.data;
  },
  getById: async (id: number) => {
    const response = await apiClient.get<Empresa>(`/empresas/empresas/${id}/`);
    return response.data;
  },

  create: async (payload: Partial<Empresa> & { certificado_digital?: File; logo?: File }) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'certificado_digital' || key === 'logo') {
        if (value != null && (value as unknown) instanceof File) fd.append(key, value as File);
        return;
      }
      if (value !== undefined && value !== null && value !== '') {
        fd.append(key, value as any);
      }
    });
    const response = await apiClient.post<Empresa>('/empresas/empresas/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  update: async (id: number, payload: Partial<Empresa> & { certificado_digital?: File; logo?: File }) => {
    // Always use multipart/form-data to support file uploads (certificado, logo)
    const fd = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      // Skip file fields that are already-saved URLs (strings) — only append actual File objects
      if (key === 'certificado_digital' || key === 'logo') {
        if (value != null && (value as unknown) instanceof File) fd.append(key, value as File);
        return;
      }
      if (value !== undefined && value !== null && value !== '') {
        fd.append(key, value as any);
      }
    });
    const response = await apiClient.patch<Empresa>(`/empresas/empresas/${id}/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/empresas/empresas/${id}/`);
  },

  getEstablecimientos: async () => {
    const { data } = await apiClient.get<{ results: EstablecimientoFiscal[] } | EstablecimientoFiscal[]>(
      '/empresas/establecimientos/',
    );
    return (Array.isArray(data) ? data : data.results) ?? [];
  },

  getPuntosEmision: async (establecimientoId?: number) => {
    const { data } = await apiClient.get<{ results: PuntoEmisionFiscal[] } | PuntoEmisionFiscal[]>(
      '/empresas/puntos-emision/',
      { params: establecimientoId ? { establecimiento: establecimientoId } : undefined },
    );
    return (Array.isArray(data) ? data : data.results) ?? [];
  },
};
