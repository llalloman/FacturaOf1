import apiClient from './apiClient';
import type { LoteInventario, MovimientoInventario } from '../types';

export const inventariosService = {
  getMovimientos: async () => {
    const { data } = await apiClient.get('/inventarios/movimientos/');
    return Array.isArray(data) ? data : (data.results ?? []) as MovimientoInventario[];
  },

  getMovimientoById: async (id: number) => {
    const response = await apiClient.get<MovimientoInventario>(`/inventarios/movimientos/${id}/`);
    return response.data;
  },

  createMovimiento: async (data: Partial<MovimientoInventario>) => {
    const response = await apiClient.post<MovimientoInventario>('/inventarios/movimientos/', data);
    return response.data;
  },

  getStockPorBodega: async () => {
    const { data } = await apiClient.get('/inventarios/stock/');
    return Array.isArray(data) ? data : (data.results ?? data);
  },

  getProductosBajoStock: async () => {
    const { data } = await apiClient.get('/inventarios/stock/alertas/');
    return Array.isArray(data) ? data : (data.results ?? data);
  },

  getLotes: async (params?: Record<string, unknown>) => {
    const { data } = await apiClient.get('/inventarios/lotes/', {
      params: { page_size: 500, ...params },
    });
    return (Array.isArray(data) ? data : (data.results ?? [])) as LoteInventario[];
  },

  getAlertasCaducidad: async (dias = 30) => {
    const { data } = await apiClient.get('/inventarios/lotes/alertas_caducidad/', {
      params: { dias },
    });
    return (Array.isArray(data) ? data : (data.results ?? [])) as LoteInventario[];
  },
};
