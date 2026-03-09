import apiClient from './apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Zona {
  id: number;
  empresa: number;
  nombre: string;
  descripcion?: string;
  orden: number;
  activa: boolean;
  mesas_count?: number;
}

export interface Mesa {
  id: number;
  empresa: number;
  zona: number | null;
  zona_nombre?: string | null;
  numero: string;
  nombre?: string;
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'RESERVADA';
  activa: boolean;
  pedido_activo_id?: number | null;
}

export interface DetallePedido {
  id: number;
  pedido: number;
  producto: number;
  producto_nombre?: string;
  producto_codigo?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  iva: number;
  notas?: string;
  estado: 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
  usuario: number;
  fecha_agregado: string;
}

export interface Pedido {
  id: number;
  numero_pedido: string;
  uuid: string;
  empresa: number;
  mesa: number | null;
  mesa_numero?: string | null;
  mesa_nombre?: string | null;
  zona_nombre?: string | null;
  caja: number | null;
  usuario: number;
  usuario_nombre?: string;
  cliente: number | null;
  cliente_nombre?: string | null;
  tipo: 'MESA' | 'MOSTRADOR' | 'PARA_LLEVAR' | 'DELIVERY';
  estado: 'ABIERTO' | 'EN_PREPARACION' | 'LISTO' | 'PAGADO' | 'CANCELADO';
  personas: number;
  observaciones?: string;
  subtotal: number;
  iva: number;
  total: number;
  venta: number | null;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  detalles: DetallePedido[];
  items_count?: number;
}

export interface PagoPayload {
  forma_pago: 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TRANSFERENCIA';
  monto: number;
  referencia?: string;
}

export interface CobrarPayload {
  caja_id: number;
  cliente_id: number;
  pagos: PagoPayload[];
  genera_factura?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const pedidosService = {
  // Zonas
  getZonas: async (): Promise<Zona[]> => {
    const { data } = await apiClient.get('/pedidos/zonas/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  createZona: async (payload: Partial<Zona>): Promise<Zona> => {
    const { data } = await apiClient.post('/pedidos/zonas/', payload);
    return data;
  },
  updateZona: async (id: number, payload: Partial<Zona>): Promise<Zona> => {
    const { data } = await apiClient.patch(`/pedidos/zonas/${id}/`, payload);
    return data;
  },
  deleteZona: async (id: number) => apiClient.delete(`/pedidos/zonas/${id}/`),

  // Mesas
  getMesas: async (params?: Record<string, string | number>): Promise<Mesa[]> => {
    const { data } = await apiClient.get('/pedidos/mesas/', { params });
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  createMesa: async (payload: Partial<Mesa>): Promise<Mesa> => {
    const { data } = await apiClient.post('/pedidos/mesas/', payload);
    return data;
  },
  updateMesa: async (id: number, payload: Partial<Mesa>): Promise<Mesa> => {
    const { data } = await apiClient.patch(`/pedidos/mesas/${id}/`, payload);
    return data;
  },
  deleteMesa: async (id: number) => apiClient.delete(`/pedidos/mesas/${id}/`),
  liberarMesa: async (id: number): Promise<Mesa> => {
    const { data } = await apiClient.post(`/pedidos/mesas/${id}/liberar/`);
    return data;
  },

  // Pedidos
  getPedidos: async (params?: Record<string, string | number>): Promise<Pedido[]> => {
    const { data } = await apiClient.get('/pedidos/pedidos/', { params });
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  getPedido: async (id: number): Promise<Pedido> => {
    const { data } = await apiClient.get(`/pedidos/pedidos/${id}/`);
    return data;
  },
  createPedido: async (payload: Partial<Pedido>): Promise<Pedido> => {
    const { data } = await apiClient.post('/pedidos/pedidos/', payload);
    return data;
  },
  cambiarEstadoPedido: async (id: number, estado: Pedido['estado']): Promise<Pedido> => {
    const { data } = await apiClient.patch(`/pedidos/pedidos/${id}/cambiar_estado/`, { estado });
    return data;
  },
  agregarItem: async (pedidoId: number, item: { producto: number; cantidad: number; precio_unitario: number; notas?: string }): Promise<DetallePedido> => {
    const { data } = await apiClient.post(`/pedidos/pedidos/${pedidoId}/agregar_item/`, item);
    return data;
  },
  eliminarItem: async (pedidoId: number, itemId: number) =>
    apiClient.delete(`/pedidos/pedidos/${pedidoId}/items/${itemId}/`),
  cobrar: async (pedidoId: number, payload: CobrarPayload) => {
    const { data } = await apiClient.post(`/pedidos/pedidos/${pedidoId}/cobrar/`, payload);
    return data;
  },

  // Items (para pantalla de cocina/barra)
  cambiarEstadoItem: async (itemId: number, estado: DetallePedido['estado']): Promise<DetallePedido> => {
    const { data } = await apiClient.patch(`/pedidos/items/${itemId}/cambiar_estado/`, { estado });
    return data;
  },
};
