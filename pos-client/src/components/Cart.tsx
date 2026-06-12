import { useMemo, useState } from 'react';
import { usePOSStore } from '../store/posStore';

type DiscountMode = 'monto' | 'porcentaje' | 'precio_final';

const IVA_PCT: Record<string, number> = {
  '0': 0,
  '2': 12,
  '3': 14,
  '4': 15,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const getBruto = (cantidad: number, precioUnitario: number) => round2(cantidad * precioUnitario);

const clampDiscount = (descuento: number, bruto: number) => Math.max(0, Math.min(round2(descuento), bruto));

export default function Cart() {
  const items = usePOSStore((state) => state.items);
  const actualizarCantidad = usePOSStore((state) => state.actualizarCantidad);
  const aplicarDescuento = usePOSStore((state) => state.aplicarDescuento);
  const eliminarItem = usePOSStore((state) => state.eliminarItem);
  const getSubtotal = usePOSStore((state) => state.getSubtotal);
  const getDescuentoTotal = usePOSStore((state) => state.getDescuentoTotal);
  const getIVATotal = usePOSStore((state) => state.getIVATotal);
  const getTotal = usePOSStore((state) => state.getTotal);
  const [discountModeByItem, setDiscountModeByItem] = useState<Record<number, DiscountMode>>({});
  const [discountInputByItem, setDiscountInputByItem] = useState<Record<number, string>>({});
  const [finalPriceByItem, setFinalPriceByItem] = useState<Record<number, string>>({});

  const ivaSummary = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      const pct = IVA_PCT[item.porcentaje_iva] ?? 0;
      if (pct <= 0) continue;
      map.set(pct, round2((map.get(pct) ?? 0) + item.iva));
    }
    return map;
  }, [items]);

  const ivaRates = useMemo(() => [...ivaSummary.keys()].sort((a, b) => a - b), [ivaSummary]);

  const ivaLabel =
    ivaRates.length === 0
      ? 'IVA'
      : ivaRates.length === 1
        ? `IVA ${ivaRates[0]}%`
        : 'IVA (mixto)';

  const applyDiscountByMode = (item: (typeof items)[number], rawValue: string, mode: DiscountMode) => {
    const bruto = getBruto(item.cantidad, item.precio_unitario);
    const value = Number(rawValue || 0);
    let discount = 0;

    if (mode === 'monto') {
      discount = value;
    } else if (mode === 'porcentaje') {
      discount = (bruto * Math.max(0, value)) / 100;
    } else {
      const finalBase = Math.max(0, value);
      discount = bruto - finalBase;
    }

    aplicarDescuento(item.producto_id, clampDiscount(discount, bruto));
  };

  const handleChangeMode = (item: (typeof items)[number], mode: DiscountMode) => {
    const bruto = getBruto(item.cantidad, item.precio_unitario);
    setDiscountModeByItem((prev) => ({ ...prev, [item.producto_id]: mode }));

    if (mode === 'monto') {
      setDiscountInputByItem((prev) => ({ ...prev, [item.producto_id]: item.descuento.toFixed(2) }));
      return;
    }

    if (mode === 'porcentaje') {
      const pct = bruto > 0 ? round2((item.descuento / bruto) * 100) : 0;
      setDiscountInputByItem((prev) => ({ ...prev, [item.producto_id]: String(pct) }));
      return;
    }

    const finalBase = Math.max(0, bruto - item.descuento);
    setFinalPriceByItem((prev) => ({ ...prev, [item.producto_id]: finalBase.toFixed(2) }));
  };

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
              <p className="block text-xs text-gray-500 mb-1">Descuento (base sin IVA)</p>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {(['monto', 'porcentaje', 'precio_final'] as const).map((mode) => {
                  const current = discountModeByItem[item.producto_id] ?? 'monto';
                  const label = mode === 'monto' ? '$' : mode === 'porcentaje' ? '%' : 'Final';
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleChangeMode(item, mode)}
                      className={`text-[11px] py-1 rounded border transition ${
                        current === mode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {(discountModeByItem[item.producto_id] ?? 'monto') === 'monto' && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountInputByItem[item.producto_id] ?? item.descuento.toFixed(2)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDiscountInputByItem((prev) => ({ ...prev, [item.producto_id]: val }));
                    applyDiscountByMode(item, val, 'monto');
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  title={`Precio sin IVA: $${item.precio_unitario.toFixed(2)}`}
                />
              )}

              {(discountModeByItem[item.producto_id] ?? 'monto') === 'porcentaje' && (
                <>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={discountInputByItem[item.producto_id] ?? '0'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDiscountInputByItem((prev) => ({ ...prev, [item.producto_id]: val }));
                      applyDiscountByMode(item, val, 'porcentaje');
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.0"
                  />
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {[5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const val = String(pct);
                          setDiscountInputByItem((prev) => ({ ...prev, [item.producto_id]: val }));
                          applyDiscountByMode(item, val, 'porcentaje');
                        }}
                        className="text-[11px] py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </>
              )}

              {(discountModeByItem[item.producto_id] ?? 'monto') === 'precio_final' && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalPriceByItem[item.producto_id] ?? Math.max(0, getBruto(item.cantidad, item.precio_unitario) - item.descuento).toFixed(2)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFinalPriceByItem((prev) => ({ ...prev, [item.producto_id]: val }));
                    applyDiscountByMode(item, val, 'precio_final');
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={getBruto(item.cantidad, item.precio_unitario).toFixed(2)}
                  title="Monto final objetivo sin IVA"
                />
              )}
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
          <span className="text-gray-600">{ivaLabel}:</span>
          <span className="font-semibold">${getIVATotal().toFixed(2)}</span>
        </div>

        {ivaRates.length > 1 && (
          <div className="text-[11px] text-gray-500">
            {ivaRates.map((rate) => (
              <div key={rate} className="flex justify-between">
                <span>IVA {rate}%</span>
                <span>${(ivaSummary.get(rate) ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

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
