import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSearch, FiPlus, FiChevronDown, FiChevronUp, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { ClipboardList, Send, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { cotizacionesService } from '../../services/cotizacionesService';
import type { Cotizacion, ItemCotizacion, CotizacionCreateData } from '../../services/cotizacionesService';
import { toast } from '../../store/toastStore';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });

const estadoColor = (e: string) => {
  switch (e) {
    case 'BORRADOR':  return 'text-gray-700 bg-gray-100 border border-gray-300';
    case 'ENVIADA':   return 'text-blue-700 bg-blue-50 border border-blue-200';
    case 'ACEPTADA':  return 'text-green-700 bg-green-50 border border-green-200';
    case 'RECHAZADA': return 'text-red-700 bg-red-50 border border-red-200';
    case 'VENCIDA':   return 'text-orange-700 bg-orange-50 border border-orange-200';
    case 'FACTURADA': return 'text-indigo-700 bg-indigo-50 border border-indigo-200';
    default:          return 'text-gray-600 bg-gray-50';
  }
};

// ── Item form row ─────────────────────────────────────────────────────────────
const emptyItem = (): ItemCotizacion => ({
  descripcion: '', codigo: '', cantidad: 1,
  precio_unitario: 0, descuento: 0, tarifa_iva: 15,
});

// ── Cotizacion form modal ─────────────────────────────────────────────────────
interface FormModalProps {
  editing?: Cotizacion;
  onClose: () => void;
  onSuccess: () => void;
}

const FormModal: React.FC<FormModalProps> = ({ editing, onClose, onSuccess }) => {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    cliente: editing?.cliente ?? 0,
    numero: editing?.numero ?? '',
    fecha_emision: editing?.fecha_emision ?? today,
    fecha_validez: editing?.fecha_validez ?? '',
    observaciones: editing?.observaciones ?? '',
    condiciones: editing?.condiciones ?? '',
  });
  const [items, setItems] = useState<ItemCotizacion[]>(
    editing?.items?.length ? editing.items : [emptyItem()]
  );
  const [loading, setLoading] = useState(false);

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof ItemCotizacion, value: string | number) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((s, it) => {
    const base = Number(it.cantidad) * Number(it.precio_unitario) - Number(it.descuento);
    return s + Math.max(0, base);
  }, 0);
  const iva = items.reduce((s, it) => {
    const base = Math.max(0, Number(it.cantidad) * Number(it.precio_unitario) - Number(it.descuento));
    return s + base * Number(it.tarifa_iva) / 100;
  }, 0);
  const total = subtotal + iva;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente) { toast.error('Ingrese el ID del cliente'); return; }
    if (items.every(it => !it.descripcion)) { toast.error('Ingrese al menos un ítem'); return; }

    setLoading(true);
    try {
      const payload: CotizacionCreateData = {
        ...form,
        cliente: Number(form.cliente),
        items: items.filter(it => it.descripcion).map(it => ({
          ...it,
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
          descuento: Number(it.descuento),
          tarifa_iva: Number(it.tarifa_iva),
        })),
      };
      if (editing) {
        await cotizacionesService.update(editing.id, payload);
        toast.success('Cotización actualizada');
      } else {
        await cotizacionesService.create(payload);
        toast.success('Cotización creada');
      }
      onSuccess();
    } catch {
      toast.error('Error al guardar la cotización');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar' : 'Nueva'} Cotización</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID Cliente *</label>
              <input type="number" required placeholder="ID del cliente"
                value={form.cliente || ''}
                onChange={(e) => setForm({ ...form, cliente: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Emisión</label>
              <input type="date" value={form.fecha_emision}
                onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Válida hasta</label>
              <input type="date" value={form.fecha_validez}
                min={form.fecha_emision}
                onChange={(e) => setForm({ ...form, fecha_validez: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
              <textarea rows={2} value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Condiciones de pago / entrega</label>
              <textarea rows={2} value={form.condiciones}
                onChange={(e) => setForm({ ...form, condiciones: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ítems</label>
              <button type="button" onClick={addItem}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar ítem</button>
            </div>
            <div className="space-y-2">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-12 gap-1 text-xs text-gray-400 uppercase tracking-wide px-1">
                <span className="col-span-4">Descripción</span>
                <span className="col-span-1">Cant.</span>
                <span className="col-span-2">P. Unitario</span>
                <span className="col-span-1">Desc.</span>
                <span className="col-span-1">IVA%</span>
                <span className="col-span-2 text-right">Subtotal</span>
                <span className="col-span-1"></span>
              </div>
              {items.map((item, i) => {
                const base = Math.max(0, Number(item.cantidad) * Number(item.precio_unitario) - Number(item.descuento));
                const subtotalItem = base + base * Number(item.tarifa_iva) / 100;
                return (
                  <div key={i} className="grid grid-cols-12 gap-1 items-center">
                    <input placeholder="Descripción *" value={item.descripcion}
                      onChange={(e) => updateItem(i, 'descripcion', e.target.value)}
                      className="col-span-4 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input type="number" min="0.001" step="0.001" placeholder="1" value={item.cantidad}
                      onChange={(e) => updateItem(i, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="col-span-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={item.precio_unitario}
                      onChange={(e) => updateItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input type="number" min="0" step="0.01" placeholder="0" value={item.descuento}
                      onChange={(e) => updateItem(i, 'descuento', parseFloat(e.target.value) || 0)}
                      className="col-span-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <select value={item.tarifa_iva}
                      onChange={(e) => updateItem(i, 'tarifa_iva', parseFloat(e.target.value))}
                      className="col-span-1 border border-gray-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="0">0%</option>
                      <option value="12">12%</option>
                      <option value="15">15%</option>
                    </select>
                    <div className="col-span-2 text-right text-xs font-semibold text-gray-700 pr-1">
                      {fmtCurrency(subtotalItem)}
                    </div>
                    <button type="button" onClick={() => removeItem(i)}
                      className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-3 flex justify-end">
              <div className="text-sm space-y-0.5 text-right min-w-[200px]">
                <div className="flex justify-between gap-8">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="font-medium">{fmtCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-gray-500">IVA:</span>
                  <span className="font-medium">{fmtCurrency(iva)}</span>
                </div>
                <div className="flex justify-between gap-8 border-t border-gray-200 pt-1">
                  <span className="font-bold text-gray-800">TOTAL:</span>
                  <span className="font-bold text-gray-900 text-base">{fmtCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Cotización'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const CotizacionesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cotizacion | undefined>();

  const queryClient = useQueryClient();

  const { data: cotizaciones = [], isLoading } = useQuery({
    queryKey: ['cotizaciones'],
    queryFn: cotizacionesService.getAll,
  });

  const { data: resumen } = useQuery({
    queryKey: ['cotizaciones-resumen'],
    queryFn: cotizacionesService.getResumen,
  });

  const makeAction = (fn: (id: number) => Promise<unknown>, successMsg: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
        queryClient.invalidateQueries({ queryKey: ['cotizaciones-resumen'] });
        toast.success(successMsg);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
        toast.error(msg);
      },
    });

  const enviarMut    = makeAction(cotizacionesService.enviar,  'Cotización enviada');
  const aceptarMut   = makeAction(cotizacionesService.aceptar, 'Cotización aceptada');
  const rechazarMut  = makeAction(cotizacionesService.rechazar,'Cotización rechazada');
  const deleteMut    = useMutation({
    mutationFn: cotizacionesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      toast.success('Cotización eliminada');
    },
  });

  const filtered = cotizaciones.filter((c) => {
    const matchSearch = c.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numero?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = !estadoFiltro || c.estado === estadoFiltro;
    return matchSearch && matchEstado;
  });

  // KPIs
  const kpis = [
    { label: 'Total', value: cotizaciones.length, color: 'bg-gray-50 border-gray-200' },
    { label: 'Pendientes', value: cotizaciones.filter(c => ['BORRADOR','ENVIADA','ACEPTADA'].includes(c.estado)).length, color: 'bg-blue-50 border-blue-200' },
    { label: 'Aceptadas', value: cotizaciones.filter(c => c.estado === 'ACEPTADA').length, color: 'bg-green-50 border-green-200' },
    { label: 'Facturadas', value: cotizaciones.filter(c => c.estado === 'FACTURADA').length, color: 'bg-indigo-50 border-indigo-200' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cotizaciones / Proformas</h1>
            <p className="text-sm text-gray-500">Gestión y seguimiento de cotizaciones</p>
          </div>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm">
          <FiPlus /> Nueva Cotización
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl p-4 border shadow-sm ${k.color}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-3xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input type="text" placeholder="Buscar por cliente o número..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Todos</option>
            <option value="BORRADOR">Borrador</option>
            <option value="ENVIADA">Enviada</option>
            <option value="ACEPTADA">Aceptada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="VENCIDA">Vencida</option>
            <option value="FACTURADA">Facturada</option>
          </select>
          <span className="text-xs text-gray-400 self-center">{filtered.length} cotizaciones</span>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No hay cotizaciones</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3">Validez</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        className="text-gray-400 hover:text-gray-600">
                        {expanded === c.id ? <FiChevronUp /> : <FiChevronDown />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 text-xs">COT-{c.numero}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.cliente_nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(c.fecha_emision)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.fecha_validez ? (
                        <span className={c.dias_validez !== undefined && c.dias_validez < 0 ? 'text-red-500' : ''}>
                          {fmtDate(c.fecha_validez)}
                          {c.dias_validez !== undefined && c.dias_validez < 0 && (
                            <span className="block text-xs text-red-400">vencida</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtCurrency(c.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoColor(c.estado)}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.estado === 'BORRADOR' && (
                          <>
                            <button onClick={() => { setEditing(c); setShowForm(true); }}
                              className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1">
                              <FiEdit2 className="h-3 w-3" /> Editar
                            </button>
                            <button onClick={() => enviarMut.mutate(c.id)}
                              className="text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Send className="h-3 w-3" /> Enviar
                            </button>
                          </>
                        )}
                        {['BORRADOR','ENVIADA'].includes(c.estado) && (
                          <button onClick={() => aceptarMut.mutate(c.id)}
                            className="text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Aceptar
                          </button>
                        )}
                        {['BORRADOR','ENVIADA','ACEPTADA'].includes(c.estado) && (
                          <button onClick={() => rechazarMut.mutate(c.id)}
                            className="text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-2 py-1 rounded-lg flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Rechazar
                          </button>
                        )}
                        {c.estado === 'ACEPTADA' && (
                          <button onClick={() => {
                            toast.info?.('Copie los items al módulo de Facturación para crear la factura.');
                          }}
                            className="text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-1 rounded-lg flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Facturar
                          </button>
                        )}
                        {c.estado === 'BORRADOR' && (
                          <button onClick={() => {
                            if (confirm('¿Eliminar esta cotización?')) deleteMut.mutate(c.id);
                          }}
                            className="text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-2 py-1 rounded-lg">
                            <FiTrash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded: items */}
                  {expanded === c.id && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={8} className="px-8 py-4">
                        <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Ítems de la cotización</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-400">
                              <th className="py-1 pr-4">Descripción</th>
                              <th className="py-1 pr-3">Cant.</th>
                              <th className="py-1 pr-3">P. Unit.</th>
                              <th className="py-1 pr-3">Desc.</th>
                              <th className="py-1 pr-3">IVA%</th>
                              <th className="py-1 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(c.items || []).map((it, idx) => {
                              const base = Math.max(0, Number(it.cantidad) * Number(it.precio_unitario) - Number(it.descuento));
                              const tot = base + base * Number(it.tarifa_iva) / 100;
                              return (
                                <tr key={idx} className="border-t border-blue-100">
                                  <td className="py-1 pr-4 text-gray-700">{it.descripcion}</td>
                                  <td className="py-1 pr-3">{it.cantidad}</td>
                                  <td className="py-1 pr-3">{fmtCurrency(it.precio_unitario)}</td>
                                  <td className="py-1 pr-3">{fmtCurrency(it.descuento)}</td>
                                  <td className="py-1 pr-3">{it.tarifa_iva}%</td>
                                  <td className="py-1 text-right font-semibold">{fmtCurrency(tot)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-blue-200">
                              <td colSpan={5} className="py-1 pr-4 font-bold text-right text-blue-800">TOTAL:</td>
                              <td className="py-1 text-right font-bold text-blue-900">{fmtCurrency(c.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {c.observaciones && (
                          <p className="text-xs text-gray-500 mt-2"><span className="font-semibold">Obs:</span> {c.observaciones}</p>
                        )}
                        {c.condiciones && (
                          <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">Condiciones:</span> {c.condiciones}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <FormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
            queryClient.invalidateQueries({ queryKey: ['cotizaciones-resumen'] });
          }}
        />
      )}
    </div>
  );
};

export default CotizacionesPage;
