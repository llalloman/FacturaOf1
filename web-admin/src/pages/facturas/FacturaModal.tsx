import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiPlus, FiTrash2, FiX } from 'react-icons/fi';

import { facturasService } from '../../services/facturasService';
import { clientesService } from '../../services/clientesService';
import { productosService } from '../../services/productosService';
import type { Factura, DetalleFactura } from '../../types';

type FacturaModalMode = 'create' | 'edit' | 'duplicate';

interface FacturaModalProps {
  factura: Factura | null;
  mode?: FacturaModalMode;
  onClose: () => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

const normalizeDate = (value?: string) => {
  if (!value) return todayISO();
  return value.split('T')[0].split(' ')[0];
};

const mapDetalles = (factura: Factura | null): DetalleFactura[] => {
  if (!factura?.detalles?.length) return [];

  return factura.detalles.map((d) => {
    const raw = d as DetalleFactura & { precio_total_sin_impuesto?: number; valor_impuesto?: number };
    const subtotal = Number(raw.subtotal ?? raw.precio_total_sin_impuesto ?? 0);
    const impuestos = Number(raw.impuestos ?? raw.valor_impuesto ?? 0);

    return {
      id: raw.id,
      producto: raw.producto,
      producto_nombre: raw.producto_nombre ?? '',
      cantidad: Number(raw.cantidad),
      precio_unitario: Number(raw.precio_unitario),
      descuento: Number(raw.descuento ?? 0),
      subtotal,
      impuestos,
      total: subtotal + impuestos,
    };
  });
};

const FacturaModal: React.FC<FacturaModalProps> = ({ factura, mode, onClose }) => {
  const modalMode: FacturaModalMode = mode ?? (factura ? 'edit' : 'create');
  const isEdit = modalMode === 'edit' && !!factura;
  const isDuplicate = modalMode === 'duplicate';
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cliente: factura?.cliente || 0,
    fecha_emision: isDuplicate ? todayISO() : normalizeDate(factura?.fecha_emision),
    total_descuento: factura?.total_descuento ? String(factura.total_descuento) : '',
  });
  const [detalles, setDetalles] = useState<DetalleFactura[]>(() => mapDetalles(factura));
  const [productoSeleccionado, setProductoSeleccionado] = useState(0);
  const [cantidad, setCantidad] = useState('');

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: clientesService.getActivos,
  });

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => productosService.getAll({ activo: true }),
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (isEdit) {
        return facturasService.update(factura.id, data);
      }
      return facturasService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: (error: unknown) => {
      const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg =
        typeof data?.error === 'string' ? data.error :
        typeof data?.detail === 'string' ? data.detail :
        typeof data?.non_field_errors === 'string' ? data.non_field_errors :
        Array.isArray(data?.non_field_errors) ? (data.non_field_errors as string[]).join(' ') :
        'Error al guardar la factura. Verifica los datos e intenta de nuevo.';
      setErrorMsg(msg);
    },
  });

  const clientesArray = Array.isArray(clientes) ? clientes : [];
  const productosArray = Array.isArray(productos) ? productos : [];

  const agregarDetalle = () => {
    const producto = productosArray.find((p) => p.id === productoSeleccionado);
    const cantidadNum = parseFloat(cantidad) || 0;
    if (!producto || cantidadNum <= 0) return;

    const precio_unitario = Number(producto.precio);
    const subtotal = round2(precio_unitario * cantidadNum);
    const IVA_PCT: Record<string, number> = { '0': 0, '2': 12, '3': 14, '4': 15, '6': 0, '7': 0 };
    const ivaRate = producto.aplica_iva ? (IVA_PCT[producto.porcentaje_iva] ?? 15) : 0;
    const impuestos = round2(subtotal * (ivaRate / 100));
    const total = round2(subtotal + impuestos);

    setDetalles([
      ...detalles,
      {
        producto: producto.id,
        producto_nombre: producto.nombre,
        cantidad: cantidadNum,
        precio_unitario,
        descuento: 0,
        subtotal,
        impuestos,
        total,
      },
    ]);
    setProductoSeleccionado(0);
    setCantidad('');
  };

  const eliminarDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    const subtotal = round2(detalles.reduce((sum, d) => sum + Number(d.subtotal || 0), 0));
    const impuestos = round2(detalles.reduce((sum, d) => sum + Number(d.impuestos || 0), 0));
    const descuento = round2(parseFloat(formData.total_descuento) || 0);
    const total = round2(subtotal + impuestos - descuento);
    return { subtotal, impuestos, descuento, total };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    mutation.mutate({
      cliente: formData.cliente,
      fecha_emision_input: formData.fecha_emision,
      total_descuento: parseFloat(formData.total_descuento) || 0,
      detalles_input: detalles.map(({ id: _id, ...detalle }) => detalle),
    });
  };

  const title =
    modalMode === 'duplicate'
      ? 'Duplicar factura'
      : isEdit
        ? 'Editar borrador'
        : 'Nueva factura';
  const subtitle =
    modalMode === 'duplicate'
      ? `Copia basada en ${factura?.numero_factura ?? 'la factura seleccionada'}. Se guardará como borrador.`
      : isEdit
        ? 'Revisa la información antes de enviar al SRI.'
        : 'Crea un borrador y envíalo al SRI cuando esté revisado.';
  const submitText = mutation.isPending ? 'Guardando...' : isEdit ? 'Actualizar borrador' : 'Guardar borrador';
  const totales = calcularTotales();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 p-3 sm:p-5">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-xl bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">{title}</h2>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Borrador
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar"
          >
            <FiX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-950">Datos de emisión</h3>
                    <p className="mt-1 text-sm text-slate-500">Selecciona el cliente y confirma la fecha del comprobante.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Cliente *</label>
                      <select
                        value={formData.cliente}
                        onChange={(e) => setFormData({ ...formData, cliente: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value={0}>Seleccione un cliente</option>
                        {clientesArray.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.razon_social}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Fecha emisión *</label>
                      <input
                        type="date"
                        value={formData.fecha_emision}
                        onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">Productos y servicios</h3>
                      <p className="mt-1 text-sm text-slate-500">Agrega, revisa o elimina líneas antes de guardar el borrador.</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{detalles.length} línea(s)</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Producto</label>
                      <select
                        value={productoSeleccionado}
                        onChange={(e) => setProductoSeleccionado(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={0}>Seleccione un producto</option>
                        {productosArray.map((producto) => (
                          <option key={producto.id} value={producto.id}>
                            {producto.nombre} - ${Number(producto.precio_con_iva ?? producto.precio).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Cantidad</label>
                      <input
                        type="number"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        min="1"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={agregarDetalle}
                      className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700"
                      aria-label="Agregar producto"
                    >
                      <FiPlus />
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                    {detalles.length === 0 ? (
                      <div className="px-4 py-12 text-center text-sm text-slate-400">Agrega al menos un producto o servicio.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                            <th className="px-4 py-3 text-left">Producto</th>
                            <th className="px-4 py-3 text-center">Cantidad</th>
                            <th className="px-4 py-3 text-right">P. Unit</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                            <th className="px-4 py-3 text-right">IVA</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detalles.map((detalle, index) => (
                            <tr key={`${detalle.producto}-${index}`} className="bg-white">
                              <td className="min-w-[260px] px-4 py-3 font-medium text-slate-900">{detalle.producto_nombre}</td>
                              <td className="px-4 py-3 text-center text-slate-700">{detalle.cantidad}</td>
                              <td className="px-4 py-3 text-right text-slate-700">${Number(detalle.precio_unitario).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-slate-700">${Number(detalle.subtotal).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-slate-700">${Number(detalle.impuestos).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-950">${Number(detalle.total).toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => eliminarDetalle(index)}
                                  className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 hover:text-rose-800"
                                  aria-label="Eliminar línea"
                                >
                                  <FiTrash2 />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </div>

              <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">Resumen</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4 text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-950">${totales.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-slate-600">
                      <span>IVA</span>
                      <span className="font-medium text-slate-950">${totales.impuestos.toFixed(2)}</span>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Descuento</label>
                      <input
                        type="number"
                        value={formData.total_descuento}
                        onChange={(e) => setFormData({ ...formData, total_descuento: e.target.value })}
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex items-end justify-between gap-4">
                        <span className="text-sm font-semibold uppercase text-slate-500">Total</span>
                        <span className="text-3xl font-bold text-blue-700">${totales.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="flex gap-3">
                    <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">El envío al SRI es manual</p>
                      <p className="mt-1 leading-5">
                        Al guardar se crea un borrador. Revisa cliente, fecha, productos e impuestos antes de enviarlo.
                      </p>
                    </div>
                  </div>
                </section>

                {isDuplicate ? (
                  <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    <p className="font-semibold">Copia segura</p>
                    <p className="mt-1 leading-5">
                      No se copiarán clave de acceso, autorización ni estado SRI de la factura original.
                    </p>
                  </section>
                ) : null}
              </aside>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {errorMsg ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {errorMsg}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Guarda el borrador y envíalo al SRI desde el listado cuando esté revisado.</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending || detalles.length === 0}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitText}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FacturaModal;
