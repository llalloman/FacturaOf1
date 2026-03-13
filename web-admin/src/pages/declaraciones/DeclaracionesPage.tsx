import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart2, Download, AlertCircle } from 'lucide-react';
import { declaracionesService } from '../../services/declaracionesService';
import type { RetencionGrupo } from '../../services/declaracionesService';
import { toast } from '../../store/toastStore';

const MESES = [
  '', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

// ── Row helpers ───────────────────────────────────────────────────────────────
const Row: React.FC<{
  label: string;
  value: string | number;
  highlight?: boolean;
  bold?: boolean;
}> = ({ label, value, highlight, bold }) => (
  <tr className={`border-b border-gray-100 ${highlight ? 'bg-blue-50' : ''}`}>
    <td className={`py-2 px-4 text-sm text-gray-600 ${bold ? 'font-semibold text-gray-900' : ''}`}>{label}</td>
    <td className={`py-2 px-4 text-sm text-right tabular-nums ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</td>
  </tr>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const DeclaracionesPage: React.FC = () => {
  const currentDate = new Date();
  const [anio, setAnio]   = useState(currentDate.getFullYear());
  const [mes, setMes]     = useState(currentDate.getMonth() || 12); // mes anterior por defecto
  const [activeTab, setActiveTab] = useState<'104' | '103'>('104');
  const [loadingAts, setLoadingAts] = useState(false);

  const {
    data: data104,
    isLoading: loading104,
    error: error104,
  } = useQuery({
    queryKey: ['form104', anio, mes],
    queryFn: () => declaracionesService.getForm104(anio, mes),
    enabled: mes > 0,
  });

  const {
    data: data103,
    isLoading: loading103,
    error: error103,
  } = useQuery({
    queryKey: ['form103', anio, mes],
    queryFn: () => declaracionesService.getForm103(anio, mes),
    enabled: mes > 0,
  });

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

  const periodoLabel = mes > 0 ? `${MESES[mes]} ${anio}` : '—';

  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <FileBarChart2 className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Declaraciones SRI</h1>
            <p className="text-sm text-gray-500">Form. 104 (IVA), 103 (Retenciones), ATS</p>
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
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="font-semibold text-indigo-800 text-sm">Anexo Transaccional Simplificado (ATS)</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Descarga el XML del período <span className="font-semibold">{periodoLabel}</span> listo para subir al DIMM Formularios del SRI
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
        {(['104', '103'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === '104' ? 'Form. 104 — IVA' : 'Form. 103 — Retenciones'}
          </button>
        ))}
      </div>

      {/* ── FORM 104 ── */}
      {activeTab === '104' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {loading104 ? (
            <div className="col-span-2 flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : error104 ? (
            <div className="col-span-2 bg-red-50 border border-red-200 rounded-xl p-6 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">Error al cargar el formulario 104. Verifique el período seleccionado.</p>
            </div>
          ) : data104 ? (
            <>
              {/* Ventas */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-green-50 border-b border-green-100 px-6 py-3">
                  <h3 className="font-bold text-green-800">Declaración de Ventas — {periodoLabel}</h3>
                  <p className="text-xs text-green-600">{data104.ventas.num_comprobantes} comprobantes autorizados</p>
                </div>
                <table className="w-full">
                  <tbody>
                    <Row label="Ventas tarifa 0%" value={fmtCurrency(data104.ventas.subtotal_0)} />
                    <Row label="Ventas tarifa 12%" value={fmtCurrency(data104.ventas.subtotal_12)} />
                    <Row label="Ventas tarifa 15%" value={fmtCurrency(data104.ventas.subtotal_15)} />
                    <Row label="Descuentos" value={`- ${fmtCurrency(data104.ventas.total_descuento)}`} />
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="py-2 px-4 text-sm font-semibold text-gray-600">IVA 12% cobrado</td>
                      <td className="py-2 px-4 text-sm text-right font-semibold text-gray-800">{fmtCurrency(data104.ventas.iva_12)}</td>
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="py-2 px-4 text-sm font-semibold text-gray-600">IVA 15% cobrado</td>
                      <td className="py-2 px-4 text-sm text-right font-semibold text-gray-800">{fmtCurrency(data104.ventas.iva_15)}</td>
                    </tr>
                    <Row label="Total IVA ventas" value={fmtCurrency(data104.ventas.iva_total)} bold highlight />
                    <Row label="Total ventas neto" value={fmtCurrency(data104.ventas.total_ventas_neto)} bold />
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
                      <Row label="IVA en compras" value={fmtCurrency(data104.compras.iva_compras)} />
                      <Row label="Total compras" value={fmtCurrency(data104.compras.total_compras)} bold />
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3">
                    <h3 className="font-bold text-indigo-800">Liquidación IVA</h3>
                  </div>
                  <table className="w-full">
                    <tbody>
                      <Row label="IVA en ventas" value={fmtCurrency(data104.ventas.iva_total)} />
                      <Row label="IVA en compras (crédito)" value={`- ${fmtCurrency(data104.compras.iva_compras)}`} />
                      <Row label="IVA retenido emitido" value={`- ${fmtCurrency(data104.retenciones_iva)}`} />
                      <Row label="Crédito tributario" value={fmtCurrency(data104.credito_tributario)} />
                      <Row label="IVA A PAGAR" value={fmtCurrency(data104.iva_a_pagar)} bold highlight />
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
      )}

      {/* ── FORM 103 ── */}
      {activeTab === '103' && (
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
                  <h3 className="font-bold text-orange-800">Retenciones en la Fuente IR — {periodoLabel}</h3>
                  <p className="text-xs text-orange-600">Según tabla de retenciones vigente (código impuesto: 1)</p>
                </div>
                {data103.retenciones_renta.length === 0 ? (
                  <p className="p-6 text-sm text-gray-400 text-center">Sin retenciones de renta en este período</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="py-2 px-4 text-left">Código</th>
                        <th className="py-2 px-4 text-right">Tarifa %</th>
                        <th className="py-2 px-4 text-right">Base</th>
                        <th className="py-2 px-4 text-right">Retenido</th>
                        <th className="py-2 px-4 text-right">N°</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data103.retenciones_renta.map((r: RetencionGrupo) => (
                        <tr key={r.codigo_porcentaje} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-4 font-mono text-gray-700">{r.codigo_porcentaje}</td>
                          <td className="py-2 px-4 text-right">{r.tarifa}%</td>
                          <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(r.base_total)}</td>
                          <td className="py-2 px-4 text-right font-semibold text-orange-700 tabular-nums">{fmtCurrency(r.retenido_total)}</td>
                          <td className="py-2 px-4 text-right text-gray-400">{r.num_retenciones}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50">
                        <td colSpan={2} className="py-2 px-4 font-bold text-gray-800 text-sm">TOTAL</td>
                        <td className="py-2 px-4 text-right font-bold tabular-nums">{fmtCurrency(data103.totales.base_imponible_total)}</td>
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
                  <h3 className="font-bold text-purple-800">Retenciones de IVA — {periodoLabel}</h3>
                  <p className="text-xs text-purple-600">Código impuesto: 2 (30%, 70%, 100%)</p>
                </div>
                {data103.retenciones_iva.length === 0 ? (
                  <p className="p-6 text-sm text-gray-400 text-center">Sin retenciones de IVA en este período</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="py-2 px-4 text-left">Código</th>
                        <th className="py-2 px-4 text-right">Tarifa %</th>
                        <th className="py-2 px-4 text-right">Base</th>
                        <th className="py-2 px-4 text-right">Retenido</th>
                        <th className="py-2 px-4 text-right">N°</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data103.retenciones_iva.map((r: RetencionGrupo) => (
                        <tr key={r.codigo_porcentaje} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-4 font-mono text-gray-700">{r.codigo_porcentaje}</td>
                          <td className="py-2 px-4 text-right">{r.tarifa}%</td>
                          <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(r.base_total)}</td>
                          <td className="py-2 px-4 text-right font-semibold text-purple-700 tabular-nums">{fmtCurrency(r.retenido_total)}</td>
                          <td className="py-2 px-4 text-right text-gray-400">{r.num_retenciones}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DeclaracionesPage;
