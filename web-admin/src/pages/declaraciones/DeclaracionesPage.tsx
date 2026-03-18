import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileBarChart2, Download, AlertCircle, Calendar, CheckCircle2,
  Clock, XCircle, Calculator, Send, ChevronRight,
} from 'lucide-react';
import { declaracionesService } from '../../services/declaracionesService';
import type { RetencionGrupo, Obligacion } from '../../services/declaracionesService';
import { toast } from '../../store/toastStore';

const MESES = [
  '', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const fmtCurrency = (v: number | string) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(v));

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Small reusable components ─────────────────────────────────────────────────

const Row: React.FC<{
  label: string;
  value: string | number;
  highlight?: boolean;
  bold?: boolean;
  negative?: boolean;
}> = ({ label, value, highlight, bold, negative }) => (
  <tr className={`border-b border-gray-100 ${highlight ? 'bg-blue-50' : ''}`}>
    <td className={`py-2 px-4 text-sm text-gray-600 ${bold ? 'font-semibold text-gray-900' : ''}`}>{label}</td>
    <td className={`py-2 px-4 text-sm text-right tabular-nums ${bold ? 'font-bold text-gray-900' : 'text-gray-700'} ${negative ? 'text-red-600' : ''}`}>
      {typeof value === 'number' ? fmtCurrency(value) : value}
    </td>
  </tr>
);

const StatusBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pendiente:  { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Clock className="h-3 w-3" /> },
    presentada: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
    vencida:    { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   icon: <XCircle className="h-3 w-3" /> },
    BORRADOR:   { bg: 'bg-gray-50 border-gray-200',   text: 'text-gray-600',  icon: <Clock className="h-3 w-3" /> },
    CALCULADA:  { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',  icon: <Calculator className="h-3 w-3" /> },
    PRESENTADA: { bg: 'bg-green-50 border-green-200',  text: 'text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
    VENCIDA:    { bg: 'bg-red-50 border-red-200',      text: 'text-red-700',   icon: <XCircle className="h-3 w-3" /> },
  };
  const s = map[estado] || map.pendiente;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text}`}>
      {s.icon} {estado}
    </span>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const DeclaracionesPage: React.FC = () => {
  const qc = useQueryClient();
  const currentDate = new Date();
  const [anio, setAnio] = useState(currentDate.getFullYear());
  const [mes, setMes] = useState(currentDate.getMonth() || 12);
  const [activeTab, setActiveTab] = useState<'calendario' | '104' | '103'>('calendario');
  const [loadingAts, setLoadingAts] = useState(false);
  const [presentarId, setPresentarId] = useState<number | null>(null);
  const [nroFormulario, setNroFormulario] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: calendario, isLoading: loadingCal } = useQuery({
    queryKey: ['calendario', anio],
    queryFn: () => declaracionesService.getCalendario(anio),
  });

  const { data: declaraciones } = useQuery({
    queryKey: ['declaraciones', anio],
    queryFn: () => declaracionesService.listar(anio),
  });

  const { data: data104, isLoading: loading104, error: error104 } = useQuery({
    queryKey: ['form104', anio, mes],
    queryFn: () => declaracionesService.getForm104(anio, mes),
    enabled: activeTab === '104' && mes > 0,
  });

  const { data: data103, isLoading: loading103, error: error103 } = useQuery({
    queryKey: ['form103', anio, mes],
    queryFn: () => declaracionesService.getForm103(anio, mes),
    enabled: activeTab === '103' && mes > 0,
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const calcularMut = useMutation({
    mutationFn: (vars: { tipo: string; anio: number; mes: number }) =>
      declaracionesService.calcularYGuardar(vars.tipo, vars.anio, vars.mes),
    onSuccess: (data) => {
      toast.success(`Form. ${data.tipo_formulario} de ${data.mes_nombre} ${data.anio} calculado y guardado`);
      qc.invalidateQueries({ queryKey: ['declaraciones'] });
      qc.invalidateQueries({ queryKey: ['calendario'] });
    },
    onError: () => toast.error('Error al calcular la declaración'),
  });

  const presentarMut = useMutation({
    mutationFn: (vars: { id: number; nro: string }) =>
      declaracionesService.marcarPresentada(vars.id, { numero_formulario_sri: vars.nro }),
    onSuccess: () => {
      toast.success('Declaración marcada como presentada');
      setPresentarId(null);
      setNroFormulario('');
      qc.invalidateQueries({ queryKey: ['declaraciones'] });
      qc.invalidateQueries({ queryKey: ['calendario'] });
    },
    onError: () => toast.error('Error al marcar como presentada'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAts = async () => {
    setLoadingAts(true);
    try {
      await declaracionesService.downloadAts(anio, mes);
      toast.success('ATS descargado correctamente');
    } catch {
      toast.error('Error al generar el ATS');
    } finally {
      setLoadingAts(false);
    }
  };

  const handleCalcular = (tipo: string) => {
    calcularMut.mutate({ tipo, anio, mes });
  };

  const periodoLabel = mes > 0 ? `${MESES[mes]} ${anio}` : '—';
  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  // Group calendar by month
  const calByMes: Record<number, Obligacion[]> = {};
  calendario?.obligaciones.forEach((o) => {
    (calByMes[o.mes] ??= []).push(o);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
            <FileBarChart2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
              Declaraciones SRI
            </h1>
            <p className="text-sm text-gray-500">Calendario, Form. 104 (IVA), 103 (Retenciones) y ATS</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2">
          <select
            value={mes}
            onChange={(e) => setMes(parseInt(e.target.value))}
            className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
          >
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={(e) => setAnio(parseInt(e.target.value))}
            className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
          >
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ATS download banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="font-semibold text-indigo-800 text-sm">Anexo Transaccional Simplificado (ATS)</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Descarga el XML del período <span className="font-semibold">{periodoLabel}</span> para subir al SRI
          </p>
        </div>
        <button
          onClick={handleAts}
          disabled={loadingAts}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          {loadingAts ? 'Generando...' : 'Descargar ATS XML'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'calendario', label: 'Calendario', icon: <Calendar className="h-3.5 w-3.5" /> },
          { key: '104', label: 'Form. 104 — IVA' },
          { key: '103', label: 'Form. 103 — Retenciones' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {'icon' in t && t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CALENDARIO ── */}
      {activeTab === 'calendario' && (
        <div className="space-y-4">
          {loadingCal ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                {(() => {
                  const obs = calendario?.obligaciones || [];
                  const pend = obs.filter(o => o.estado === 'pendiente').length;
                  const pres = obs.filter(o => o.estado === 'presentada').length;
                  const venc = obs.filter(o => o.estado === 'vencida').length;
                  return (
                    <>
                      <div className="bg-white rounded-xl border-l-4 border-amber-400 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Pendientes</p>
                        <p className="text-2xl font-bold text-amber-600">{pend}</p>
                      </div>
                      <div className="bg-white rounded-xl border-l-4 border-green-400 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Presentadas</p>
                        <p className="text-2xl font-bold text-green-600">{pres}</p>
                      </div>
                      <div className="bg-white rounded-xl border-l-4 border-red-400 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Vencidas</p>
                        <p className="text-2xl font-bold text-red-600">{venc}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Month-by-month grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(calByMes).map(([mesNum, obls]) => (
                  <div key={mesNum} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex justify-between items-center">
                      <h4 className="font-semibold text-sm text-gray-800">{MESES[Number(mesNum)]}</h4>
                      <span className="text-xs text-gray-400">Vence: {fmtDate(obls[0]?.fecha_limite)}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {obls.map((o) => (
                        <div key={`${o.tipo_formulario}-${o.mes}`} className="px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{o.nombre}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge estado={o.estado} />
                            {o.estado !== 'presentada' && (
                              <button
                                onClick={() => {
                                  setMes(Number(mesNum));
                                  setActiveTab(o.tipo_formulario as '104' | '103');
                                }}
                                className="text-indigo-500 hover:text-indigo-700 transition"
                                title="Ver detalle"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Saved declarations table */}
              {declaraciones && declaraciones.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                  <div className="bg-gray-50 border-b border-gray-100 px-6 py-3">
                    <h3 className="font-bold text-gray-800 text-sm">Declaraciones guardadas — {anio}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="py-2 px-4 text-left">Período</th>
                        <th className="py-2 px-4 text-left">Tipo</th>
                        <th className="py-2 px-4 text-left">Estado</th>
                        <th className="py-2 px-4 text-right">Impuesto</th>
                        <th className="py-2 px-4 text-left">Fecha límite</th>
                        <th className="py-2 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {declaraciones.map((d) => (
                        <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-4 font-medium text-gray-700">{d.mes_nombre} {d.anio}</td>
                          <td className="py-2 px-4 text-gray-600">{d.tipo_display}</td>
                          <td className="py-2 px-4"><StatusBadge estado={d.estado} /></td>
                          <td className="py-2 px-4 text-right tabular-nums font-semibold">
                            {d.tipo_formulario === '104'
                              ? fmtCurrency(d.impuesto_a_pagar)
                              : fmtCurrency(d.total_retenido)}
                          </td>
                          <td className="py-2 px-4 text-gray-500">{fmtDate(d.fecha_limite)}</td>
                          <td className="py-2 px-4 text-right">
                            {d.estado !== 'PRESENTADA' && (
                              <button
                                onClick={() => { setPresentarId(d.id); setNroFormulario(''); }}
                                className="text-xs text-green-600 hover:text-green-800 font-medium transition"
                              >
                                Marcar presentada
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── FORM 104 ── */}
      {activeTab === '104' && (
        <div>
          {/* Action bar */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => handleCalcular('104')}
              disabled={calcularMut.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              {calcularMut.isPending ? 'Calculando...' : 'Calcular y Guardar'}
            </button>
            {data104?.fecha_limite && (
              <span className="text-xs text-gray-500">
                Fecha límite: <span className="font-semibold text-gray-700">{fmtDate(data104.fecha_limite)}</span>
              </span>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {loading104 ? (
              <div className="col-span-2 flex justify-center py-16">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : error104 ? (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-xl p-6 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">Error al cargar el formulario 104.</p>
              </div>
            ) : data104 ? (
              <>
                {/* Ventas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-green-50 border-b border-green-100 px-6 py-3">
                    <h3 className="font-bold text-green-800">Ventas — {periodoLabel}</h3>
                    <p className="text-xs text-green-600">{data104.ventas.num_facturas} facturas autorizadas</p>
                  </div>
                  <table className="w-full">
                    <tbody>
                      <Row label="Ventas tarifa 0%" value={fmtCurrency(data104.ventas.subtotal_0)} />
                      <Row label="Ventas tarifa 12%" value={fmtCurrency(data104.ventas.subtotal_12)} />
                      <Row label="Ventas tarifa 15%" value={fmtCurrency(data104.ventas.subtotal_15)} />
                      <Row label="Descuentos" value={`- ${fmtCurrency(data104.ventas.total_descuento)}`} negative />
                      <Row label="IVA 12% cobrado" value={fmtCurrency(data104.ventas.iva_12)} bold />
                      <Row label="IVA 15% cobrado" value={fmtCurrency(data104.ventas.iva_15)} bold />
                      {data104.notas_credito.cantidad > 0 && (
                        <Row label={`Notas de crédito (${data104.notas_credito.cantidad})`} value={`- ${fmtCurrency(data104.notas_credito.total)}`} negative />
                      )}
                      {data104.notas_debito.cantidad > 0 && (
                        <Row label={`Notas de débito (${data104.notas_debito.cantidad})`} value={`+ ${fmtCurrency(data104.notas_debito.total)}`} />
                      )}
                      <Row label="Total ventas neto" value={fmtCurrency(data104.liquidacion.total_ventas_neto)} bold highlight />
                    </tbody>
                  </table>
                </div>

                {/* Compras + Liquidación */}
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
                      <h3 className="font-bold text-blue-800">Compras del período</h3>
                      <p className="text-xs text-blue-600">{data104.compras.num_ordenes} órdenes de compra</p>
                    </div>
                    <table className="w-full">
                      <tbody>
                        <Row label="Subtotal compras" value={fmtCurrency(data104.compras.subtotal)} />
                        <Row label="IVA en compras" value={fmtCurrency(data104.compras.iva)} />
                        <Row label="Total compras" value={fmtCurrency(data104.compras.total)} bold />
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3">
                      <h3 className="font-bold text-indigo-800">Liquidación IVA</h3>
                    </div>
                    <table className="w-full">
                      <tbody>
                        <Row label="IVA ventas neto" value={fmtCurrency(data104.liquidacion.iva_ventas_neto)} />
                        <Row label="Crédito tributario (IVA compras)" value={`- ${fmtCurrency(data104.liquidacion.credito_tributario)}`} negative />
                        <Row label="Ret. IVA emitidas" value={`- ${fmtCurrency(data104.retenciones_iva_emitidas.valor_retenido)}`} negative />
                        <Row label="IVA causado" value={fmtCurrency(data104.liquidacion.iva_causado)} bold />
                        {Number(data104.liquidacion.credito_tributario_favor) > 0 && (
                          <Row label="Crédito tributario a favor" value={fmtCurrency(data104.liquidacion.credito_tributario_favor)} highlight />
                        )}
                        <Row label="IVA A PAGAR" value={fmtCurrency(data104.liquidacion.iva_a_pagar)} bold highlight />
                      </tbody>
                    </table>
                  </div>

                  {data104.nota && (
                    <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-700">{data104.nota}</p>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── FORM 103 ── */}
      {activeTab === '103' && (
        <div>
          {/* Action bar */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => handleCalcular('103')}
              disabled={calcularMut.isPending}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              {calcularMut.isPending ? 'Calculando...' : 'Calcular y Guardar'}
            </button>
            {data103?.fecha_limite && (
              <span className="text-xs text-gray-500">
                Fecha límite: <span className="font-semibold text-gray-700">{fmtDate(data103.fecha_limite)}</span>
              </span>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {loading103 ? (
              <div className="col-span-2 flex justify-center py-16">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : error103 ? (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-xl p-6">
                <p className="text-sm text-red-700">Error al cargar el formulario 103.</p>
              </div>
            ) : data103 ? (
              <>
                {/* Retenciones Renta */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 border-b border-orange-100 px-6 py-3">
                    <h3 className="font-bold text-orange-800">Retenciones IR — {periodoLabel}</h3>
                    <p className="text-xs text-orange-600">{data103.num_comprobantes_retencion} comprobantes emitidos</p>
                  </div>
                  {data103.retenciones_renta.length === 0 ? (
                    <p className="p-6 text-sm text-gray-400 text-center">Sin retenciones de renta en este período</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                          <th className="py-2 px-4 text-left">Código</th>
                          <th className="py-2 px-4 text-right">Tarifa</th>
                          <th className="py-2 px-4 text-right">Base</th>
                          <th className="py-2 px-4 text-right">Retenido</th>
                          <th className="py-2 px-4 text-right">#</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data103.retenciones_renta.map((r: RetencionGrupo) => (
                          <tr key={r.codigo_porcentaje} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-4 font-mono text-gray-700">{r.codigo_porcentaje}</td>
                            <td className="py-2 px-4 text-right">{r.tarifa}%</td>
                            <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(r.base_imponible)}</td>
                            <td className="py-2 px-4 text-right font-semibold text-orange-700 tabular-nums">{fmtCurrency(r.valor_retenido)}</td>
                            <td className="py-2 px-4 text-right text-gray-400">{r.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-orange-50">
                          <td colSpan={2} className="py-2 px-4 font-bold text-gray-800 text-sm">TOTAL</td>
                          <td className="py-2 px-4 text-right font-bold tabular-nums">{fmtCurrency(data103.totales.base_imponible_renta)}</td>
                          <td className="py-2 px-4 text-right font-bold text-orange-800 tabular-nums">{fmtCurrency(data103.totales.total_retenido_renta)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>

                {/* Retenciones IVA */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-purple-50 border-b border-purple-100 px-6 py-3">
                    <h3 className="font-bold text-purple-800">Retenciones IVA — {periodoLabel}</h3>
                    <p className="text-xs text-purple-600">Código impuesto: 2 (30%, 70%, 100%)</p>
                  </div>
                  {data103.retenciones_iva.length === 0 ? (
                    <p className="p-6 text-sm text-gray-400 text-center">Sin retenciones de IVA en este período</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                          <th className="py-2 px-4 text-left">Código</th>
                          <th className="py-2 px-4 text-right">Tarifa</th>
                          <th className="py-2 px-4 text-right">Base</th>
                          <th className="py-2 px-4 text-right">Retenido</th>
                          <th className="py-2 px-4 text-right">#</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data103.retenciones_iva.map((r: RetencionGrupo) => (
                          <tr key={r.codigo_porcentaje} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-4 font-mono text-gray-700">{r.codigo_porcentaje}</td>
                            <td className="py-2 px-4 text-right">{r.tarifa}%</td>
                            <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(r.base_imponible)}</td>
                            <td className="py-2 px-4 text-right font-semibold text-purple-700 tabular-nums">{fmtCurrency(r.valor_retenido)}</td>
                            <td className="py-2 px-4 text-right text-gray-400">{r.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50">
                          <td colSpan={2} className="py-2 px-4 font-bold text-gray-800 text-sm">TOTAL</td>
                          <td className="py-2 px-4 text-right font-bold tabular-nums">{fmtCurrency(data103.totales.base_imponible_iva)}</td>
                          <td className="py-2 px-4 text-right font-bold text-purple-800 tabular-nums">{fmtCurrency(data103.totales.total_retenido_iva)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Modal: Marcar como presentada ── */}
      {presentarId !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPresentarId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl px-6 py-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Send className="h-5 w-5" /> Marcar como presentada
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de formulario SRI (opcional)
                </label>
                <input
                  type="text"
                  value={nroFormulario}
                  onChange={(e) => setNroFormulario(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-400 outline-none"
                  placeholder="Ej: 12345678"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setPresentarId(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => presentarMut.mutate({ id: presentarId, nro: nroFormulario })}
                  disabled={presentarMut.isPending}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {presentarMut.isPending ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeclaracionesPage;
