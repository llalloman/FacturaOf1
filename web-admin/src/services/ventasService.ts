import apiClient from './apiClient';
import type { Venta } from '../types';

export const ventasService = {
  getAll: async () => {
    const { data } = await apiClient.get('/ventas/ventas/');
    return Array.isArray(data) ? data : (data.results ?? []) as Venta[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Venta>(`/ventas/ventas/${id}/`);
    return response.data;
  },

  getReporteDiario: async (fecha: string) => {
    const response = await apiClient.get(`/ventas/ventas/reporte_diario/?fecha=${fecha}`);
    return response.data;
  },

  getReporteMensual: async (mes: number, anio: number) => {
    const response = await apiClient.get(`/ventas/ventas/reporte_mensual/?mes=${mes}&anio=${anio}`);
    return response.data;
  },
};
