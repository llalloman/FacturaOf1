import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Link2, PackageCheck, Save, X } from 'lucide-react';
import {
  ventasService,
  type RegularizacionVentaData,
  type RegularizacionVentaPayload,
} from '../../services/ventasService';
import { toast } from '../../store/toastStore';

interface Props {
  ventaId: number;
  onClose: () => void;
  onSaved: (data: RegularizacionVentaData) => void;
}

const pagoLabel: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta de débito',
  TARJETA_CREDITO: 'Tarjeta de crédito',
  CHEQUE: 'Cheque',
  CREDITO: 'Crédito',
};

export default function RegularizarVentaModal({ ventaId, onClose, onSaved }: Props) {
  const query = useQuery({
    queryKey: ['venta-regularizacion', ventaId],
    queryFn: () => ventasService.getRegularizacion(ventaId),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Regularizar vínculos</h2>
            <p className="text-sm text-gray-500">Venta {query.data?.venta.numero_venta || ''}</p>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="p-2 text-gray-500 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {query.isLoading && <div className="p-12 text-center text-gray-500">Cargando información...</div>}
        {query.isError && (
          <div className="p-12 text-center">
            <p className="text-red-600">No se pudo obtener el diagnóstico de la venta.</p>
            <button type="button" onClick={() => query.refetch()} className="mt-3 text-sm text-blue-600">Reintentar</button>
          </div>
        )}
        {query.data && (
          <RegularizacionForm data={query.data} ventaId={ventaId} onClose={onClose} onSaved={onSaved} />
        )}
      </div>
    </div>
  );
}

function RegularizacionForm({
  data,
  ventaId,
  onClose,
  onSaved,
}: {
  data: RegularizacionVentaData;
  ventaId: number;
  onClose: () => void;
  onSaved: (data: RegularizacionVentaData) => void;
}) {
  const queryClient = useQueryClient();
  const [pagos, setPagos] = useState(() => data.pagos.map(pago => ({
    id: pago.id,
    cuenta_bancaria: pago.cuenta_bancaria,
  })));
  const [detalles, setDetalles] = useState(() => data.detalles.map(detalle => ({
    id: detalle.id,
    proveedor: detalle.proveedor,
    bodega: detalle.bodega,
    costo_unitario: detalle.costo_unitario,
    regularizar_inventario: detalle.controla_stock && !detalle.movimiento_inventario,
    retirar_inventario: detalle.inventario_invalido,
  })));

  const mutation = useMutation({
    mutationFn: (payload: RegularizacionVentaPayload) => ventasService.regularizar({ id: ventaId, payload }),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['inventarios'] });
      toast.success('Venta regularizada correctamente.');
      onSaved(result);
    },
    onError: (error: unknown) => {
      const response = (error as { response?: { data?: { detail?: string } } }).response?.data;
      toast.error(response?.detail || 'No se pudo regularizar la venta.');
    },
  });

  const guardar = () => mutation.mutate({ pagos, detalles });

  return (
    <>
      <div className="space-y-8 p-6">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Landmark size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Destino de los cobros</h3>
          </div>
          <div className="divide-y border-y">
            {data.pagos.map(pago => {
              const form = pagos.find(item => item.id === pago.id)!;
              return (
                <div key={pago.id} className="grid gap-3 py-4 md:grid-cols-[1fr_1.5fr_auto] md:items-center">
                  <div>
                    <p className="font-medium text-gray-800">{pagoLabel[pago.forma_pago] || pago.forma_pago}</p>
                    <p className="text-sm text-gray-500">${Number(pago.monto).toFixed(2)}</p>
                  </div>
                  {pago.requiere_cuenta ? (
                    <select
                      value={form.cuenta_bancaria ?? ''}
                      disabled={Boolean(pago.movimiento_bancario)}
                      onChange={event => setPagos(current => current.map(item => item.id === pago.id
                        ? { ...item, cuenta_bancaria: event.target.value ? Number(event.target.value) : null }
                        : item))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">Seleccione una cuenta</option>
                      {data.cuentas.map(cuenta => (
                        <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} - {cuenta.numero_cuenta}</option>
                      ))}
                    </select>
                  ) : <span className="text-sm text-gray-500">Genera cuenta por cobrar</span>}
                  <span className={`text-xs font-medium ${pago.estado_pago === 'PAGADO' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {pago.estado_pago === 'PAGADO' ? 'Pagado' : pago.requiere_cuenta ? 'Pago pendiente' : 'Crédito pendiente'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Proveedor, costo e inventario</h3>
          </div>
          <div className="space-y-5">
            {data.detalles.map(detalle => {
              const form = detalles.find(item => item.id === detalle.id)!;
              return (
                <div key={detalle.id} className="border-b pb-5 last:border-b-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{detalle.producto_nombre}</p>
                      <p className="text-xs text-gray-500">
                        {detalle.tipo === 'SERVICIO' ? 'Servicio sin inventario' : detalle.controla_stock ? 'Bien con inventario' : 'Bien sin control de stock'}
                      </p>
                    </div>
                    {detalle.controla_stock && (
                      <span className={`text-xs font-medium ${detalle.movimiento_inventario ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {detalle.movimiento_inventario ? 'Stock descontado' : 'Stock pendiente'}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-medium text-gray-600">
                      Proveedor
                      <select
                        value={form.proveedor ?? ''}
                        onChange={event => setDetalles(current => current.map(item => item.id === detalle.id
                          ? { ...item, proveedor: event.target.value ? Number(event.target.value) : null }
                          : item))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
                      >
                        <option value="">Sin asignar</option>
                        {data.proveedores.map(proveedor => (
                          <option key={proveedor.id} value={proveedor.id}>
                            {proveedor.razon_social}{proveedor.identificacion ? ` - ${proveedor.identificacion}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      Costo unitario
                      <input
                        type="number"
                        min="0"
                        step="0.000001"
                        value={form.costo_unitario}
                        onChange={event => setDetalles(current => current.map(item => item.id === detalle.id
                          ? { ...item, costo_unitario: Number(event.target.value) }
                          : item))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    {detalle.controla_stock ? (
                      <label className="text-xs font-medium text-gray-600">
                        Bodega de salida
                        <select
                          value={form.bodega ?? ''}
                          onChange={event => setDetalles(current => current.map(item => item.id === detalle.id
                            ? { ...item, bodega: event.target.value ? Number(event.target.value) : null }
                            : item))}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
                        >
                          <option value="">Seleccione una bodega</option>
                          {data.bodegas.map(bodega => (
                            <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>
                          ))}
                        </select>
                      </label>
                    ) : <div className="self-end pb-2 text-xs text-gray-500">No requiere bodega</div>}
                  </div>
                  {detalle.controla_stock && !detalle.movimiento_inventario && (
                    <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.regularizar_inventario}
                        onChange={event => setDetalles(current => current.map(item => item.id === detalle.id
                          ? { ...item, regularizar_inventario: event.target.checked }
                          : item))}
                      />
                      <PackageCheck size={15} /> Registrar la salida de inventario pendiente
                    </label>
                  )}
                  {detalle.inventario_invalido && (
                    <label className="mt-3 flex items-center gap-2 text-sm text-red-700">
                      <input
                        type="checkbox"
                        checked={form.retirar_inventario}
                        onChange={event => setDetalles(current => current.map(item => item.id === detalle.id
                          ? { ...item, retirar_inventario: event.target.checked }
                          : item))}
                      />
                      Retirar el movimiento de stock incorrecto de este servicio o bien sin inventario
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm text-gray-700">Cancelar</button>
        <button
          type="button"
          onClick={guardar}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save size={16} /> {mutation.isPending ? 'Guardando...' : 'Guardar vínculos'}
        </button>
      </div>
    </>
  );
}
