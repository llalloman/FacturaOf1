import apiClient from './apiClient';
import type { CoherenciaFacturacionResponse, Factura, Venta } from '../types';

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

export interface RegularizacionVentaData {
  venta: { id: number; numero_venta: string; estado: string };
  pagos: Array<{
    id: number;
    forma_pago: string;
    monto: number;
    cuenta_bancaria: number | null;
    movimiento_bancario: number | null;
    requiere_cuenta: boolean;
  }>;
  detalles: Array<{
    id: number;
    producto: number;
    producto_nombre: string;
    tipo: 'BIEN' | 'SERVICIO';
    maneja_inventario: boolean;
    controla_stock: boolean;
    proveedor: number | null;
    bodega: number | null;
    costo_unitario: number;
    movimiento_inventario: number | null;
    inventario_invalido: boolean;
  }>;
  cuentas: Array<{ id: number; banco: string; numero_cuenta: string }>;
  proveedores: Array<{ id: number; razon_social: string; identificacion: string; empresa_id?: number }>;
  bodegas: Array<{ id: number; nombre: string; codigo: string }>;
}

export interface RegularizacionVentaPayload {
  pagos: Array<{ id: number; cuenta_bancaria: number | null }>;
  detalles: Array<{
    id: number;
    proveedor: number | null;
    bodega: number | null;
    costo_unitario: number;
    regularizar_inventario: boolean;
    retirar_inventario: boolean;
  }>;
}

type VentaQueryParams = Record<string, string | number | boolean | undefined | null>;

const fetchAllVentasPages = async (url: string, params?: VentaQueryParams): Promise<Venta[]> => {
  const all: Venta[] = [];
  let page = 1;

  while (true) {
    const { data } = await apiClient.get(url, { params: { ...params, page } });
    if (Array.isArray(data)) {
      return data as Venta[];
    }

    const chunk = (data?.results ?? []) as Venta[];
    all.push(...chunk);

    if (!data?.next) {
      break;
    }
    page += 1;
  }

  return all;
};

export const ventasService = {
  getAll: async (params?: VentaQueryParams) => {
    return fetchAllVentasPages('/ventas/ventas/', params);
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Venta>(`/ventas/ventas/${id}/`);
    return response.data;
  },

  getRegularizacion: async (id: number) => {
    const { data } = await apiClient.get<RegularizacionVentaData>(`/ventas/ventas/${id}/regularizacion/`);
    return data;
  },

  regularizar: async ({ id, payload }: { id: number; payload: RegularizacionVentaPayload }) => {
    const { data } = await apiClient.post<RegularizacionVentaData>(
      `/ventas/ventas/${id}/regularizacion/`,
      payload,
    );
    return data;
  },

  generarFactura: async ({ id, cliente_id }: { id: number; cliente_id?: number }) => {
    const body = cliente_id ? { cliente_id } : {};
    const { data } = await apiClient.post(`/ventas/ventas/${id}/generar_factura/`, body);
    return data;
  },

  actualizarFecha: async ({ id, fecha_venta }: { id: number; fecha_venta: string }) => {
    const { data } = await apiClient.post<Venta>(`/ventas/ventas/${id}/actualizar-fecha/`, { fecha_venta });
    return data;
  },

  getFacturasDisponibles: async (id: number, search = '') => {
    const { data } = await apiClient.get<Factura[]>(`/ventas/ventas/${id}/facturas-disponibles/`, { params: { search } });
    return data;
  },

  vincularFactura: async ({ id, factura }: { id: number; factura: number }) => {
    const { data } = await apiClient.post<Venta>(`/ventas/ventas/${id}/vincular-factura/`, { factura });
    return data;
  },

  getNotasVenta: async (params?: VentaQueryParams) => {
    return fetchAllVentasPages('/ventas/ventas/notas-venta/', params);
  },

  getNotaVentaById: async (id: number) => {
    const { data } = await apiClient.get(`/ventas/ventas/${id}/nota-venta/`);
    return data;
  },

  getCoherenciaFacturacion: async (params?: { solo_inconsistentes?: boolean; tolerancia?: number }) => {
    const { data } = await apiClient.get<CoherenciaFacturacionResponse>('/ventas/ventas/coherencia-facturacion/', { params });
    return data;
  },

  reconciliarFacturaVenta: async (id: number) => {
    const { data } = await apiClient.post(`/ventas/ventas/${id}/reconciliar-factura/`);
    return data;
  },

  reconciliarInconsistencias: async () => {
    const { data } = await apiClient.post('/ventas/ventas/reconciliar-inconsistencias/');
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
