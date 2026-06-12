import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notasDebitoService } from '../../services/notasDebitoService';
import { clientesService } from '../../services/clientesService';
import type { DetalleNotaDebito, Cliente } from '../../types';
import { FiPlus, FiSearch, FiSend, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { FileMinus } from 'lucide-react';
import { toast } from '../../store/toastStore';
import { confirmDialog } from '../../store/confirmStore';

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

const emptyDetalle = (): DetalleNotaDebito => ({
  razon: '',
  valor: 0,
});

const NotasDebitoPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  // ── Form state ───────────────────────────────────────────────────────────────
  const [formCliente, setFormCliente]     = useState<number | ''>('');
  const [formMotivo, setFormMotivo]       = useState('');
  const [formFecha, setFormFecha]         = useState(today);
  const [formDetalles, setFormDetalles]   = useState<DetalleNotaDebito[]>([emptyDetalle()]);
  const [formError, setFormError]         = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-debito'],
    queryFn: notasDebitoService.getAll,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: clientesService.getActivos,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: notasDebitoService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-debito'] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al crear nota de débito';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notasDebitoService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas-debito'] }),
  });

  const enviarSRIMutation = useMutation({
    mutationFn: notasDebitoService.enviarSRI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas-debito'] }),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al enviar';
      toast.error(msg);
    },
  });

  const reprocesarMutation = useMutation({
    mutationFn: notasDebitoService.reprocesar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas-debito'] }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormCliente(''); setFormMotivo(''); setFormFecha(today);
    setFormDetalles([emptyDetalle()]); setFormError('');
  };

  const addDetalle = () => setFormDetalles(prev => [...prev, emptyDetalle()]);
  const removeDetalle = (idx: number) => setFormDetalles(prev => prev.filter((_, i) => i !== idx));

  const updateDetalle = (idx: number, field: keyof DetalleNotaDebito, value: string | number) => {
    setFormDetalles(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const totalFormDetalles = formDetalles.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formCliente) { setFormError('Seleccione un cliente.'); return; }
    if (!formMotivo.trim()) { setFormError('Ingrese el motivo.'); return; }

    const detalles_input = formDetalles.map(d => ({
      razon: d.razon,
      valor: Number(d.valor),
      aplica_iva: true,
    }));

    createMutation.mutate({
      cliente: formCliente,
      motivo: formMotivo,
      fecha_emision_input: formFecha,
      detalles_input,
    });
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = notas.filter(n =>
    n.numero_nota?.toLowerCase().includes(searchTerm.toLowerCase())
    || n.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    || n.motivo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalNotas    = notas.length;
  const autorizadas   = notas.filter(n => n.estado === 'AUTORIZADO').length;
  const totalCobrado  = notas
    .filter(n => n.estado === 'AUTORIZADO')
    .reduce((s, n) => s + Number(n.total || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FileMinus className="h-7 w-7 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notas de Débito</h1>
            <p className="text-sm text-gray-500">Cargos adicionales a clientes (codDoc 05)</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          <FiPlus /> Nueva Nota Débito
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total emitidas</p>
          <p className="text-3xl font-bold text-gray-900">{totalNotas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Autorizadas</p>
          <p className="text-3xl font-bold text-green-600">{autorizadas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total cobrado (autorizado)</p>
          <p className="text-3xl font-bold text-orange-600">${totalCobrado.toFixed(2)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, cliente o motivo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Cargando notas de débito...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <FileMinus className="h-10 w-10 mb-2 opacity-30" />
            <p>No hay notas de débito registradas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">N° Nota</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(nota => (
                <tr key={nota.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{nota.numero_nota}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{nota.cliente_nombre}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={nota.motivo}>{nota.motivo}</td>
                  <td className="px-4 py-3 text-right font-semibold">${Number(nota.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor(nota.estado)}`}>
                      {nota.estado}
                    </span>
                    {nota.mensajes_sri && (
                      <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={nota.mensajes_sri}>
                        {nota.mensajes_sri}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {nota.estado === 'BORRADOR' && (
                        <>
                          <button
                            onClick={() => enviarSRIMutation.mutate(nota.id)}
                            disabled={enviarSRIMutation.isPending}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Enviar al SRI"
                          >
                            <FiSend className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => { if (await confirmDialog('¿Eliminar nota de débito?', undefined, 'danger')) deleteMutation.mutate(nota.id); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {nota.estado === 'ENVIADO' && (
                        <button
                          onClick={() => reprocesarMutation.mutate(nota.id)}
                          disabled={reprocesarMutation.isPending}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Consultar autorización"
                        >
                          <FiRefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      {(nota.estado === 'RECHAZADO' || nota.estado === 'NO_AUTORIZADO') && (
                        <button
                          onClick={() => enviarSRIMutation.mutate(nota.id)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Nueva Nota de Débito</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={formCliente}
                  onChange={e => setFormCliente(Number(e.target.value) || '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {(clientes as Cliente[]).map(c => (
                    <option key={c.id} value={c.id}>{c.razon_social} — {c.identificacion}</option>
                  ))}
                </select>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <input
                  type="text"
                  value={formMotivo}
                  onChange={e => setFormMotivo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                  placeholder="Ej: Interés por mora, ajuste de precio, etc."
                  required
                />
              </div>

              {/* Fecha emisión */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Emisión</label>
                <input
                  type="date"
                  value={formFecha}
                  onChange={e => setFormFecha(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Razones / Detalles */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Razones del Cargo</label>
                  <button type="button" onClick={addDetalle}
                    className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1">
                    <FiPlus className="h-4 w-4" /> Añadir razón
                  </button>
                </div>
                {formDetalles.map((det, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                    <div className="col-span-8">
                      {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Razón *</label>}
                      <input
                        type="text"
                        value={det.razon}
                        onChange={e => updateDetalle(idx, 'razon', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        placeholder="Descripción del cargo"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Valor ($) *</label>}
                      <input
                        type="number"
                        value={det.valor}
                        min="0.01"
                        step="0.01"
                        onChange={e => updateDetalle(idx, 'valor', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      {formDetalles.length > 1 && (
                        <button type="button" onClick={() => removeDetalle(idx)}
                          className="text-red-400 hover:text-red-600 p-1">
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-2 text-right text-sm text-gray-600">
                  Subtotal: <strong>${totalFormDetalles.toFixed(2)}</strong>
                  <span className="ml-2 text-gray-400">(+ IVA 15%: ${(totalFormDetalles * 0.15).toFixed(2)})</span>
                  <span className="ml-2 font-bold text-gray-800">= ${(totalFormDetalles * 1.15).toFixed(2)}</span>
                </div>
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
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium">
                  {createMutation.isPending ? 'Creando...' : 'Crear Nota Débito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotasDebitoPage;
