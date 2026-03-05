import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { usePOSStore } from '../../store/posStore';
import type { ClientePOS, PagoPOS } from '../../store/posStore';
import { posService } from '../../services/posService';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, CreditCard,
  Banknote, UserCheck, User, CheckCircle, Barcode, Package,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toFixed(2)}`;
const METODOS = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { value: 'TARJETA_CREDITO', label: 'T. Crédito', icon: CreditCard },
  { value: 'TARJETA_DEBITO', label: 'T. Débito', icon: CreditCard },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: CreditCard },
] as const;

// ─── Modal Selector de Cliente ─────────────────────────────────────────────
function ClienteSelectorModal({ onClose, onSelect }: { onClose: () => void; onSelect: (c: ClientePOS) => void }) {
  const [q, setQ] = useState('');
  const { data: clientes = [], isLoading, refetch } = useQuery({
    queryKey: ['pos-clientes', q],
    queryFn: () => posService.getClientes(q),
    enabled: true,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold">Seleccionar Cliente</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por nombre o cédula/RUC..."
              value={q}
              onChange={(e) => { setQ(e.target.value); refetch(); }}
            />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Cargando...</div>
            ) : clientes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No se encontraron clientes</div>
            ) : clientes.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); onClose(); }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <p className="font-semibold text-sm">{c.razon_social}</p>
                <p className="text-xs text-gray-500">{c.identificacion}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Cobro ────────────────────────────────────────────────────────
function CobroModal({
  onClose, cajaId,
}: { onClose: () => void; cajaId: number | null }) {
  const { items, cliente, getTotal, getSubtotal, getIVA, getDescuento, limpiarCarrito } = usePOSStore();
  const total = getTotal();

  const [pagos, setPagos] = useState<PagoPOS[]>([]);
  const [metodo, setMetodo] = useState<PagoPOS['metodo_pago']>('EFECTIVO');
  const [monto, setMonto] = useState(total.toFixed(2));
  const [exito, setExito] = useState<string | null>(null);

  // Si aún no se agregaron pagos manualmente, usar el monto/método actual como pago implícito
  const pagosEfectivos: PagoPOS[] = pagos.length > 0
    ? pagos
    : [{ metodo_pago: metodo, monto: parseFloat(monto) || 0 }];
  const totalPagado = pagosEfectivos.reduce((s, p) => s + p.monto, 0);
  // Redondear a 2 decimales para evitar errores de precisión flotante (ej: 11.200000001 - 11.20 > 0)
  const pendiente = Math.max(0, Math.round((total - totalPagado) * 100) / 100);
  const cambio = Math.max(0, Math.round((totalPagado - total) * 100) / 100);

  const mutation = useMutation({
    mutationFn: posService.crearVenta,
    onSuccess: (data) => {
      setExito(data.numero_venta ?? 'Venta registrada');
    },
  });

  const agregarPago = () => {
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) return;
    setPagos([...pagos, { metodo_pago: metodo, monto: m }]);
    setMonto('0');
  };

  const handleFinalizar = () => {
    if (!cliente || !cajaId) return;
    mutation.mutate({
      caja: cajaId,
      cliente: cliente.id,
      detalles: items,
      pagos: pagosEfectivos,
    });
  };

  if (exito) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">¡Venta Registrada!</h3>
          <p className="text-gray-500 mb-1">Número: <span className="font-mono font-bold">{exito}</span></p>
          {cambio > 0 && (
            <p className="text-2xl font-bold text-orange-600 mt-3">
              Cambio: {fmt(cambio)}
            </p>
          )}
          <button
            onClick={() => { limpiarCarrito(); onClose(); }}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-lg transition-colors"
          >
            Nueva Venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-xl font-bold">Procesar Cobro</h3>
            {cliente && (
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-medium text-gray-700">{cliente.razon_social}</span>
                <span className="ml-2 text-gray-400">{cliente.identificacion}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} disabled={mutation.isPending} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        {/* Totales */}
        <div className="p-5 bg-gray-50 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span><span>{fmt(getSubtotal())}</span></div>
          {getDescuento() > 0 && <div className="flex justify-between text-red-600"><span>Descuento:</span><span>-{fmt(getDescuento())}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">IVA:</span><span>{fmt(getIVA())}</span></div>
          <div className="flex justify-between text-xl font-bold border-t pt-2">
            <span>Total:</span><span className="text-blue-600">{fmt(total)}</span>
          </div>
          {totalPagado > 0 && (
            <>
              <div className="flex justify-between text-green-600 font-semibold"><span>Pagado:</span><span>{fmt(totalPagado)}</span></div>
              <div className={`flex justify-between font-bold ${pendiente > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                <span>Pendiente:</span><span>{fmt(pendiente)}</span>
              </div>
              {cambio > 0 && <div className="flex justify-between text-2xl font-bold text-orange-600"><span>CAMBIO:</span><span>{fmt(cambio)}</span></div>}
            </>
          )}
        </div>

        {/* Agregar pago */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetodo(m.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  metodo === m.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={agregarPago}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {/* Lista de pagos */}
          {pagos.length > 0 && (
            <div className="space-y-1">
              {pagos.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium">{p.metodo_pago.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-700">{fmt(p.monto)}</span>
                    <button onClick={() => setPagos(pagos.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {mutation.isError && (
          <p className="mx-5 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            Error registrando la venta. Verifica los datos.
          </p>
        )}

        <div className="p-5 border-t">
          {!cajaId && (
            <p className="text-center text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
              ⚠ Sin caja configurada — Ve a <strong>Configuración → Cajas</strong> y crea una caja primero.
            </p>
          )}
          {pendiente > 0 && totalPagado > 0 && (
            <p className="text-center text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
              Falta por pagar: <strong>{fmt(pendiente)}</strong>
            </p>
          )}
          <button
            onClick={handleFinalizar}
            disabled={pendiente > 0 || !cliente || !cajaId || mutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Registrando...' : `Finalizar Venta ${fmt(total)}`}
          </button>
          {!cliente && <p className="text-center text-xs text-amber-600 mt-2">⚠ Debes seleccionar un cliente primero</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal POS ─────────────────────────────────────────────────
export default function POSPage() {
  const navigate = useNavigate();
  const { items, cliente, setCliente, agregarItem, actualizarCantidad, eliminarItem, limpiarCarrito,
          getSubtotal, getIVA, getTotal } = usePOSStore();

  const [search, setSearch] = useState('');
  const [showCliente, setShowCliente] = useState(false);
  const [showCobro, setShowCobro] = useState(false);
  const [cajaId, setCajaId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cargar cajas al inicio
  useEffect(() => {
    posService.getCajas().then((cajas) => {
      if (cajas.length > 0) setCajaId(cajas[0].id);
    }).catch(() => {});
    searchRef.current?.focus();
  }, []);

  const { data: productos = [], isLoading, refetch } = useQuery({
    queryKey: ['pos-productos', search],
    queryFn: () => posService.getProductos(search),
    staleTime: 30000,
  });

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Si es código exacto, añadir directo
    const exact = productos.find(
      (p) => p.codigo_principal.toLowerCase() === search.toLowerCase()
    );
    if (exact) {
      agregarItem(exact);
      setSearch('');
      searchRef.current?.focus();
    } else {
      refetch();
    }
  }, [productos, search, agregarItem, refetch]);

  // Atajo F12 para cobrar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (items.length > 0 && cliente) setShowCobro(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items.length, cliente]);

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col" style={{ zIndex: 10 }}>
      {/* Top Bar */}
      <header className="bg-gray-900 text-white px-4 py-2 flex items-center gap-4 shadow-lg">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="Volver al admin"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <ShoppingCart size={22} className="text-blue-400" />
          <span className="font-bold text-lg">Punto de Venta</span>
        </div>

        {/* Búsqueda / código de barras */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg">
          <div className="relative">
            <Barcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escanear código de barras o buscar producto..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-800 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
            />
          </div>
        </form>

        {/* Cliente */}
        <button
          onClick={() => setShowCliente(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
            cliente ? 'bg-green-700 text-green-100' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          {cliente ? <UserCheck size={16} /> : <User size={16} />}
          <span className="hidden sm:inline">{cliente ? cliente.razon_social : 'Cliente'}</span>
        </button>

        {/* Limpiar */}
        {items.length > 0 && (
          <button
            onClick={() => { if (confirm('¿Limpiar carrito?')) limpiarCarrito(); }}
            className="p-2 bg-red-700 hover:bg-red-600 rounded-xl text-sm transition-colors"
            title="Vaciar carrito"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Panel izquierdo: Grid de productos ────────── */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : productos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Package size={40} className="mb-2 opacity-40" />
              <p>No hay productos. Verifica que existan productos activos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {productos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregarItem(p)}
                  className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:border-blue-400 hover:shadow-md transition-all active:scale-95 group"
                >
                  <div className="w-full aspect-square bg-blue-50 rounded-lg mb-2 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Package size={28} className="text-blue-400" />
                  </div>
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight mb-1">{p.nombre}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.codigo_principal}</p>
                  <p className="text-base font-bold text-blue-600 mt-1">{fmt(p.precio)}</p>
                  <p className="text-xs text-gray-400">Stock: {p.stock_actual}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Panel derecho: Carrito ─────────────────────── */}
        <div className="w-80 xl:w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl">
          {/* Cliente */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</span>
              <button onClick={() => setShowCliente(true)} className="text-xs text-blue-600 hover:underline font-medium">
                {cliente ? 'Cambiar' : '+ Seleccionar'}
              </button>
            </div>
            {cliente ? (
              <div className="mt-1">
                <p className="font-semibold text-sm text-gray-800">{cliente.razon_social}</p>
                <p className="text-xs text-gray-500">{cliente.identificacion}</p>
              </div>
            ) : (
              <p className="text-xs text-amber-600 mt-1 italic">Sin cliente seleccionado</p>
            )}
          </div>

          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <ShoppingCart size={40} className="mb-2" />
                <p className="text-sm">Carrito vacío</p>
                <p className="text-xs">Toca un producto para agregar</p>
              </div>
            ) : items.map((item) => (
              <div key={item.producto_id} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.codigo}</p>
                  </div>
                  <button onClick={() => eliminarItem(item.producto_id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <X size={15} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                      className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-10 text-center font-bold text-sm">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                      className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{fmt(item.precio_unitario)} c/u</p>
                    <p className="font-bold text-gray-800">{fmt(item.total)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totales + Botón cobrar */}
          <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{fmt(getSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA</span><span>{fmt(getIVA())}</span>
            </div>
            <div className="flex justify-between text-xl font-black border-t pt-2">
              <span>TOTAL</span>
              <span className="text-blue-600">{fmt(getTotal())}</span>
            </div>
            <button
              onClick={() => {
                if (!cliente) { setShowCliente(true); return; }
                if (items.length > 0) setShowCobro(true);
              }}
              disabled={items.length === 0}
              className="w-full mt-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white py-4 rounded-xl font-black text-xl transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg shadow-green-200"
            >
              {items.length === 0 ? 'Carrito vacío' : `COBRAR ${fmt(getTotal())}`}
            </button>
            <p className="text-center text-xs text-gray-400">{items.length} producto{items.length !== 1 ? 's' : ''} · F12 para cobrar</p>
          </div>
        </div>
      </div>

      {/* Modales */}
      {showCliente && <ClienteSelectorModal onClose={() => setShowCliente(false)} onSelect={setCliente} />}
      {showCobro && <CobroModal onClose={() => setShowCobro(false)} cajaId={cajaId} />}
    </div>
  );
}
