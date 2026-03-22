import apiClient from './apiClient';
import type { Venta } from '../types';

export interface ProyeccionDia {
  fecha: string;
  total?: number;
  proyectado?: number;
}

export interface ProyeccionStock {
  producto_id: number;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  vendido_periodo: number;
  tasa_diaria: number;
  dias_hasta_agotamiento: number | null;
  maneja_inventario: boolean;
}

export interface ProyeccionesData {
  historico: { fecha: string; total: number }[];
  proyeccion: { fecha: string; proyectado: number }[];
  proyeccion_stock: ProyeccionStock[];
  promedio_diario: number;
  dias_historial: number;
}

export const ventasService = {
  getAll: async () => {
    const { data } = await apiClient.get('/ventas/ventas/');
    return Array.isArray(data) ? data : (data.results ?? []) as Venta[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Venta>(`/ventas/ventas/${id}/`);
    return response.data;
  },

  generarFactura: async (id: number) => {
    const { data } = await apiClient.post(`/ventas/ventas/${id}/generar_factura/`);
    return data;
  },

  getReporteDiario: async (fecha: string) => {
    const response = await apiClient.get(`/ventas/ventas/reporte_diario/?fecha=${fecha}`);
    return response.data;
  },

  getReporteMensual: async (mes: number, anio: number) => {
    const response = await apiClient.get(`/ventas/ventas/reporte_mensual/?mes=${mes}&anio=${anio}`);
    return response.data;
  },

  getReporteUltimosMeses: async (meses = 6): Promise<{ mes: number; anio: number; total_ventas: number; cantidad_ventas: number }[]> => {
    const { data } = await apiClient.get(`/ventas/ventas/reporte-ultimos-meses/?meses=${meses}`);
    return data;
  },

  getProyecciones: async (dias = 30, proyeccion = 14, ventana = 7): Promise<ProyeccionesData> => {
    const { data } = await apiClient.get(`/ventas/ventas/proyecciones/?dias=${dias}&proyeccion=${proyeccion}&ventana=${ventana}`);
    return data;
  },
};
