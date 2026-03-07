import apiClient from '../lib/apiClient';
import type { ProductoPOS, ClientePOS, ItemCarrito, PagoPOS } from '../store/posStore';

export const posService = {
  getProductos: async (search = ''): Promise<ProductoPOS[]> => {
    const params = search ? { search } : {};
    const { data } = await apiClient.get('/productos/productos/', { params });
    const list: ProductoPOS[] = (data.results ?? data).map((p: Record<string, unknown>) => ({
      id: p.id as number,
      codigo_principal: p.codigo_principal as string,
      nombre: p.nombre as string,
      precio: parseFloat(p.precio as string),
      costo: parseFloat((p.costo as string) ?? '0'),
      aplica_iva: p.aplica_iva as boolean,
      porcentaje_iva: p.porcentaje_iva as string,
      stock_actual: parseFloat((p.stock_actual as string) ?? '0'),
    }));
    return list;
  },

  getClientes: async (search = ''): Promise<ClientePOS[]> => {
    const params = search ? { search } : {};
    const { data } = await apiClient.get('/clientes/', { params });
    const list = (data.results ?? data).map((c: Record<string, unknown>) => ({
      id: c.id as number,
      razon_social: (c.razon_social as string) ?? (c.nombres as string),
      identificacion: (c.identificacion as string) ?? '',
      email: c.email as string | undefined,
      telefono: c.telefono as string | undefined,
    }));
    return list;
  },

  crearVenta: async (payload: {
    caja: number;
    cliente: number;
    detalles: ItemCarrito[];
    pagos: PagoPOS[];
    genera_factura?: boolean;
  }) => {
    const body = {
      caja: payload.caja,
      cliente: payload.cliente,
      genera_factura: payload.genera_factura ?? true,
      detalles: payload.detalles.map((d) => ({
        producto: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: Math.round(d.precio_unitario * 100) / 100,
        descuento: Math.round(d.descuento * 100) / 100,
        subtotal: Math.round(d.subtotal * 100) / 100,
        iva: Math.round(d.iva * 100) / 100,
        total: Math.round(d.total * 100) / 100,
      })),
      pagos: payload.pagos.map((p) => ({
        ...p,
        monto: Math.round(p.monto * 100) / 100,
      })),
    };
    const { data } = await apiClient.post('/ventas/ventas/', body);
    return data;
  },

  crearCliente: async (data: {
    tipo_identificacion: string;
    identificacion: string;
    razon_social: string;
    email?: string;
    telefono?: string;
    direccion?: string;
  }): Promise<ClientePOS> => {
    const { data: res } = await apiClient.post('/clientes/', data);
    return {
      id: res.id,
      razon_social: res.razon_social,
      identificacion: res.identificacion,
      email: res.email,
      telefono: res.telefono,
    };
  },

  getCajas: async () => {
    const { data } = await apiClient.get('/ventas/cajas/');
    const cajas = data.results ?? data;
    // Si no hay cajas, crear una por defecto automáticamente
    if (Array.isArray(cajas) && cajas.length === 0) {
      try {
        const { data: nueva } = await apiClient.post('/ventas/cajas/init_default/');
        return [nueva];
      } catch {
        // Si falla (ej. SUPER_ADMIN sin empresa), devolver vacío
        return [];
      }
    }
    return cajas;
  },
};
