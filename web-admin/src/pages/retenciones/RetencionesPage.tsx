import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { retencionesService } from '../../services/retencionesService';
import { proveedoresService } from '../../services/proveedoresService';
import type { ImpuestoRetencion, Proveedor } from '../../types';
import { FiPlus, FiSearch, FiSend, FiRefreshCw, FiXCircle, FiTrash2 } from 'react-icons/fi';

// Tabla de porcentajes SRI (parcial — los más comunes)
const PORCENTAJES_RENTA = [
  { cod: '303', label: '303 — Honorarios profesionales (10%)' },
  { cod: '307', label: '307 — Servicios predomina mano de obra (2%)' },
  { cod: '309', label: '309 — Arrendamientos (8%)' },
  { cod: '310', label: '310 — Comisiones (8%)' },
  { cod: '312', label: '312 — Transferencia de bienes muebles (1%)' },
  { cod: '320', label: '320 — Seguros y reaseguros (1%)' },
  { cod: '322', label: '322 — Transporte privado de pasajeros (1%)' },
  { cod: '340', label: '340 — Otras retenciones 1%' },
  { cod: '3440', label: '3440 — Otras retenciones 2%' },
  { cod: '504', label: '504 — Compra de bienes — 1%' },
];
const PORCENTAJES_IVA = [
  { cod: '721', label: '721 — Retención IVA 30%' },
  { cod: '723', label: '723 — Retención IVA 70%' },
  { cod: '725', label: '725 — Retención IVA 100%' },
];

const IMPUESTO_TARIFAS: Record<string, number> = {
  '303': 10, '307': 2, '309': 8, '310': 8, '312': 1,
  '320': 1, '322': 1, '340': 1, '3440': 2, '504': 1,
  '721': 30, '723': 70, '725': 100,
};

const estadoColor = (estado: string) => {
  switch (estado) {
    case 'AUTORIZADO': return 'text-green-600 bg-green-50';
    case 'BORRADOR':   return 'text-yellow-600 bg-yellow-50';
    case 'ENVIADO':    return 'text-blue-600 bg-blue-50';
    case 'RECHAZADO':
    case 'NO_AUTORIZADO': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-50';
  }
};

const emptyImpuesto = (): ImpuestoRetencion => ({
  codigo: '1',
  codigo_porcentaje: '303',
  tarifa: 10,
  base_imponible: 0,
  valor_retenido: 0,
  cod_doc_sustento: '01',
  num_doc_sustento: '',
  fecha_emision_doc_sustento: '',
});

const RetencionesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  // ── Form state ───────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const mesActual = (() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  })();
  const [formProveedor, setFormProveedor] = useState<number | ''>('');
  const [formPeriodo, setFormPeriodo]   = useState(mesActual);
  const [formFecha, setFormFecha]       = useState(today);
  const [formImpuestos, setFormImpuestos] = useState<ImpuestoRetencion[]>([emptyImpuesto()]);
  const [formError, setFormError]       = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: retenciones = [], isLoading } = useQuery({
    queryKey: ['retenciones'],
    queryFn: retencionesService.getAll,
  });

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: proveedoresService.getAll,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const crearMutation = useMutation({
    mutationFn: retencionesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retenciones'] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(msg || 'Error al crear la retención');
    },
  });

  const enviarSRIMutation = useMutation({
    mutationFn: retencionesService.enviarSRI,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['retenciones'] });
      const res = data as { estado?: string; numero_autorizacion?: string; mensaje?: string };
      alert(res?.estado === 'AUTORIZADO'
        ? `✅ Retención AUTORIZADA\nNro.: ${res.numero_autorizacion}`
        : `Estado: ${res?.estado ?? 'ENVIADO'}\n${res?.mensaje ?? ''}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Error al enviar al SRI');
    },
  });

  const reprocesarMutation = useMutation({
    mutationFn: retencionesService.reprocesar,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['retenciones'] });
      const res = data as { estado?: string; numero_autorizacion?: string; mensaje?: string };
      alert(res?.estado === 'AUTORIZADO'
        ? `✅ AUTORIZADA\nNro.: ${res.numero_autorizacion}`
        : `${res?.estado ?? '—'} — ${res?.mensaje ?? ''}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Error al reprocesar');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: retencionesService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retenciones'] }),
    onError: () => alert('Error al eliminar la retención'),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormProveedor('');
    setFormPeriodo(mesActual);
    setFormFecha(today);
    setFormImpuestos([emptyImpuesto()]);
    setFormError('');
  };

  const updateImpuesto = (i: number, field: keyof ImpuestoRetencion, value: string | number) => {
    setFormImpuestos(prev => {
      const next = [...prev];
      const imp = { ...next[i], [field]: value };
      // Auto-fill tarifa when código changes
      if (field === 'codigo_porcentaje') {
        const tarifa = IMPUESTO_TARIFAS[value] ?? 0;
        imp.tarifa = tarifa;
        imp.codigo = String(value).startsWith('7') ? '2' : '1'; // 7xx = IVA
      }
      // Recalcular valor retenido
      if (field === 'base_imponible' || field === 'tarifa' || field === 'codigo_porcentaje') {
        imp.valor_retenido = parseFloat(
          (Number(imp.base_imponible) * Number(imp.tarifa) / 100).toFixed(2)
        );
      }
      next[i] = imp;
      return next;
    });
  };

  const handleSubmit = () => {
    if (!formProveedor) { setFormError('Seleccione un proveedor'); return; }
    if (!formPeriodo.match(/^\d{2}\/\d{4}$/)) { setFormError('Período fiscal debe ser MM/YYYY'); return; }
    for (const imp of formImpuestos) {
      if (!imp.num_doc_sustento) { setFormError('Complete el número del documento de sustento'); return; }
      if (!imp.fecha_emision_doc_sustento) { setFormError('Complete la fecha del doc. sustento'); return; }
    }
    setFormError('');
    crearMutation.mutate({
      proveedor: formProveedor,
      periodo_fiscal: formPeriodo,
      fecha_emision_input: formFecha,
      impuestos_input: formImpuestos,
    } as Record<string, unknown>);
  };

  const retencionesArray = Array.isArray(retenciones) ? retenciones : [];
  const proveedoresArray: Proveedor[] = Array.isArray(proveedores) ? proveedores : [];
  const filtered = retencionesArray.filter(r =>
    (r.numero_retencion ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.proveedor_nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAutorizadas = retencionesArray.filter(r => r.estado === 'AUTORIZADO').length;
  const totalRetenido = retencionesArray
    .filter(r => r.estado === 'AUTORIZADO')
    .reduce((s, r) => s + Number(r.total_retenido), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
            Retenciones en la Fuente
          </h1>
          <p className="text-gray-600 mt-1">Comprobantes de retención electrónicos (codDoc 07)</p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-all shadow-lg"
        >
          <FiPlus /> Nueva Retención
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-sky-500">
          <p className="text-gray-500 text-sm">Total Emitidas</p>
          <p className="text-3xl font-bold text-gray-800">{retencionesArray.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
          <p className="text-gray-500 text-sm">Autorizadas</p>
          <p className="text-3xl font-bold text-gray-800">{totalAutorizadas}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm">Total Retenido (Autorizadas)</p>
          <p className="text-3xl font-bold text-gray-800">${totalRetenido.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative mb-5">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-sky-50 to-blue-50">
                  <th className="text-left p-4 font-semibold text-gray-700">Número</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Proveedor</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Período</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Total Retenido</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ret) => (
                  <tr key={ret.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{ret.numero_retencion}</td>
                    <td className="p-4 text-gray-700">{ret.proveedor_nombre}</td>
                    <td className="p-4 text-gray-700">{ret.periodo_fiscal}</td>
                    <td className="p-4 text-gray-700">{new Date(ret.fecha_emision).toLocaleDateString()}</td>
                    <td className="p-4 text-right font-semibold text-gray-900">${Number(ret.total_retenido).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoColor(ret.estado)}`}>
                        {ret.estado}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        {ret.estado === 'BORRADOR' && (
                          <>
                            <button
                              onClick={() => { if (window.confirm('¿Enviar retención al SRI?')) enviarSRIMutation.mutate(ret.id); }}
                              className="text-green-600 hover:text-green-800"
                              title="Enviar al SRI"
                            ><FiSend /></button>
                            <button
                              onClick={() => { if (window.confirm('¿Eliminar esta retención?')) eliminarMutation.mutate(ret.id); }}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar"
                            ><FiTrash2 /></button>
                          </>
                        )}
                        {ret.estado === 'ENVIADO' && (
                          <button
                            onClick={() => { if (window.confirm('Consultar autorización al SRI?')) reprocesarMutation.mutate(ret.id); }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Consultar SRI"
                          ><FiRefreshCw /></button>
                        )}
                        {(ret.estado === 'RECHAZADO' || ret.estado === 'NO_AUTORIZADO') && (
                          <>
                            <button
                              onClick={() => { if (window.confirm('Re-enviar al SRI?')) enviarSRIMutation.mutate(ret.id); }}
                              className="text-green-600 hover:text-green-800"
                              title="Re-enviar"
                            ><FiSend /></button>
                            <button
                              onClick={() => { if (window.confirm('¿Eliminar?')) eliminarMutation.mutate(ret.id); }}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar"
                            ><FiXCircle /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500">No se encontraron retenciones</div>
            )}
          </div>
        )}
      </div>

      {/* Modal Nueva Retención */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Nueva Retención en la Fuente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Proveedor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor / Sujeto Retenido *</label>
                  <select
                    value={formProveedor}
                    onChange={(e) => setFormProveedor(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Seleccionar...</option>
                    {proveedoresArray.map(c => (
                      <option key={c.id} value={c.id}>{c.razon_social} — {c.identificacion}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Emisión *</label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Período Fiscal (MM/YYYY) *</label>
                <input
                  type="text"
                  value={formPeriodo}
                  onChange={(e) => setFormPeriodo(e.target.value)}
                  placeholder="03/2026"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Impuestos */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-700">Impuestos a Retener</h3>
                  <button
                    onClick={() => setFormImpuestos(prev => [...prev, emptyImpuesto()])}
                    className="text-sm text-sky-600 hover:text-sky-800 font-medium"
                  >+ Agregar impuesto</button>
                </div>

                {formImpuestos.map((imp, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 space-y-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Impuesto #{i + 1}</span>
                      {formImpuestos.length > 1 && (
                        <button
                          onClick={() => setFormImpuestos(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >Eliminar</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                        <select
                          value={imp.codigo}
                          onChange={(e) => updateImpuesto(i, 'codigo', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <option value="1">1 — Renta</option>
                          <option value="2">2 — IVA</option>
                          <option value="6">6 — ISD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Código Porcentaje</label>
                        <select
                          value={imp.codigo_porcentaje}
                          onChange={(e) => updateImpuesto(i, 'codigo_porcentaje', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <optgroup label="Renta">
                            {PORCENTAJES_RENTA.map(p => <option key={p.cod} value={p.cod}>{p.label}</option>)}
                          </optgroup>
                          <optgroup label="IVA">
                            {PORCENTAJES_IVA.map(p => <option key={p.cod} value={p.cod}>{p.label}</option>)}
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tarifa %</label>
                        <input
                          type="number"
                          value={imp.tarifa}
                          onChange={(e) => updateImpuesto(i, 'tarifa', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Base Imponible $</label>
                        <input
                          type="number"
                          value={imp.base_imponible}
                          onChange={(e) => updateImpuesto(i, 'base_imponible', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Valor Retenido $ (auto)</label>
                        <input
                          type="number"
                          value={imp.valor_retenido}
                          readOnly
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nro. Doc. Sustento</label>
                        <input
                          type="text"
                          value={imp.num_doc_sustento}
                          onChange={(e) => updateImpuesto(i, 'num_doc_sustento', e.target.value)}
                          placeholder="001-001-000000001"
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Fecha Emisión Doc. Sustento</label>
                        <input
                          type="date"
                          value={imp.fecha_emision_doc_sustento}
                          onChange={(e) => updateImpuesto(i, 'fecha_emision_doc_sustento', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-sky-50 rounded-xl p-4 text-right">
                <span className="text-sm text-gray-600">Total a Retener: </span>
                <span className="text-xl font-bold text-sky-700">
                  ${formImpuestos.reduce((s, imp) => s + Number(imp.valor_retenido), 0).toFixed(2)}
                </span>
              </div>

              {formError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{formError}</p>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t p-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={crearMutation.isPending}
                className="px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                {crearMutation.isPending ? 'Creando...' : 'Crear Retención'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetencionesPage;
