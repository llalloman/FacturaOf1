import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guiasService } from '../../services/guiasService';
import type { GuiaRemision, DestinatarioGuia, DetalleGuia } from '../../types';
import { FiPlus, FiSearch, FiSend, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { Truck } from 'lucide-react';

const estadoColor = (estado: string) => {
  switch (estado) {
    case 'AUTORIZADO':    return 'text-green-600 bg-green-50';
    case 'BORRADOR':      return 'text-yellow-600 bg-yellow-50';
    case 'ENVIADO':       return 'text-blue-600 bg-blue-50';
    case 'RECHAZADO':
    case 'NO_AUTORIZADO': return 'text-red-600 bg-red-100';
    default:              return 'text-gray-600 bg-gray-50';
  }
};

const emptyDetalle = (): DetalleGuia => ({
  codigo_interno: '',
  descripcion: '',
  cantidad: 1,
});

const emptyDestinatario = (): DestinatarioGuia => ({
  identificacion_destinatario: '',
  razon_social_destinatario: '',
  dir_dest_destinatario: '',
  motorista_y_ca: 'Venta',
  ruta: '',
  cod_doc_sustento: '01',
  num_doc_sustento: '',
  fecha_emision_doc_sust: '',
  num_autorizacion_doc_sust: '',
  detalles: [emptyDetalle()],
});

const GuiasRemisionPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  // ── Form state ───────────────────────────────────────────────────────────────
  const [formRuc, setFormRuc]           = useState('');
  const [formRazon, setFormRazon]       = useState('');
  const [formPlaca, setFormPlaca]       = useState('');
  const [formFechaEmision, setFormFechaEmision] = useState(today);
  const [formFechaInicio, setFormFechaInicio]   = useState(today);
  const [formFechaFin, setFormFechaFin]         = useState(today);
  const [formDirPartida, setFormDirPartida]     = useState('');
  const [formDestinatarios, setFormDestinatarios] = useState<(DestinatarioGuia & { detalles: DetalleGuia[] })[]>([
    emptyDestinatario() as DestinatarioGuia & { detalles: DetalleGuia[] },
  ]);
  const [formError, setFormError] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: guias = [], isLoading } = useQuery({
    queryKey: ['guias-remision'],
    queryFn: guiasService.getAll,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: guiasService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guias-remision'] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string; error?: string } } })
        ?.response?.data?.detail
        || (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al crear guía';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: guiasService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guias-remision'] }),
  });

  const enviarSRIMutation = useMutation({
    mutationFn: guiasService.enviarSRI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guias-remision'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string; mensaje?: string } } })
        ?.response?.data?.error
        || (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        || 'Error al enviar';
      alert(msg);
    },
  });

  const reprocesarMutation = useMutation({
    mutationFn: guiasService.reprocesar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guias-remision'] }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormRuc(''); setFormRazon(''); setFormPlaca('');
    setFormFechaEmision(today); setFormFechaInicio(today); setFormFechaFin(today);
    setFormDirPartida('');
    setFormDestinatarios([emptyDestinatario() as DestinatarioGuia & { detalles: DetalleGuia[] }]);
    setFormError('');
  };

  const addDestinatario = () => {
    setFormDestinatarios(prev => [...prev, emptyDestinatario() as DestinatarioGuia & { detalles: DetalleGuia[] }]);
  };

  const removeDestinatario = (idx: number) => {
    setFormDestinatarios(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDestinatario = (idx: number, field: string, value: string) => {
    setFormDestinatarios(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addDetalle = (destIdx: number) => {
    setFormDestinatarios(prev => prev.map((d, i) =>
      i === destIdx ? { ...d, detalles: [...(d.detalles || []), emptyDetalle()] } : d
    ));
  };

  const removeDetalle = (destIdx: number, detIdx: number) => {
    setFormDestinatarios(prev => prev.map((d, i) =>
      i === destIdx ? { ...d, detalles: (d.detalles || []).filter((_, j) => j !== detIdx) } : d
    ));
  };

  const updateDetalle = (destIdx: number, detIdx: number, field: string, value: string | number) => {
    setFormDestinatarios(prev => prev.map((d, i) =>
      i === destIdx
        ? {
            ...d,
            detalles: (d.detalles || []).map((det, j) =>
              j === detIdx ? { ...det, [field]: value } : det
            ),
          }
        : d
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formRuc || !formRazon || !formPlaca || !formDirPartida) {
      setFormError('Complete todos los datos del transportista.');
      return;
    }
    const destinatarios_input = formDestinatarios.map(d => ({
      identificacion_destinatario: d.identificacion_destinatario,
      razon_social_destinatario: d.razon_social_destinatario,
      dir_dest_destinatario: d.dir_dest_destinatario,
      motorista_y_ca: d.motorista_y_ca || 'Venta',
      ruta: d.ruta || '',
      cod_doc_sustento: d.cod_doc_sustento || '01',
      num_doc_sustento: d.num_doc_sustento || '',
      fecha_emision_doc_sust: d.fecha_emision_doc_sust || null,
      num_autorizacion_doc_sust: d.num_autorizacion_doc_sust || '',
      detalles_input: (d.detalles || []).map(det => ({
        codigo_interno: det.codigo_interno || 'SIN-COD',
        descripcion: det.descripcion,
        cantidad: Number(det.cantidad),
      })),
    }));
    createMutation.mutate({
      ruc_transportista: formRuc,
      razon_social_transportista: formRazon,
      placa: formPlaca,
      fecha_inicio_transporte: formFechaInicio,
      fecha_fin_transporte: formFechaFin,
      dir_partida: formDirPartida,
      fecha_emision_input: formFechaEmision,
      destinatarios_input,
    });
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = guias.filter(g =>
    g.numero_guia?.toLowerCase().includes(searchTerm.toLowerCase())
    || g.razon_social_transportista?.toLowerCase().includes(searchTerm.toLowerCase())
    || g.placa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalGuias      = guias.length;
  const autorizadas     = guias.filter(g => g.estado === 'AUTORIZADO').length;
  const enProceso       = guias.filter(g => ['ENVIADO', 'FIRMADO'].includes(g.estado)).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guías de Remisión</h1>
            <p className="text-sm text-gray-500">Gestión de guías de remisión electrónicas (codDoc 06)</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <FiPlus /> Nueva Guía
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total emitidas', value: totalGuias, color: 'text-gray-900' },
          { label: 'Autorizadas',    value: autorizadas, color: 'text-green-600' },
          { label: 'En proceso',     value: enProceso,   color: 'text-blue-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, transportista o placa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Cargando guías...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Truck className="h-10 w-10 mb-2 opacity-30" />
            <p>No hay guías de remisión registradas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">N° Guía</th>
                <th className="px-4 py-3 text-left">Transportista</th>
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Fechas Traslado</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(guia => (
                <tr key={guia.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{guia.numero_guia}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{guia.razon_social_transportista}</div>
                    <div className="text-xs text-gray-500">{guia.ruc_transportista}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{guia.placa}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div>{guia.fecha_inicio_transporte}</div>
                    <div className="text-gray-400">→ {guia.fecha_fin_transporte}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor(guia.estado)}`}>
                      {guia.estado}
                    </span>
                    {guia.mensajes_sri && (
                      <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={guia.mensajes_sri}>
                        {guia.mensajes_sri}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {guia.estado === 'BORRADOR' && (
                        <>
                          <button
                            onClick={() => enviarSRIMutation.mutate(guia.id)}
                            disabled={enviarSRIMutation.isPending}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Enviar al SRI"
                          >
                            <FiSend className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm('¿Eliminar guía?')) deleteMutation.mutate(guia.id); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {guia.estado === 'ENVIADO' && (
                        <button
                          onClick={() => reprocesarMutation.mutate(guia.id)}
                          disabled={reprocesarMutation.isPending}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Consultar autorización"
                        >
                          <FiRefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      {guia.estado === 'RECHAZADO' && (
                        <button
                          onClick={() => enviarSRIMutation.mutate(guia.id)}
                          disabled={enviarSRIMutation.isPending}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Reintentar envío"
                        >
                          <FiSend className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Nueva Guía de Remisión</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Datos del transportista */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Datos del Transportista</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RUC Transportista *</label>
                    <input
                      type="text" value={formRuc} onChange={e => setFormRuc(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="1234567890001" required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
                    <input
                      type="text" value={formRazon} onChange={e => setFormRazon(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Placa *</label>
                    <input
                      type="text" value={formPlaca} onChange={e => setFormPlaca(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="ABC-1234" required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Partida *</label>
                    <input
                      type="text" value={formDirPartida} onChange={e => setFormDirPartida(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Emisión</label>
                  <input type="date" value={formFechaEmision} onChange={e => setFormFechaEmision(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Transporte *</label>
                  <input type="date" value={formFechaInicio} onChange={e => setFormFechaInicio(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin Transporte *</label>
                  <input type="date" value={formFechaFin} onChange={e => setFormFechaFin(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" required />
                </div>
              </div>

              {/* Destinatarios */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Destinatarios</h3>
                  <button type="button" onClick={addDestinatario}
                    className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <FiPlus className="h-4 w-4" /> Añadir destinatario
                  </button>
                </div>

                {formDestinatarios.map((dest, destIdx) => (
                  <div key={destIdx} className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Destinatario {destIdx + 1}</span>
                      {formDestinatarios.length > 1 && (
                        <button type="button" onClick={() => removeDestinatario(destIdx)}
                          className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Identificación *</label>
                        <input type="text" value={dest.identificacion_destinatario}
                          onChange={e => updateDestinatario(destIdx, 'identificacion_destinatario', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Razón Social *</label>
                        <input type="text" value={dest.razon_social_destinatario}
                          onChange={e => updateDestinatario(destIdx, 'razon_social_destinatario', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dirección Destino *</label>
                        <input type="text" value={dest.dir_dest_destinatario}
                          onChange={e => updateDestinatario(destIdx, 'dir_dest_destinatario', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo traslado</label>
                        <input type="text" value={dest.motorista_y_ca}
                          onChange={e => updateDestinatario(destIdx, 'motorista_y_ca', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">N° Doc. Sustento (Factura)</label>
                        <input type="text" value={dest.num_doc_sustento}
                          onChange={e => updateDestinatario(destIdx, 'num_doc_sustento', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                          placeholder="001-001-000000001" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Emisión Doc.</label>
                        <input type="date" value={dest.fecha_emision_doc_sust}
                          onChange={e => updateDestinatario(destIdx, 'fecha_emision_doc_sust', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                      </div>
                    </div>

                    {/* Detalles de mercadería */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase">Mercadería</span>
                        <button type="button" onClick={() => addDetalle(destIdx)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                          <FiPlus className="h-3 w-3" /> Añadir ítem
                        </button>
                      </div>
                      {(dest.detalles || []).map((det, detIdx) => (
                        <div key={detIdx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                          <div className="col-span-3">
                            {detIdx === 0 && <label className="block text-xs text-gray-500 mb-1">Código</label>}
                            <input type="text" value={det.codigo_interno}
                              onChange={e => updateDetalle(destIdx, detIdx, 'codigo_interno', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                              placeholder="COD-001" />
                          </div>
                          <div className="col-span-6">
                            {detIdx === 0 && <label className="block text-xs text-gray-500 mb-1">Descripción *</label>}
                            <input type="text" value={det.descripcion}
                              onChange={e => updateDetalle(destIdx, detIdx, 'descripcion', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                              required />
                          </div>
                          <div className="col-span-2">
                            {detIdx === 0 && <label className="block text-xs text-gray-500 mb-1">Cantidad</label>}
                            <input type="number" value={det.cantidad} min="0.001" step="any"
                              onChange={e => updateDetalle(destIdx, detIdx, 'cantidad', parseFloat(e.target.value) || 1)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </div>
                          <div className="col-span-1">
                            {(dest.detalles || []).length > 1 && (
                              <button type="button" onClick={() => removeDetalle(destIdx, detIdx)}
                                className="text-red-400 hover:text-red-600 p-1">
                                <FiTrash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{formError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium">
                  {createMutation.isPending ? 'Creando...' : 'Crear Guía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuiasRemisionPage;
