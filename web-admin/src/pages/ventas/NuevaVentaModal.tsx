import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { posService } from '../../services/posService';
import { getResumen, type CuentaBancaria } from '../../services/bancosService';
import type { ClientePOS, ItemCarrito, PagoPOS, ProductoPOS } from '../../store/posStore';
import { toast } from '../../store/toastStore';

type FormaPago = PagoPOS['metodo_pago'];

const IVA_RATES: Record<string, number> = {
  '0': 0,
  '2': 0.12,
  '4': 0.15,
  '6': 0,
  '7': 0,
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const calcIva = (subtotal: number, porcentaje: string) => round2(subtotal * (IVA_RATES[porcentaje] ?? 0.12));

const formaPagoLabels: Record<FormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'Tarjeta de crédito',
  TARJETA_DEBITO: 'Tarjeta de débito',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  CREDITO: 'Crédito',
};

interface NuevaVentaModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function NuevaVentaModal({ onClose, onCreated }: NuevaVentaModalProps) {
  const [clienteSearch, setClienteSearch] = useState('');
  const [productoSearch, setProductoSearch] = useState('');
  const [cliente, setCliente] = useState<ClientePOS | null>(null);
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [formaPago, setFormaPago] = useState<FormaPago>('TRANSFERENCIA');
  const [cuentaBancariaId, setCuentaBancariaId] = useState<number | ''>('');
  const [generaFactura, setGeneraFactura] = useState(true);

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-pos', clienteSearch],
    queryFn: () => posService.getClientes(clienteSearch),
  });

  const { data: productos = [], isLoading: loadingProductos } = useQuery({
    queryKey: ['productos-pos', productoSearch],
    queryFn: () => posService.getProductos(productoSearch),
  });

  const { data: cajas = [], isLoading: loadingCajas } = useQuery({
    queryKey: ['cajas-pos'],
    queryFn: posService.getCajas,
  });

  const { data: resumenBancos, isLoading: loadingCuentas } = useQuery({
    queryKey: ['bancos-resumen-venta'],
    queryFn: getResumen,
  });

  const cuentasActivas = useMemo(
    () => (resumenBancos?.cuentas ?? []).filter((cuenta: CuentaBancaria) => cuenta.activa),
    [resumenBancos]
  );
  const requiereCuenta = formaPago !== 'CREDITO';

  const subtotal = useMemo(() => round2(items.reduce((sum, item) => sum + item.subtotal, 0)), [items]);
  const descuento = useMemo(() => round2(items.reduce((sum, item) => sum + item.descuento, 0)), [items]);
  const iva = useMemo(() => round2(items.reduce((sum, item) => sum + item.iva, 0)), [items]);
  const total = useMemo(() => round2(items.reduce((sum, item) => sum + item.total, 0)), [items]);

  const crearVentaMutation = useMutation({
    mutationFn: async () => {
      const caja = cajas[0];
      if (!caja?.id) throw new Error('No existe una caja activa para registrar la venta.');
      if (!cliente?.id) throw new Error('Selecciona un cliente.');
      if (items.length === 0) throw new Error('Agrega al menos un producto o servicio.');
      if (total <= 0) throw new Error('El total de la venta debe ser mayor a cero.');
      if (requiereCuenta && !cuentaBancariaId) throw new Error('Selecciona la cuenta destino del pago.');

      return posService.crearVenta({
        caja: caja.id,
        cliente: cliente.id,
        detalles: items,
        pagos: [{
          metodo_pago: formaPago,
          monto: total,
          cuenta_bancaria: requiereCuenta ? Number(cuentaBancariaId) : null,
        }],
        genera_factura: generaFactura,
      });
    },
    onSuccess: () => {
      toast.success(generaFactura ? 'Venta creada. Se intentó generar la factura electrónica.' : 'Venta creada como nota de venta.');
      onCreated();
      onClose();
    },
    onError: (error: unknown) => {
      const responseError = error as { response?: { data?: unknown }; message?: string };
      const data = responseError.response?.data;
      const message = typeof data === 'string'
        ? data
        : data
          ? JSON.stringify(data)
          : responseError.message;
      toast.error(message || 'No se pudo crear la venta.');
    },
  });

  const recalcItem = (item: ItemCarrito, next: Partial<Pick<ItemCarrito, 'cantidad' | 'precio_unitario' | 'descuento'>>) => {
    const cantidad = Math.max(0, Number(next.cantidad ?? item.cantidad));
    const precio = Math.max(0, Number(next.precio_unitario ?? item.precio_unitario));
    const bruto = round2(cantidad * precio);
    const descuentoSeguro = Math.max(0, Math.min(round2(Number(next.descuento ?? item.descuento)), bruto));
    const subtotalNeto = round2(bruto - descuentoSeguro);
    const itemIva = item.aplica_iva ? calcIva(subtotalNeto, item.porcentaje_iva) : 0;
    return {
      ...item,
      cantidad,
      precio_unitario: precio,
      precio_unitario_visual: precio,
      descuento: descuentoSeguro,
      subtotal: subtotalNeto,
      iva: itemIva,
      total: round2(subtotalNeto + itemIva),
    };
  };

  const addProducto = (producto: ProductoPOS) => {
    setItems((current) => {
      const existing = current.find((item) => item.producto_id === producto.id);
      if (existing) {
        return current.map((item) =>
          item.producto_id === producto.id ? recalcItem(item, { cantidad: item.cantidad + 1 }) : item
        );
      }

      const base: ItemCarrito = {
        producto_id: producto.id,
        codigo: producto.codigo_principal,
        nombre: producto.nombre,
        cantidad: 1,
        precio_unitario: producto.precio,
        precio_unitario_visual: producto.precio_con_iva ?? producto.precio,
        descuento: 0,
        subtotal: producto.precio,
        iva: producto.aplica_iva ? calcIva(producto.precio, producto.porcentaje_iva) : 0,
        total: 0,
        porcentaje_iva: producto.porcentaje_iva,
        aplica_iva: producto.aplica_iva,
      };
      return [...current, { ...base, total: round2(base.subtotal + base.iva) }];
    });
  };

  const updateItem = (productoId: number, patch: Partial<Pick<ItemCarrito, 'cantidad' | 'precio_unitario' | 'descuento'>>) => {
    setItems((current) => current.map((item) => item.producto_id === productoId ? recalcItem(item, patch) : item));
  };

  const removeItem = (productoId: number) => {
    setItems((current) => current.filter((item) => item.producto_id !== productoId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nueva venta</h2>
            <p className="text-sm text-gray-500">Registra una venta administrativa para productos o servicios.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-6 xl:grid-cols-[0.9fr_1.4fr]">
          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Cliente</h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={clienteSearch}
                  onChange={(event) => setClienteSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-600"
                  placeholder="Buscar cliente por nombre o identificación"
                />
              </div>
              <div className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
                {loadingClientes ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : clientes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCliente(item);
                      setClienteSearch(item.razon_social);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${cliente?.id === item.id ? 'bg-blue-50' : ''}`}
                  >
                    <span className="font-medium text-gray-800">{item.razon_social}</span>
                    <span className="ml-2 font-mono text-xs text-gray-400">{item.identificacion}</span>
                  </button>
                ))}
                {!loadingClientes && clientes.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">No hay clientes activos.</p>}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Producto o servicio</h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={productoSearch}
                  onChange={(event) => setProductoSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-600"
                  placeholder="Buscar producto o servicio"
                />
              </div>
              <div className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
                {loadingProductos ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : productos.map((producto) => (
                  <button
                    key={producto.id}
                    type="button"
                    onClick={() => addProducto(producto)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <span>
                      <span className="font-medium text-gray-800">{producto.nombre}</span>
                      <span className="ml-2 font-mono text-xs text-gray-400">{producto.codigo_principal}</span>
                    </span>
                    <span className="font-semibold text-blue-700">${Number(producto.precio).toFixed(2)}</span>
                  </button>
                ))}
                {!loadingProductos && productos.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">No hay productos o servicios activos.</p>}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-700">Ítems de la venta</h3>
                <span className="text-xs text-gray-400">{items.length} ítem(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto/servicio</th>
                      <th className="px-3 py-2 text-right">Cant.</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                      <th className="px-3 py-2 text-right">Desc.</th>
                      <th className="px-3 py-2 text-right">IVA</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr key={item.producto_id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800">{item.nombre}</p>
                          <p className="font-mono text-xs text-gray-400">{item.codigo}</p>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.cantidad}
                            onChange={(event) => updateItem(item.producto_id, { cantidad: Number(event.target.value) })}
                            className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(event) => updateItem(item.producto_id, { precio_unitario: Number(event.target.value) })}
                            className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.descuento}
                            onChange={(event) => updateItem(item.producto_id, { descuento: Number(event.target.value) })}
                            className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">${item.iva.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">${item.total.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => removeItem(item.producto_id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar ítem">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">Agrega productos o servicios para crear la venta.</p>}
            </section>

            <section className="grid gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-[1fr_0.8fr]">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Forma de pago
                  <select
                    value={formaPago}
                    onChange={(event) => {
                      setFormaPago(event.target.value as FormaPago);
                      if (event.target.value === 'CREDITO') setCuentaBancariaId('');
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-600"
                  >
                    {Object.entries(formaPagoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {requiereCuenta && (
                  <label className="block text-sm font-medium text-gray-700">
                    Cuenta destino
                    <select
                      value={cuentaBancariaId}
                      onChange={(event) => setCuentaBancariaId(event.target.value ? Number(event.target.value) : '')}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">Seleccione cuenta</option>
                      {cuentasActivas.map((cuenta) => (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.banco} - {cuenta.numero_cuenta} ({cuenta.tipo})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  <input
                    type="checkbox"
                    checked={generaFactura}
                    onChange={(event) => setGeneraFactura(event.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Generar factura electrónica ahora
                </label>
                {(loadingCajas || loadingCuentas) && <p className="text-xs text-gray-400">Preparando datos financieros...</p>}
              </div>

              <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
                <TotalRow label="Subtotal" value={subtotal} />
                <TotalRow label="Descuento" value={descuento} negative />
                <TotalRow label="IVA" value={iva} />
                <div className="border-t border-gray-200 pt-2">
                  <TotalRow label="Total" value={total} strong />
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => crearVentaMutation.mutate()}
            disabled={crearVentaMutation.isPending || loadingCajas}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {crearVentaMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Crear venta
          </button>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, negative = false, strong = false }: { label: string; value: number; negative?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-bold text-gray-950' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className={negative && value > 0 ? 'text-red-600' : ''}>{negative && value > 0 ? '-' : ''}${value.toFixed(2)}</span>
    </div>
  );
}
