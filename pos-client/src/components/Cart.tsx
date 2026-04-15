import { usePOSStore } from '../store/posStore';

export default function Cart() {
  const items = usePOSStore((state) => state.items);
  const actualizarCantidad = usePOSStore((state) => state.actualizarCantidad);
  const aplicarDescuento = usePOSStore((state) => state.aplicarDescuento);
  const eliminarItem = usePOSStore((state) => state.eliminarItem);
  const getSubtotal = usePOSStore((state) => state.getSubtotal);
  const getDescuentoTotal = usePOSStore((state) => state.getDescuentoTotal);
  const getIVATotal = usePOSStore((state) => state.getIVATotal);
  const getTotal = usePOSStore((state) => state.getTotal);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
        <svg
          className="w-24 h-24 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-lg font-medium">Carrito vacío</p>
        <p className="text-sm mt-2">Escanea o busca productos para agregar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Lista de items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.producto_id}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">
                  {item.nombre}
                </p>
                <p className="text-xs text-gray-500">{item.codigo}</p>
              </div>
              <button
                onClick={() => eliminarItem(item.producto_id)}
                className="text-red-500 hover:text-red-700 ml-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between">
              {/* Control de cantidad */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                  className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold"
                >
                  −
                </button>
                <span className="w-12 text-center font-semibold">
                  {item.cantidad}
                </span>
                <button
                  onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                  className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold"
                >
                  +
                </button>
              </div>

              {/* Precio */}
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  ${item.precio_unitario.toFixed(2)} c/u
                </p>
                {item.descuento > 0 && (
                  <p className="text-xs text-red-500">Desc: -${item.descuento.toFixed(2)}</p>
                )}
                <p className="font-bold text-gray-800">
                  ${item.total.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-2">
              <p className="block text-xs text-gray-500 mb-1">Descuento</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.descuento}
                onChange={(e) => aplicarDescuento(item.producto_id, Number(e.target.value || 0))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="border-t border-gray-200 p-4 space-y-2 bg-gray-50">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-semibold">${getSubtotal().toFixed(2)}</span>
        </div>

        {getDescuentoTotal() > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Descuento:</span>
            <span className="font-semibold text-red-600">
              -${getDescuentoTotal().toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">IVA 12%:</span>
          <span className="font-semibold">${getIVATotal().toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
          <span>TOTAL:</span>
          <span className="text-blue-600">${getTotal().toFixed(2)}</span>
        </div>

        <div className="text-xs text-gray-500 text-center">
          {items.length} {items.length === 1 ? 'producto' : 'productos'}
        </div>
      </div>
    </div>
  );
}
