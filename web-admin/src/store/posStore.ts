import { create } from 'zustand';

export interface ProductoPOS {
  id: number;
  codigo_principal: string;
  nombre: string;
  precio: number;
  precio_con_iva?: number;
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
  precio_unitario_visual: number;
  descuento: number;
  subtotal: number;
  iva: number;
  total: number;
  porcentaje_iva: string;
  aplica_iva: boolean;
}

export interface PagoPOS {
  metodo_pago: 'EFECTIVO' | 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA' | 'CHEQUE';
  monto: number;
}

const IVA_RATES: Record<string, number> = {
  '0': 0, '2': 0.12, '4': 0.15, '6': 0, '7': 0,
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const calcIVA = (subtotal: number, pct: string) =>
  round2(subtotal * (IVA_RATES[pct] ?? 0.12));

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
      const sub = round2(newQty * item.precio_unitario);
      const iva = p.aplica_iva ? calcIVA(sub, p.porcentaje_iva) : 0;
      updated[idx] = { ...item, cantidad: newQty, subtotal: sub, iva, total: round2(sub + iva) };
      set({ items: updated });
    } else {
      const sub = round2(cantidad * p.precio);
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
            precio_unitario_visual: p.precio_con_iva ?? round2(p.precio * (1 + (IVA_RATES[p.porcentaje_iva] ?? 0))),
            descuento: 0,
            subtotal: sub,
            iva,
            total: round2(sub + iva),
            porcentaje_iva: p.porcentaje_iva,
            aplica_iva: p.aplica_iva,
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
        const sub = round2(cantidad * i.precio_unitario);
        const iva = i.aplica_iva ? calcIVA(sub, i.porcentaje_iva) : 0;
        return { ...i, cantidad, subtotal: sub, iva, total: round2(sub + iva) };
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
