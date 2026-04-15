import { create } from 'zustand';
import { Producto, DetalleVenta, Cliente, ConfigPOS } from '../types';

interface POSState {
  // Configuración
  config: ConfigPOS | null;
  setConfig: (config: ConfigPOS) => void;

  // Carrito de venta
  items: DetalleVenta[];
  cliente: Cliente | null;
  
  // Acciones del carrito
  agregarItem: (producto: Producto, cantidad: number) => void;
  actualizarCantidad: (productoId: number, cantidad: number) => void;
  eliminarItem: (productoId: number) => void;
  aplicarDescuento: (productoId: number, descuento: number) => void;
  limpiarCarrito: () => void;
  setCliente: (cliente: Cliente | null) => void;

  // Totales calculados
  getSubtotal: () => number;
  getDescuentoTotal: () => number;
  getIVATotal: () => number;
  getTotal: () => number;

  // Estado de sincronización
  sincronizando: boolean;
  ultimaSync: Date | null;
  pendienteSync: number;
  setSincronizando: (value: boolean) => void;
  setUltimaSync: (date: Date) => void;
  setPendienteSync: (count: number) => void;

  // Modo offline
  modoOffline: boolean;
  setModoOffline: (value: boolean) => void;
}

const calcularIVA = (subtotal: number, porcentajeIva: string): number => {
  const porcentajes: Record<string, number> = {
    '0': 0,
    '2': 0.12,  // 12%
    '3': 0.14,  // 14%
    '4': 0.15,  // 15%
  };
  return subtotal * (porcentajes[porcentajeIva] || 0);
};

const calcularSubtotalNeto = (cantidad: number, precioUnitario: number, descuento: number): { subtotal: number; descuento: number } => {
  const subtotalBruto = cantidad * precioUnitario;
  const descuentoSeguro = Math.max(0, Math.min(descuento, subtotalBruto));
  return {
    subtotal: subtotalBruto - descuentoSeguro,
    descuento: descuentoSeguro,
  };
};

export const usePOSStore = create<POSState>((set, get) => ({
  // Estado inicial
  config: null,
  items: [],
  cliente: null,
  sincronizando: false,
  ultimaSync: null,
  pendienteSync: 0,
  modoOffline: false,

  // Configuración
  setConfig: (config) => set({ config }),

  // Agregar producto al carrito
  agregarItem: (producto, cantidad) => {
    const items = get().items;
    const existente = items.find((i) => i.producto_id === producto.id);

    if (existente) {
      // Actualizar cantidad si ya existe
      set({
        items: items.map((i) =>
          i.producto_id === producto.id
            ? {
                ...i,
                ...(() => {
                  const nuevaCantidad = i.cantidad + cantidad;
                  const { subtotal, descuento } = calcularSubtotalNeto(nuevaCantidad, i.precio_unitario, i.descuento);
                  const iva = calcularIVA(subtotal, producto.porcentaje_iva);
                  return {
                    cantidad: nuevaCantidad,
                    descuento,
                    subtotal,
                    iva,
                    total: subtotal + iva,
                  };
                })(),
              }
            : i
        ),
      });
    } else {
      // Agregar nuevo item
      const { subtotal, descuento } = calcularSubtotalNeto(cantidad, producto.precio, 0);
      const iva = producto.aplica_iva ? calcularIVA(subtotal, producto.porcentaje_iva) : 0;
      
      set({
        items: [
          ...items,
          {
            producto_id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            cantidad,
            precio_unitario: producto.precio,
            descuento,
            subtotal,
            iva,
            total: subtotal + iva,
            costo_unitario: producto.costo,
            porcentaje_iva: producto.porcentaje_iva,
          },
        ],
      });
    }
  },

  // Actualizar cantidad
  actualizarCantidad: (productoId, cantidad) => {
    if (cantidad <= 0) {
      get().eliminarItem(productoId);
      return;
    }

    set({
      items: get().items.map((i) => {
        if (i.producto_id === productoId) {
          const { subtotal, descuento } = calcularSubtotalNeto(cantidad, i.precio_unitario, i.descuento);
          const iva = calcularIVA(subtotal, i.porcentaje_iva);
          
          return {
            ...i,
            cantidad,
            descuento,
            subtotal,
            iva,
            total: subtotal + iva,
          };
        }
        return i;
      }),
    });
  },

  // Eliminar item
  eliminarItem: (productoId) => {
    set({ items: get().items.filter((i) => i.producto_id !== productoId) });
  },

  // Aplicar descuento
  aplicarDescuento: (productoId, descuento) => {
    set({
      items: get().items.map((i) => {
        if (i.producto_id === productoId) {
          const { subtotal, descuento: descuentoSeguro } = calcularSubtotalNeto(i.cantidad, i.precio_unitario, descuento);
          const iva = calcularIVA(subtotal, i.porcentaje_iva);
          
          return {
            ...i,
            descuento: descuentoSeguro,
            subtotal,
            iva,
            total: subtotal + iva,
          };
        }
        return i;
      }),
    });
  },

  // Limpiar carrito
  limpiarCarrito: () => set({ items: [], cliente: null }),

  // Cliente
  setCliente: (cliente) => set({ cliente }),

  // Cálculos
  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getDescuentoTotal: () => {
    return get().items.reduce((sum, item) => sum + item.descuento, 0);
  },

  getIVATotal: () => {
    return get().items.reduce((sum, item) => sum + item.iva, 0);
  },

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.total, 0);
  },

  // Sincronización
  setSincronizando: (value) => set({ sincronizando: value }),
  setUltimaSync: (date) => set({ ultimaSync: date }),
  setPendienteSync: (count) => set({ pendienteSync: count }),

  // Modo offline
  setModoOffline: (value) => set({ modoOffline: value }),
}));
