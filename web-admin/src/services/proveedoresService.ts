import apiClient from './apiClient';
import type {
  Proveedor,
  ProveedorProducto,
  OrdenCompraCompra,
  RecepcionCompra,
  DetalleRecepcionCompra,
  Bodega,
} from '../types';

export type ProveedorProductoPayload = Pick<ProveedorProducto, 'proveedor' | 'producto' | 'codigo_proveedor' | 'costo_referencia' | 'dias_entrega' | 'es_preferido' | 'activo'>;

export interface CuentaPorPagarProveedor {
  id: number;
  uuid: string;
  proveedor: number;
  proveedor_nombre: string;
  recepcion: number | null;
  recepcion_numero: string | null;
  numero_cuenta: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_vencidos: number;
  monto_total: string | number;
  monto_pagado: string | number;
  saldo: string | number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA';
  notas: string;
  creado_en: string;
  actualizado_en: string;
}

export interface PagoProveedor {
  id: number;
  uuid: string;
  proveedor: number;
  proveedor_nombre: string;
  cuenta_por_pagar: number;
  cuenta_numero: string;
  numero_pago: string;
  fecha_pago: string;
  forma_pago: 'EFECTIVO' | 'CHEQUE' | 'TRANSFERENCIA' | 'TARJETA' | 'NOTA_CREDITO';
  monto: string | number;
  numero_documento: string;
  banco: string;
  cuenta_bancaria: number | null;
  movimiento_bancario: number | null;
  notas: string;
  registrado_por: number;
  registrado_por_nombre: string;
  creado_en: string;
  actualizado_en: string;
}

export interface PagoProveedorPayload {
  proveedor: number;
  cuenta_por_pagar: number;
  fecha_pago: string;
  forma_pago: PagoProveedor['forma_pago'];
  monto: number;
  numero_documento?: string;
  banco?: string;
  cuenta_bancaria?: number | null;
  notas?: string;
}

export interface RecepcionCompraPayload {
  orden_compra: number;
  bodega: number;
  fecha_recepcion: string;
  numero_factura_proveedor?: string;
  fecha_factura_proveedor?: string;
  notas?: string;
  detalles: Array<Pick<DetalleRecepcionCompra, 'detalle_orden' | 'cantidad_recibida' | 'costo_unitario' | 'numero_lote' | 'fecha_caducidad' | 'notas'>>;
}

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

  getOrdenes: async (params?: Record<string, unknown>): Promise<OrdenCompraCompra[]> => {
    const { data } = await apiClient.get('/proveedores/ordenes/', {
      params: { page_size: 200, ...params },
    });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getRecepciones: async (params?: Record<string, unknown>): Promise<RecepcionCompra[]> => {
    const { data } = await apiClient.get('/proveedores/recepciones/', {
      params: { page_size: 200, ...params },
    });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  createRecepcion: async (payload: RecepcionCompraPayload): Promise<RecepcionCompra> => {
    const { data } = await apiClient.post('/proveedores/recepciones/', payload);
    return data;
  },

  confirmarRecepcion: async (id: number): Promise<RecepcionCompra> => {
    const { data } = await apiClient.post(`/proveedores/recepciones/${id}/confirmar/`);
    return data;
  },

  getBodegas: async (): Promise<Bodega[]> => {
    const { data } = await apiClient.get('/inventarios/bodegas/', { params: { page_size: 200 } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getCuentasPorPagar: async (params?: Record<string, unknown>): Promise<CuentaPorPagarProveedor[]> => {
    const { data } = await apiClient.get('/proveedores/cuentas-por-pagar/', {
      params: { page_size: 500, ...params },
    });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getResumenCuentasPorPagar: async (): Promise<{
    total_deuda: string | number;
    cuentas_pendientes: number;
    cuentas_vencidas: number;
    total_vencido: string | number;
    por_vencer_7dias: number;
  }> => {
    const { data } = await apiClient.get('/proveedores/cuentas-por-pagar/resumen/');
    return data;
  },

  registrarPagoProveedor: async (payload: PagoProveedorPayload): Promise<PagoProveedor> => {
    const { data } = await apiClient.post('/proveedores/pagos/', payload);
    return data;
  },
};
