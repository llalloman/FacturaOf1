import apiClient from './apiClient';

export interface ItemCotizacion {
  id?: number;
  cotizacion?: number;
  producto?: number | null;
  descripcion: string;
  codigo: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  tarifa_iva: number;
  precio_total_sin_impuesto?: number;
  valor_iva?: number;
}

export interface Cotizacion {
  id: number;
  empresa: number;
  cliente: number;
  cliente_nombre: string;
  creado_por?: number;
  creado_por_nombre?: string;
  numero: string;
  fecha_emision: string;
  fecha_validez?: string;
  dias_validez?: number;
  subtotal: number;
  descuento_total: number;
  subtotal_iva_0: number;
  subtotal_iva_12: number;
  subtotal_iva_15: number;
  iva: number;
  total: number;
  estado: 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | 'FACTURADA';
  observaciones: string;
  condiciones: string;
  factura?: number;
  created_at: string;
  updated_at: string;
  items?: ItemCotizacion[];
}

export interface CotizacionCreateData {
  cliente: number;
  numero?: string;
  fecha_emision: string;
  fecha_validez?: string;
  estado?: string;
  observaciones?: string;
  condiciones?: string;
  items: ItemCotizacion[];
}

const BASE = '/cotizaciones/cotizaciones';

export const cotizacionesService = {
  getAll: async (): Promise<Cotizacion[]> => {
    const res = await apiClient.get(`${BASE}/`);
    const data = res.data as Cotizacion[] | { results: Cotizacion[] };
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  get: async (id: number): Promise<Cotizacion> => {
    const res = await apiClient.get(`${BASE}/${id}/`);
    return res.data as Cotizacion;
  },

  create: async (data: CotizacionCreateData): Promise<Cotizacion> => {
    const res = await apiClient.post(`${BASE}/`, data);
    return res.data as Cotizacion;
  },

  update: async (id: number, data: CotizacionCreateData): Promise<Cotizacion> => {
    const res = await apiClient.put(`${BASE}/${id}/`, data);
    return res.data as Cotizacion;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}/`);
  },

  enviar: async (id: number) => {
    const res = await apiClient.post(`${BASE}/${id}/enviar/`);
    return res.data;
  },

  aceptar: async (id: number) => {
    const res = await apiClient.post(`${BASE}/${id}/aceptar/`);
    return res.data;
  },

  rechazar: async (id: number) => {
    const res = await apiClient.post(`${BASE}/${id}/rechazar/`);
    return res.data;
  },

  convertirFactura: async (id: number) => {
    const res = await apiClient.post(`${BASE}/${id}/convertir_factura/`);
    return res.data;
  },

  marcarFacturada: async (id: number, facturaId?: number) => {
    const res = await apiClient.post(`${BASE}/${id}/marcar_facturada/`, facturaId ? { factura_id: facturaId } : {});
    return res.data;
  },

  getResumen: async () => {
    const res = await apiClient.get(`${BASE}/resumen/`);
    return res.data;
  },
};
