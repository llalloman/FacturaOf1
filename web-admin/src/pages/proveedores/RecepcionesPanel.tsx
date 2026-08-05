import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiClipboard, FiClock, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { proveedoresService, type RecepcionCompraPayload } from '../../services/proveedoresService';
import type { Bodega, OrdenCompraCompra, RecepcionCompra } from '../../types';
import { confirmDialog } from '../../store/confirmStore';

interface RecepcionDetalleForm {
  detalle_orden: number;
  producto_label: string;
  cantidad_pendiente: number;
  cantidad_recibida: string;
  costo_unitario: string;
  numero_lote: string;
  fecha_caducidad: string;
  notas: string;
}

interface RecepcionFormState {
  orden_compra: number;
  bodega: number;
  fecha_recepcion: string;
  numero_factura_proveedor: string;
  fecha_factura_proveedor: string;
  notas: string;
  detalles: RecepcionDetalleForm[];
}

const today = () => new Date().toISOString().slice(0, 10);

const estadoBadgeClass = (estado: string) => {
  if (estado === 'RECIBIDA') return 'bg-green-100 text-green-700 border border-green-200';
  if (estado === 'BORRADOR') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-gray-100 text-gray-700 border border-gray-200';
};

const RecepcionesPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrdenId, setSelectedOrdenId] = useState<number | null>(null);
  const [selectedRecepcionId, setSelectedRecepcionId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<RecepcionFormState>({
    orden_compra: 0,
    bodega: 0,
    fecha_recepcion: today(),
    numero_factura_proveedor: '',
    fecha_factura_proveedor: '',
    notas: '',
    detalles: [],
  });

  const { data: ordenes = [], isLoading: loadingOrdenes } = useQuery({
    queryKey: ['proveedores-ordenes'],
    queryFn: () => proveedoresService.getOrdenes(),
  });

  const { data: recepciones = [], isLoading: loadingRecepciones } = useQuery({
    queryKey: ['proveedores-recepciones'],
    queryFn: () => proveedoresService.getRecepciones(),
  });

  const { data: bodegas = [] } = useQuery({
    queryKey: ['inventarios-bodegas'],
    queryFn: () => proveedoresService.getBodegas(),
  });

  const ordenesPendientes = useMemo(
    () => ordenes.filter((orden) => ['ENVIADA', 'PARCIAL'].includes(orden.estado)),
    [ordenes]
  );

  const selectedOrden = useMemo(
    () => ordenes.find((orden) => orden.id === selectedOrdenId) ?? null,
    [ordenes, selectedOrdenId]
  );

  const selectedRecepcion = useMemo(
    () => recepciones.find((recepcion) => recepcion.id === selectedRecepcionId) ?? null,
    [recepciones, selectedRecepcionId]
  );

  const createRecepcionMutation = useMutation({
    mutationFn: (payload: RecepcionCompraPayload) => proveedoresService.createRecepcion(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores-recepciones'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-ordenes'] });
      setIsCreating(false);
      setSelectedOrdenId(null);
      setFormError(null);
      setForm({
        orden_compra: 0,
        bodega: 0,
        fecha_recepcion: today(),
        numero_factura_proveedor: '',
        fecha_factura_proveedor: '',
        notas: '',
        detalles: [],
      });
    },
  });

  const confirmarMutation = useMutation({
    mutationFn: (id: number) => proveedoresService.confirmarRecepcion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores-recepciones'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-ordenes'] });
    },
  });

  const handleSeleccionarOrden = (orden: OrdenCompraCompra) => {
    setSelectedOrdenId(orden.id);
    const bodegaDefault = form.bodega || orden.bodega_destino || (bodegas[0] as Bodega | undefined)?.id || 0;

    setForm({
      orden_compra: orden.id,
      bodega: bodegaDefault,
      fecha_recepcion: today(),
      numero_factura_proveedor: '',
      fecha_factura_proveedor: '',
      notas: '',
      detalles: orden.detalles
        .filter((detalle) => Number(detalle.cantidad_pendiente_recibir) > 0)
        .map((detalle) => ({
          detalle_orden: detalle.id,
          producto_label: `${detalle.producto_nombre ?? 'Producto'} (${detalle.producto_codigo ?? 'S/C'})`,
          cantidad_pendiente: Number(detalle.cantidad_pendiente_recibir),
          cantidad_recibida: String(detalle.cantidad_pendiente_recibir),
          costo_unitario: String(detalle.precio_unitario),
          numero_lote: '',
          fecha_caducidad: '',
          notas: '',
        })),
    });
    setFormError(null);
  };

  const updateDetalle = (detalleOrdenId: number, field: keyof RecepcionDetalleForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      detalles: prev.detalles.map((detalle) =>
        detalle.detalle_orden === detalleOrdenId ? { ...detalle, [field]: value } : detalle
      ),
    }));
  };

  const validateForm = () => {
    if (!form.orden_compra) return 'Seleccione una orden de compra.';
    if (!form.bodega) return 'Seleccione una bodega de recepción.';
    if (!form.fecha_recepcion) return 'La fecha de recepción es obligatoria.';
    if (!form.detalles.length) return 'No hay ítems pendientes para esta orden.';

    for (const detalle of form.detalles) {
      const cantidad = Number(detalle.cantidad_recibida);
      const costo = Number(detalle.costo_unitario);

      if (!(cantidad > 0)) {
        return `La cantidad recibida de ${detalle.producto_label} debe ser mayor a 0.`;
      }
      if (cantidad > detalle.cantidad_pendiente) {
        return `La cantidad recibida de ${detalle.producto_label} supera la cantidad pendiente.`;
      }
      if (!(costo >= 0)) {
        return `El costo unitario de ${detalle.producto_label} debe ser mayor o igual a 0.`;
      }
    }

    return null;
  };

  const handleSubmitRecepcion = () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload: RecepcionCompraPayload = {
      orden_compra: form.orden_compra,
      bodega: form.bodega,
      fecha_recepcion: form.fecha_recepcion,
      numero_factura_proveedor: form.numero_factura_proveedor || undefined,
      fecha_factura_proveedor: form.fecha_factura_proveedor || undefined,
      notas: form.notas || undefined,
      detalles: form.detalles
        .filter((detalle) => Number(detalle.cantidad_recibida) > 0)
        .map((detalle) => ({
          detalle_orden: detalle.detalle_orden,
          cantidad_recibida: Number(detalle.cantidad_recibida),
          costo_unitario: Number(detalle.costo_unitario),
          numero_lote: detalle.numero_lote || undefined,
          fecha_caducidad: detalle.fecha_caducidad || undefined,
          notas: detalle.notas || undefined,
        })),
    };

    createRecepcionMutation.mutate(payload);
  };

  const handleConfirmarRecepcion = async (recepcion: RecepcionCompra) => {
    if (recepcion.estado !== 'BORRADOR') return;
    if (await confirmDialog(`¿Confirmar la recepción ${recepcion.numero_recepcion}?`, 'Se generarán entradas de inventario y lotes.', 'warning')) {
      confirmarMutation.mutate(recepcion.id);
    }
  };

  const totalRecepciones = recepciones.length;
  const recepcionesBorrador = recepciones.filter((item) => item.estado === 'BORRADOR').length;
  const recepcionesConfirmadas = recepciones.filter((item) => item.estado === 'RECIBIDA').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Recepciones Totales</p>
          <p className="text-3xl font-bold text-gray-800">{totalRecepciones}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-amber-500">
          <p className="text-gray-600 text-sm">Borrador</p>
          <p className="text-3xl font-bold text-gray-800">{recepcionesBorrador}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Confirmadas</p>
          <p className="text-3xl font-bold text-gray-800">{recepcionesConfirmadas}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-800">Recepción de Compras</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['proveedores-ordenes'] });
                queryClient.invalidateQueries({ queryKey: ['proveedores-recepciones'] });
              }}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <FiRefreshCw /> Actualizar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating((prev) => !prev);
                setFormError(null);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-700 to-sky-500 text-white rounded-lg hover:from-blue-800 hover:to-sky-600"
            >
              <FiPlus /> {isCreating ? 'Cerrar formulario' : 'Nueva recepción'}
            </button>
          </div>
        </div>

        {isCreating && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bodega destino *</label>
                <select
                  value={form.bodega}
                  onChange={(event) => setForm((prev) => ({ ...prev, bodega: Number(event.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Seleccione bodega</option>
                  {bodegas.map((bodega) => (
                    <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha recepción *</label>
                <input
                  type="date"
                  value={form.fecha_recepcion}
                  onChange={(event) => setForm((prev) => ({ ...prev, fecha_recepcion: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Factura proveedor</label>
                <input
                  type="text"
                  value={form.numero_factura_proveedor}
                  onChange={(event) => setForm((prev) => ({ ...prev, numero_factura_proveedor: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="No. factura"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha factura</label>
                <input
                  type="date"
                  value={form.fecha_factura_proveedor}
                  onChange={(event) => setForm((prev) => ({ ...prev, fecha_factura_proveedor: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <input
                  type="text"
                  value={form.notas}
                  onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Observaciones generales"
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Órdenes pendientes</h3>
              {loadingOrdenes ? (
                <div className="text-sm text-gray-500">Cargando órdenes...</div>
              ) : ordenesPendientes.length === 0 ? (
                <div className="text-sm text-gray-500">No existen órdenes en estado ENVIADA o PARCIAL.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="text-left p-3">No. Orden</th>
                        <th className="text-left p-3">Proveedor</th>
                        <th className="text-left p-3">Estado</th>
                        <th className="text-right p-3">Total</th>
                        <th className="text-center p-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordenesPendientes.map((orden) => (
                        <tr key={orden.id} className="border-t">
                          <td className="p-3 font-medium">{orden.numero_orden}</td>
                          <td className="p-3">{orden.proveedor_nombre ?? '-'}</td>
                          <td className="p-3">{orden.estado}</td>
                          <td className="p-3 text-right">${Number(orden.total).toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSeleccionarOrden(orden)}
                              className="px-3 py-1 rounded-lg border border-sky-300 text-sky-700 hover:bg-sky-50"
                            >
                              Seleccionar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedOrden && (
              <div className="space-y-3">
                <div className="rounded-lg bg-white border border-sky-200 p-3 text-sm text-gray-700">
                  Orden seleccionada: <span className="font-semibold">{selectedOrden.numero_orden}</span> - {selectedOrden.proveedor_nombre ?? '-'}
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-sky-100 text-gray-700">
                        <th className="text-left p-3">Producto</th>
                        <th className="text-right p-3">Pendiente</th>
                        <th className="text-right p-3">Recibida</th>
                        <th className="text-right p-3">Costo</th>
                        <th className="text-left p-3">Lote</th>
                        <th className="text-left p-3">Caducidad</th>
                        <th className="text-left p-3">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.detalles.map((detalle) => (
                        <tr key={detalle.detalle_orden} className="border-t">
                          <td className="p-3">{detalle.producto_label}</td>
                          <td className="p-3 text-right">{detalle.cantidad_pendiente.toFixed(2)}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={detalle.cantidad_recibida}
                              onChange={(event) => updateDetalle(detalle.detalle_orden, 'cantidad_recibida', event.target.value)}
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-right"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={detalle.costo_unitario}
                              onChange={(event) => updateDetalle(detalle.detalle_orden, 'costo_unitario', event.target.value)}
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-right"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={detalle.numero_lote}
                              onChange={(event) => updateDetalle(detalle.detalle_orden, 'numero_lote', event.target.value)}
                              className="w-36 border border-gray-300 rounded-lg px-2 py-1"
                              placeholder="Ej: LT-2026-001"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="date"
                              value={detalle.fecha_caducidad}
                              onChange={(event) => updateDetalle(detalle.detalle_orden, 'fecha_caducidad', event.target.value)}
                              className="w-36 border border-gray-300 rounded-lg px-2 py-1"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={detalle.notas}
                              onChange={(event) => updateDetalle(detalle.detalle_orden, 'notas', event.target.value)}
                              className="w-44 border border-gray-300 rounded-lg px-2 py-1"
                              placeholder="Obs."
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmitRecepcion}
                disabled={createRecepcionMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                <FiClipboard /> {createRecepcionMutation.isPending ? 'Guardando...' : 'Guardar recepción'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Listado de recepciones</h3>
        {loadingRecepciones ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto" />
          </div>
        ) : recepciones.length === 0 ? (
          <div className="text-sm text-gray-500">Aún no existen recepciones registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700">No. Recepción</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Orden</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Proveedor</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Fecha</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Estado</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recepciones.map((recepcion) => (
                  <React.Fragment key={recepcion.id}>
                    <tr className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{recepcion.numero_recepcion}</td>
                      <td className="p-3">{recepcion.orden_numero ?? '-'}</td>
                      <td className="p-3">{recepcion.proveedor_nombre ?? '-'}</td>
                      <td className="p-3">{recepcion.fecha_recepcion}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${estadoBadgeClass(recepcion.estado)}`}>
                          {recepcion.estado}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRecepcionId((prev) => (prev === recepcion.id ? null : recepcion.id))}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {selectedRecepcionId === recepcion.id ? 'Ocultar detalle' : 'Ver detalle'}
                          </button>
                          {recepcion.estado === 'BORRADOR' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmarRecepcion(recepcion)}
                              disabled={confirmarMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-60"
                            >
                              <FiCheckCircle /> Confirmar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {selectedRecepcionId === recepcion.id && selectedRecepcion && (
                      <tr className="bg-sky-50/40">
                        <td colSpan={6} className="p-4">
                          <div className="overflow-x-auto rounded-lg border border-sky-100 bg-white">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-sky-50">
                                  <th className="text-left p-2">Producto</th>
                                  <th className="text-right p-2">Cantidad</th>
                                  <th className="text-right p-2">Costo</th>
                                  <th className="text-left p-2">Lote</th>
                                  <th className="text-left p-2">Caducidad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRecepcion.detalles.map((detalle, index) => (
                                  <tr key={`${recepcion.id}-${detalle.detalle_orden}-${index}`} className="border-t">
                                    <td className="p-2">{detalle.producto_nombre ?? '-'}</td>
                                    <td className="p-2 text-right">{Number(detalle.cantidad_recibida).toFixed(2)}</td>
                                    <td className="p-2 text-right">${Number(detalle.costo_unitario).toFixed(4)}</td>
                                    <td className="p-2">{detalle.numero_lote || '-'}</td>
                                    <td className="p-2">{detalle.fecha_caducidad || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 flex items-center gap-2">
        <FiClock /> Las recepciones en borrador no impactan inventario hasta confirmar.
      </div>
    </div>
  );
};

export default RecepcionesPanel;
