import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  FileSpreadsheet,
  Printer,
  ReceiptText,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { ventasService } from '../../services/ventasService';
import { facturasService } from '../../services/facturasService';
import { carteraService } from '../../services/carteraService';
import type { Venta, Factura, AgingBucket, CarteraResumen } from '../../types';
import { exportToExcelMultiSheet, printElement } from '../../utils/exportUtils';

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#059669'];
const TABS = [
  { key: 'ventas', label: 'Ventas' },
  { key: 'sri', label: 'SRI' },
  { key: 'cartera', label: 'Cartera' },
] as const;

type TabKey = typeof TABS[number]['key'];

const money = (value: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

const metodoPagoLabel: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'T. Crédito',
  TARJETA_DEBITO: 'T. Débito',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  CREDITO: 'Crédito',
};

function parseDateOnly(value?: string) {
  if (!value) return '';
  return value.split('T')[0].split(' ')[0];
}

function Card({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function ReportesPage() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(subDays(today, 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(today, 'yyyy-MM-dd'));
  const [tab, setTab] = useState<TabKey>('ventas');

  const { data: ventas = [], isLoading: loadingVentas } = useQuery({
    queryKey: ['reportes', 'ventas', dateFrom, dateTo],
    queryFn: () => ventasService.getAll({ fecha_desde: dateFrom, fecha_hasta: dateTo }),
    staleTime: 60_000,
  });
  const { data: facturas = [], isLoading: loadingFacturas } = useQuery({
    queryKey: ['reportes', 'facturas', dateFrom, dateTo],
    queryFn: () => facturasService.getAll({ fecha_desde: dateFrom, fecha_hasta: dateTo }),
    staleTime: 60_000,
  });
  const { data: carteraResumen, isLoading: loadingCarteraResumen } = useQuery<CarteraResumen>({
    queryKey: ['reportes', 'cartera', 'resumen'],
    queryFn: carteraService.getResumen,
    staleTime: 60_000,
  });
  const { data: aging = [], isLoading: loadingAging } = useQuery<AgingBucket[]>({
    queryKey: ['reportes', 'cartera', 'aging'],
    queryFn: carteraService.getAging,
    staleTime: 60_000,
  });

  const ventasCerradas = useMemo(
    () =>
      (ventas as Venta[]).filter(
        (venta) => venta.estado === 'COMPLETADA' && venta.factura_detalle?.estado !== 'ANULADO',
      ),
    [ventas],
  );

  const ventasAnuladas = useMemo(
    () =>
      (ventas as Venta[]).filter(
        (venta) => venta.estado === 'ANULADA' || venta.factura_detalle?.estado === 'ANULADO',
      ),
    [ventas],
  );

  const facturasFiltradas = useMemo(() => facturas as Factura[], [facturas]);

  const ventasPorDia = useMemo(() => {
    const map = new Map<string, { total: number; cantidad: number }>();
    for (const venta of ventasCerradas) {
      const fecha = parseDateOnly(venta.fecha_venta);
      const current = map.get(fecha) || { total: 0, cantidad: 0 };
      current.total += Number(venta.total || 0);
      current.cantidad += 1;
      map.set(fecha, current);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, values]) => ({
        fecha: format(parseISO(fecha), 'd MMM', { locale: es }),
        total: Number(values.total.toFixed(2)),
        cantidad: values.cantidad,
      }));
  }, [ventasCerradas]);

  const ventasPorMetodo = useMemo(() => {
    const map = new Map<string, number>();
    for (const venta of ventasCerradas) {
      if (venta.pagos && venta.pagos.length > 0) {
        for (const pago of venta.pagos) {
          const metodo = pago.forma_pago || 'OTRO';
          map.set(metodo, (map.get(metodo) || 0) + Number(pago.monto || 0));
        }
      } else {
        map.set('OTRO', (map.get('OTRO') || 0) + Number(venta.total || 0));
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name: metodoPagoLabel[name] || name,
      value: Number(value.toFixed(2)),
    }));
  }, [ventasCerradas]);

  const topClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; total: number; cantidad: number }>();
    for (const venta of ventasCerradas) {
      const key = venta.cliente_detalle?.identificacion || `cliente-${venta.cliente}`;
      const current = map.get(key) || {
        cliente: venta.cliente_detalle?.razon_social || 'Cliente no identificado',
        total: 0,
        cantidad: 0,
      };
      current.total += Number(venta.total || 0);
      current.cantidad += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [ventasCerradas]);

  const sriPorEstado = useMemo(() => {
    const map = new Map<string, number>();
    for (const factura of facturasFiltradas) {
      map.set(factura.estado, (map.get(factura.estado) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [facturasFiltradas]);

  const sriPorCliente = useMemo(() => {
    const map = new Map<string, { cliente: string; total: number; docs: number }>();
    for (const factura of facturasFiltradas) {
      const key = factura.cliente_nombre || `cliente-${factura.cliente}`;
      const current = map.get(key) || { cliente: factura.cliente_nombre || 'Cliente', total: 0, docs: 0 };
      current.total += Number(factura.total || 0);
      current.docs += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [facturasFiltradas]);

  const ventasTotal = ventasCerradas.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const promedioVenta = ventasCerradas.length ? ventasTotal / ventasCerradas.length : 0;
  const ventasAnuladasTotal = ventasAnuladas.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const facturasAutorizadas = facturasFiltradas.filter((item) => item.estado === 'AUTORIZADO').length;
  const facturasPendientesSRI = facturasFiltradas.filter((item) => item.estado === 'ENVIADO').length;
  const facturasConError = facturasFiltradas.filter((item) => ['RECHAZADO', 'NO_AUTORIZADO'].includes(item.estado)).length;

  const exportarExcel = () => {
    const ventasSheet = ventasCerradas.map((venta) => ({
      Fecha: parseDateOnly(venta.fecha_venta),
      Venta: venta.numero_venta,
      Cliente: venta.cliente_detalle?.razon_social || 'Consumidor Final',
      Estado: venta.estado,
      Total: Number(venta.total || 0).toFixed(2),
      Pago: venta.pagos?.map((p) => p.forma_pago).join('/') || 'OTRO',
    }));
    const facturasSheet = facturasFiltradas.map((factura) => ({
      Fecha: parseDateOnly(factura.fecha_emision),
      Factura: factura.numero_factura,
      Cliente: factura.cliente_nombre || '',
      Estado: factura.estado,
      Total: Number(factura.total || 0).toFixed(2),
      Autorizacion: factura.numero_autorizacion || '',
    }));
    const carteraSheet = (aging || []).flatMap((bucket) =>
      bucket.cuentas.map((cuenta) => ({
        Bucket: bucket.label,
        Cliente: cuenta.cliente,
        Cuenta: cuenta.numero_cuenta,
        Vencimiento: cuenta.fecha_vencimiento,
        Saldo: Number(cuenta.saldo || 0).toFixed(2),
        Dias: cuenta.dias_vencimiento,
      })),
    );
    exportToExcelMultiSheet(
      [
        { name: 'Ventas Cerradas', data: ventasSheet as Record<string, unknown>[] },
        { name: 'Facturas SRI', data: facturasSheet as Record<string, unknown>[] },
        { name: 'Cartera', data: carteraSheet as Record<string, unknown>[] },
      ],
      `reportes_erp_${dateFrom}_${dateTo}`,
    );
  };

  const loading = loadingVentas || loadingFacturas || loadingCarteraResumen || loadingAging;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8" id="reporte-contenido">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Reportes de gestión</h1>
          <p className="mt-2 text-sm text-slate-500">
            Vista consolidada de ventas, cumplimiento SRI y cartera para toma de decisiones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm text-slate-700 outline-none" />
            <span className="text-slate-300">—</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm text-slate-700 outline-none" />
          </div>
          <button onClick={exportarExcel} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button onClick={() => printElement('reporte-contenido')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-slate-800" />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {tab === 'ventas' && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card label="Ventas cerradas" value={money(ventasTotal)} helper={`${ventasCerradas.length} ventas`} />
                <Card label="Promedio por venta" value={money(promedioVenta)} helper="Ticket medio real del rango filtrado" />
                <Card label="Ventas anuladas" value={money(ventasAnuladasTotal)} helper={`${ventasAnuladas.length} ventas anuladas/canceladas`} />
                <Card label="Métodos activos" value={String(ventasPorMetodo.length)} helper="Formas de pago registradas" />
                <Card label="Top cliente" value={topClientes[0]?.cliente || 'Sin datos'} helper={topClientes[0] ? money(topClientes[0].total) : undefined} />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Evolución de ventas</h2>
                    <p className="text-sm text-slate-500">Ingreso diario y número de tickets del período.</p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={ventasPorDia}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="cantidad" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Métodos de pago</h2>
                    <p className="text-sm text-slate-500">Distribución de cobro en el período.</p>
                  </div>
                  {ventasPorMetodo.length === 0 ? (
                    <div className="flex h-60 items-center justify-center text-sm text-slate-400">Sin ventas para este rango</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={ventasPorMetodo} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                            {ventasPorMetodo.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {ventasPorMetodo.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="text-slate-600">{item.name}</span>
                            </div>
                            <span className="font-medium text-slate-900">{money(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Top clientes</h2>
                    <p className="text-sm text-slate-500">Clientes con mayor volumen de compra en el período.</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-slate-400" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {topClientes.map((cliente) => (
                    <div key={`${cliente.cliente}-${cliente.total}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="font-medium text-slate-900">{cliente.cliente}</p>
                      <p className="mt-1 text-sm text-slate-500">{cliente.cantidad} venta(s)</p>
                      <p className="mt-2 text-lg font-semibold text-emerald-700">{money(cliente.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'sri' && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card label="Facturas del período" value={String(facturasFiltradas.length)} helper="Documentos filtrados por fecha" />
                <Card label="Autorizadas" value={String(facturasAutorizadas)} helper="Comprobantes OK en SRI" />
                <Card label="Pendientes SRI" value={String(facturasPendientesSRI)} helper="Estado ENVIADO" />
                <Card label="Con error SRI" value={String(facturasConError)} helper="RECHAZADO o NO_AUTORIZADO" />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Estados SRI</h2>
                    <p className="text-sm text-slate-500">Distribución de facturas por estado en el rango seleccionado.</p>
                  </div>
                  {sriPorEstado.length === 0 ? (
                    <div className="flex h-60 items-center justify-center text-sm text-slate-400">Sin facturas para este rango</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={sriPorEstado} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88}>
                            {sriPorEstado.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {sriPorEstado.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="text-slate-600">{item.name}</span>
                            </div>
                            <span className="font-medium text-slate-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Facturación por cliente</h2>
                    <p className="text-sm text-slate-500">Clientes con mayor monto facturado electrónicamente.</p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sriPorCliente} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="cliente" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#2563eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Últimas facturas del período</h2>
                    <p className="text-sm text-slate-500">Detalle útil para revisar pendientes y errores.</p>
                  </div>
                  <ReceiptText className="h-5 w-5 text-slate-400" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Factura</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasFiltradas.slice(0, 20).map((factura) => (
                        <tr key={factura.id} className="border-b border-slate-100">
                          <td className="px-3 py-2">{parseDateOnly(factura.fecha_emision)}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{factura.numero_factura}</td>
                          <td className="px-3 py-2">{factura.cliente_nombre}</td>
                          <td className="px-3 py-2">{factura.estado}</td>
                          <td className="px-3 py-2 text-right font-medium">{money(Number(factura.total || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === 'cartera' && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card label="Total por cobrar" value={money(carteraResumen?.total_por_cobrar || 0)} helper={`${carteraResumen?.cuentas_pendientes || 0} cuentas activas`} />
                <Card label="Total vencido" value={money(carteraResumen?.total_vencido || 0)} helper={`${carteraResumen?.cuentas_vencidas || 0} cuentas vencidas`} />
                <Card label="Cobrado mes" value={money(carteraResumen?.cobrado_mes || 0)} helper="Ingresos aplicados a cartera" />
                <Card label="Incobrable" value={money(carteraResumen?.total_incobrable || 0)} helper="Cuentas marcadas como pérdida" />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Aging de cartera</h2>
                    <p className="text-sm text-slate-500">Cómo se distribuye la deuda según el vencimiento.</p>
                  </div>
                  {aging.length === 0 ? (
                    <div className="flex h-60 items-center justify-center text-sm text-slate-400">Sin cuentas por cobrar registradas</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={aging.map((bucket) => ({ label: bucket.label, total: bucket.total }))}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#d97706" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Cuentas críticas</h2>
                    <p className="text-sm text-slate-500">Detalle de vencidas y saldos pendientes por bucket.</p>
                  </div>
                  <div className="space-y-4">
                    {aging.filter((bucket) => bucket.total > 0).map((bucket) => (
                      <div key={bucket.bucket} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`h-4 w-4 ${bucket.bucket === 'vigente' ? 'text-blue-600' : 'text-amber-600'}`} />
                            <p className="font-medium text-slate-900">{bucket.label}</p>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{money(bucket.total)}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {bucket.cuentas.slice(0, 3).map((cuenta) => (
                            <div key={cuenta.id} className="flex items-center justify-between text-sm">
                              <div>
                                <p className="text-slate-700">{cuenta.cliente}</p>
                                <p className="text-xs text-slate-500">{cuenta.numero_cuenta}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-slate-900">{money(Number(cuenta.saldo || 0))}</p>
                                <p className="text-xs text-slate-500">{cuenta.dias_vencimiento} días</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
