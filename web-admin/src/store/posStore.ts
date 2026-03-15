import { create } from 'zustand';

export interface ProductoPOS {
  id: number;
  codigo_principal: string;
  nombre: string;
  precio: number;
  costo: number;
  aplica_iva: boolean;
  porcentaje_iva: string;
  stock_actual: number;
  imagen?: string | null;
}

export interface ClientePOS {
  id: number;
  razon_social: string;
  identificacion: string;
  email?: string;
  telefono?: string;
}

export interface ItemCarrito {
  producto_id: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  iva: number;
  total: number;
}

export interface PagoPOS {
  metodo_pago: 'EFECTIVO' | 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA' | 'CHEQUE';
  monto: number;
}

const IVA_RATES: Record<string, number> = {
  '0': 0, '2': 0.12, '4': 0.15, '6': 0, '7': 0,
};

const calcIVA = (subtotal: number, pct: string) =>
  subtotal * (IVA_RATES[pct] ?? 0.12);

interface POSState {
  items: ItemCarrito[];
  cliente: ClientePOS | null;
  setCliente: (c: ClientePOS | null) => void;
  agregarItem: (p: ProductoPOS, cantidad?: number) => void;
  actualizarCantidad: (productoId: number, cantidad: number) => void;
  eliminarItem: (productoId: number) => void;
  limpiarCarrito: () => void;
  getSubtotal: () => number;
  getDescuento: () => number;
  getIVA: () => number;
  getTotal: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  items: [],
  cliente: null,

  setCliente: (c) => set({ cliente: c }),

  agregarItem: (p, cantidad = 1) => {
    const items = get().items;
    const idx = items.findIndex((i) => i.producto_id === p.id);
    if (idx >= 0) {
      const updated = [...items];
      const item = updated[idx];
      const newQty = item.cantidad + cantidad;
      const sub = newQty * item.precio_unitario;
      const iva = p.aplica_iva ? calcIVA(sub, p.porcentaje_iva) : 0;
      updated[idx] = { ...item, cantidad: newQty, subtotal: sub, iva, total: sub + iva };
      set({ items: updated });
    } else {
      const sub = cantidad * p.precio;
      const iva = p.aplica_iva ? calcIVA(sub, p.porcentaje_iva) : 0;
      set({
        items: [
          ...items,
          {
            producto_id: p.id,
            codigo: p.codigo_principal,
            nombre: p.nombre,
            cantidad,
            precio_unitario: p.precio,
            descuento: 0,
            subtotal: sub,
            iva,
            total: sub + iva,
          },
        ],
      });
    }
  },

  actualizarCantidad: (productoId, cantidad) => {
    if (cantidad <= 0) { get().eliminarItem(productoId); return; }
    set({
      items: get().items.map((i) => {
        if (i.producto_id !== productoId) return i;
        const sub = cantidad * i.precio_unitario;
        const iva = calcIVA(sub, '2');
        return { ...i, cantidad, subtotal: sub, iva, total: sub + iva };
      }),
    });
  },

  eliminarItem: (productoId) =>
    set({ items: get().items.filter((i) => i.producto_id !== productoId) }),

  limpiarCarrito: () => set({ items: [], cliente: null }),

  getSubtotal: () => get().items.reduce((s, i) => s + i.subtotal, 0),
  getDescuento: () => get().items.reduce((s, i) => s + i.descuento, 0),
  getIVA: () => get().items.reduce((s, i) => s + i.iva, 0),
  getTotal: () => get().items.reduce((s, i) => s + i.total, 0),
}));
