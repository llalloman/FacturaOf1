import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOSStore } from '../store/posStore';
import { Producto } from '../types';
import ProductList from '../components/ProductList';
import Cart from '../components/Cart';
import PaymentModal from '../components/PaymentModal';
import ClientSelector from '../components/ClientSelector';
import { toast } from '../store/toastStore';

export default function POSScreen() {
  const config = usePOSStore((state) => state.config);
  const items = usePOSStore((state) => state.items);
  const cliente = usePOSStore((state) => state.cliente);
  const agregarItem = usePOSStore((state) => state.agregarItem);
  const limpiarCarrito = usePOSStore((state) => state.limpiarCarrito);
  
  const [codigoBarras, setCodigoBarras] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in an input/textarea (except F-keys)
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    switch (e.key) {
      case 'F1':
        // F1 — Focus barcode/search input
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        break;

      case 'F2':
      case 'F12':
        // F2 / F12 — Open payment modal
        e.preventDefault();
        if (items.length > 0 && cliente) {
          setShowPaymentModal(true);
        } else if (items.length === 0) {
          toast.warning('No hay productos en el carrito');
        } else {
          toast.warning('Debe seleccionar un cliente');
          setShowClientSelector(true);
        }
        break;

      case 'F4':
        // F4 — Select/change client
        e.preventDefault();
        setShowClientSelector(true);
        break;

      case 'F5':
        // F5 — New sale (clear cart)
        e.preventDefault();
        if (items.length > 0) {
          if (window.confirm('¿Desea limpiar la venta actual?')) {
            limpiarCarrito();
            toast.info('Venta limpiada');
          }
        }
        break;

      case 'Escape':
        // Escape — Close modals
        e.preventDefault();
        if (showPaymentModal) setShowPaymentModal(false);
        else if (showClientSelector) setShowClientSelector(false);
        else inputRef.current?.focus();
        break;

      case '+':
      case '=':
        // + — Increase last item quantity
        if (!isInput && items.length > 0) {
          e.preventDefault();
          const last = items[items.length - 1];
          usePOSStore.getState().actualizarCantidad(last.producto_id, last.cantidad + 1);
        }
        break;

      case '-':
        // − — Decrease last item quantity
        if (!isInput && items.length > 0) {
          e.preventDefault();
          const last = items[items.length - 1];
          usePOSStore.getState().actualizarCantidad(last.producto_id, last.cantidad - 1);
        }
        break;

      case 'Delete':
        // Delete — Remove last item
        if (!isInput && items.length > 0) {
          e.preventDefault();
          const last = items[items.length - 1];
          usePOSStore.getState().eliminarItem(last.producto_id);
        }
        break;
    }
  }, [items, cliente, showPaymentModal, showClientSelector, limpiarCarrito]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    // Enfocar el input al cargar
    inputRef.current?.focus();
  }, []);

  const handleCodigoBarras = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!codigoBarras.trim()) return;

    try {
      // Buscar producto por código
      const result = await window.electron.productos.buscarPorCodigo({
        codigo: codigoBarras,
        empresaId: config?.empresa_id,
      });

      if (result.success && result.producto) {
        agregarItem(result.producto, 1);
        setCodigoBarras('');
        inputRef.current?.focus();
      } else {
        toast.warning('Producto no encontrado');
      }
    } catch (error) {
      console.error('Error buscando producto:', error);
      toast.error('Error buscando el producto');
    }
  };

  const handleFinalizarVenta = () => {
    if (items.length === 0) {
      toast.warning('No hay productos en el carrito');
      return;
    }

    if (!cliente) {
      toast.warning('Debe seleccionar un cliente');
      setShowClientSelector(true);
      return;
    }

    setShowPaymentModal(true);
  };

  return (
    <div className="h-[calc(100vh-48px)] flex relative pb-6">
      {/* Panel izquierdo - Búsqueda y productos */}
      <div className="flex-1 flex flex-col p-4 space-y-4">
        {/* Búsqueda por código de barras */}
        <form onSubmit={handleCodigoBarras} className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Escanea o ingresa código de barras..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Buscar
            </button>
          </div>
        </form>

        {/* Lista de productos */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
          <ProductList />
        </div>
      </div>

      {/* Panel derecho - Carrito y totales */}
      <div className="w-[400px] bg-white shadow-lg flex flex-col">
        {/* Cliente seleccionado */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Cliente:</span>
            <button
              onClick={() => setShowClientSelector(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {cliente ? 'Cambiar' : 'Seleccionar'}
            </button>
          </div>
          {cliente ? (
            <div className="text-sm">
              <p className="font-semibold text-gray-800">{cliente.razon_social}</p>
              <p className="text-gray-600">{cliente.identificacion}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Ningún cliente seleccionado</p>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-y-auto">
          <Cart />
        </div>

        {/* Botón finalizar venta */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleFinalizarVenta}
            disabled={items.length === 0}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            💳 Cobrar (F2)
          </button>
        </div>
      </div>

      {/* Barra de atajos de teclado */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-800 text-gray-300 text-xs px-4 py-1 flex gap-4">
        <span><kbd className="bg-gray-700 px-1 rounded">F1</kbd> Buscar</span>
        <span><kbd className="bg-gray-700 px-1 rounded">F2</kbd> Cobrar</span>
        <span><kbd className="bg-gray-700 px-1 rounded">F4</kbd> Cliente</span>
        <span><kbd className="bg-gray-700 px-1 rounded">F5</kbd> Nueva venta</span>
        <span><kbd className="bg-gray-700 px-1 rounded">+/-</kbd> Cantidad</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Del</kbd> Eliminar</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Esc</kbd> Cerrar</span>
      </div>

      {/* Modales */}
      {showPaymentModal && (
        <PaymentModal onClose={() => setShowPaymentModal(false)} />
      )}

      {showClientSelector && (
        <ClientSelector onClose={() => setShowClientSelector(false)} />
      )}
    </div>
  );
}
