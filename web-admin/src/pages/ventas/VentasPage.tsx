import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ventasService } from '../../services/ventasService';
import { clientesService } from '../../services/clientesService';
import type { Cliente, CoherenciaFacturacionItem, Venta } from '../../types';
import {
  ShoppingCart,
  Search,
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  Eye,
  ReceiptText,
  FileText,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Printer,
  X,
  Users,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ExportButtons from '../../components/ui/ExportButtons';
import { toast } from '../../store/toastStore';
import FiscalReadinessBanner from '../../components/FiscalReadinessBanner';
import NuevaVentaModal from './NuevaVentaModal';

type SeccionVentas = 'ventas' | 'notas' | 'coherencia';

export default function VentasPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [ventaToFacturar, setVentaToFacturar] = useState<Venta | null>(null);
  const [clienteIdOverride, setClienteIdOverride] = useState<number | null>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vista, setVista] = useState<'cerradas' | 'anuladas'>('cerradas');
  const [seccion, setSeccion] = useState<SeccionVentas>('ventas');
  const [soloInconsistentes, setSoloInconsistentes] = useState(true);
  const [nuevaVentaOpen, setNuevaVentaOpen] = useState(false);

  const { data: ventas = [], isLoading: isLoadingVentas } = useQuery({
    queryKey: ['ventas', dateFrom, dateTo, vista],
    queryFn: () =>
      ventasService.getAll({
        ...(dateFrom ? { fecha_desde: dateFrom } : {}),
        ...(dateTo ? { fecha_hasta: dateTo } : {}),
        vista,
      }),
    enabled: seccion === 'ventas',
  });

  const { data: notasVenta = [], isLoading: isLoadingNotas } = useQuery({
    queryKey: ['ventas-notas', dateFrom, dateTo],
    queryFn: () =>
      ventasService.getNotasVenta({
        ...(dateFrom ? { fecha_desde: dateFrom } : {}),
        ...(dateTo ? { fecha_hasta: dateTo } : {}),
      }),
    enabled: seccion === 'notas',
  });

  const { data: coherenciaData, isLoading: isLoadingCoherencia } = useQuery({
    queryKey: ['ventas-coherencia', soloInconsistentes],
    queryFn: () =>
      ventasService.getCoherenciaFacturacion({
        solo_inconsistentes: soloInconsistentes,
        tolerancia: 0,
      }),
    enabled: seccion === 'coherencia',
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: clientesService.getActivos,
    enabled: ventaToFacturar !== null,
  });

  const clientesFiltrados = clientes.filter((c) =>
    c.razon_social.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.identificacion.includes(clienteSearch)
  );

  const clienteSeleccionado = clienteIdOverride
    ? clientes.find((c) => c.id === clienteIdOverride)
    : null;

  const facturarMutation = useMutation({
    mutationFn: ventasService.generarFactura,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['ventas-notas'] });
      queryClient.invalidateQueries({ queryKey: ['ventas-coherencia'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const sri = data?.sri;
      if (sri?.success) {
        toast.success(sri?.mensaje || 'Factura generada y enviada al SRI');
        return;
      }
      if (sri?.mensaje) {
        toast.error(sri.mensaje);
        return;
      }
      toast.success('Factura generada');
      setVentaToFacturar(null);
      setClienteIdOverride(null);
      setClienteSearch('');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'No se pudo generar la factura');
    },
  });

  const reconciliarInconsistenciasMutation = useMutation({
    mutationFn: ventasService.reconciliarInconsistencias,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['ventas-notas'] });
      queryClient.invalidateQueries({ queryKey: ['ventas-coherencia'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const resumen = data?.resumen;
      toast.success(
        `Reconciliación completada. Procesadas: ${resumen?.procesadas ?? 0}, ` +
        `Reconciliadas: ${resumen?.reconciliadas ?? 0}, Pendientes: ${resumen?.pendientes ?? 0}`
      );
    },
    onError: () => {
      toast.error('No se pudo ejecutar la reconciliación masiva.');
    },
  });

  const reconciliarFilaMutation = useMutation({
    mutationFn: ventasService.reconciliarFacturaVenta,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ventas-coherencia'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      if (data?.reconciliada) {
        toast.success(`Venta ${data.numero_venta} reconciliada.`);
      } else {
        toast.error(`Venta ${data.numero_venta} sigue pendiente de ajuste fiscal.`);
      }
    },
    onError: () => {
      toast.error('No se pudo reconciliar la venta seleccionada.');
    },
  });

  const ventasArray = Array.isArray(ventas) ? ventas : [];
  const notasVentaArray = Array.isArray(notasVenta) ? notasVenta : [];
  const datasetActual = seccion === 'notas' ? notasVentaArray : ventasArray;

  const filteredVentas = useMemo(() => {
    return datasetActual.filter(
      (v: Venta) =>
        v.numero_venta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.cliente_detalle?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [datasetActual, searchTerm]);

  const totalPeriodo = datasetActual.reduce(
    (sum: number, v: Venta) => sum + Number(v.total || 0),
    0
  );
  const promedioPeriodo = datasetActual.length > 0 ? totalPeriodo / datasetActual.length : 0;
  const facturadasPeriodo = datasetActual.filter((v: Venta) => v.factura_detalle).length;

  const metodoPagoMap: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    TARJETA_DEBITO: 'Tarjeta débito',
    TARJETA_CREDITO: 'Tarjeta crédito',
    TRANSFERENCIA: 'Transferencia',
    CHEQUE: 'Cheque',
    CREDITO: 'Crédito',
  };

  const metodoPagoColor: Record<string, string> = {
    EFECTIVO: 'bg-green-100 text-green-800',
    TARJETA: 'bg-blue-100 text-blue-800',
    TARJETA_DEBITO: 'bg-blue-100 text-blue-800',
    TARJETA_CREDITO: 'bg-indigo-100 text-indigo-800',
    TRANSFERENCIA: 'bg-sky-100 text-sky-800',
    CHEQUE: 'bg-yellow-100 text-yellow-800',
    CREDITO: 'bg-orange-100 text-orange-800',
  };

  const loadingGeneral = seccion === 'coherencia'
    ? isLoadingCoherencia
    : seccion === 'notas'
      ? isLoadingNotas
      : isLoadingVentas;

  return (
    <div className="p-6 space-y-6">
      <FiscalReadinessBanner />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
            Ventas
          </h1>
          <p className="text-gray-600 mt-1">Control de ventas, notas de venta y coherencia de facturación</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setNuevaVentaOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Nueva venta
          </button>
          <ExportButtons
            basePath="/ventas/ventas"
            filename="ventas"
            queryString={new URLSearchParams({
              ...(dateFrom ? { fecha_desde: dateFrom } : {}),
              ...(dateTo ? { fecha_hasta: dateTo } : {}),
              ...(seccion === 'ventas' ? { vista } : {}),
            }).toString()}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
        <button
          onClick={() => setSeccion('ventas')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${seccion === 'ventas' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Ventas
        </button>
        <button
          onClick={() => setSeccion('notas')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${seccion === 'notas' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Notas de venta
        </button>
        <button
          onClick={() => setSeccion('coherencia')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${seccion === 'coherencia' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Coherencia facturación
        </button>
      </div>

      {seccion !== 'coherencia' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{seccion === 'notas' ? 'Notas de venta' : vista === 'cerradas' ? 'Ventas cerradas' : 'Ventas anuladas'}</p>
                <p className="text-2xl font-bold text-gray-800">{datasetActual.length}</p>
              </div>
              <ShoppingCart className="text-blue-600" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Monto del período</p>
                <p className="text-2xl font-bold text-gray-800">${totalPeriodo.toFixed(2)}</p>
              </div>
              <Calendar className="text-green-500" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Con factura SRI</p>
                <p className="text-2xl font-bold text-gray-800">{facturadasPeriodo}</p>
              </div>
              <TrendingUp className="text-blue-500" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-sky-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Promedio por venta</p>
                <p className="text-2xl font-bold text-gray-800">${promedioPeriodo.toFixed(2)}</p>
              </div>
              <DollarSign className="text-sky-500" size={32} />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={seccion === 'coherencia' ? 'Buscar por número de venta o factura...' : 'Buscar por número de venta o cliente...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {seccion !== 'coherencia' && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm outline-none" />
                <span className="text-gray-300">-</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm outline-none" />
              </div>
            )}
            {seccion === 'ventas' && (
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setVista('cerradas')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${vista === 'cerradas' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
                >
                  Cerradas
                </button>
                <button
                  onClick={() => setVista('anuladas')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${vista === 'anuladas' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600'}`}
                >
                  Anuladas
                </button>
              </div>
            )}
            {seccion === 'coherencia' && (
              <>
                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={soloInconsistentes}
                    onChange={(e) => setSoloInconsistentes(e.target.checked)}
                  />
                  Solo inconsistentes
                </label>
                <button
                  type="button"
                  onClick={() => reconciliarInconsistenciasMutation.mutate()}
                  disabled={reconciliarInconsistenciasMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={reconciliarInconsistenciasMutation.isPending ? 'animate-spin' : ''} />
                  Reconciliar inconsistencias
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {seccion === 'coherencia' ? (
        <CoherenciaTable
          loading={loadingGeneral}
          searchTerm={searchTerm}
          data={coherenciaData?.resultados ?? []}
          resumen={coherenciaData?.resumen}
          onReconciliarFila={(ventaId) => reconciliarFilaMutation.mutate(ventaId)}
          isReconcilingRow={reconciliarFilaMutation.isPending}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loadingGeneral ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
            </div>
          ) : filteredVentas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <ShoppingCart size={48} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium">No hay registros para este filtro</p>
              <p className="text-sm mt-1">Ajusta el rango o cambia de apartado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Venta</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Método de Pago</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVentas.map((venta: Venta) => (
                    <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-blue-700">{venta.numero_venta}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">{venta.cliente_detalle?.razon_social || 'Consumidor Final'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {venta.fecha_venta ? format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {(venta.pagos ?? []).map((p, i) => (
                          <span key={i} className={`px-2 py-1 rounded-full text-xs font-semibold mr-1 ${metodoPagoColor[p.forma_pago] || 'bg-gray-100 text-gray-700'}`}>
                            <CreditCard size={10} className="inline mr-1" />
                            {metodoPagoMap[p.forma_pago] || p.forma_pago}
                          </span>
                        ))}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${venta.estado === 'ANULADA' || venta.factura_detalle?.estado === 'ANULADO' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {venta.estado === 'ANULADA' || venta.factura_detalle?.estado === 'ANULADO' ? 'Anulada' : 'Completada'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {venta.factura_detalle ? (
                          <div>
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Factura SRI</span>
                            <p className="mt-1 font-mono text-xs text-gray-500">{venta.factura_detalle.numero_factura}</p>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Nota de venta / ticket</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-gray-900">${Number(venta.total || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedVenta(venta)}
                          className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={18} />
                        </button>
                        {!venta.factura_detalle && venta.estado === 'COMPLETADA' && (
                          <button
                            onClick={() => { setVentaToFacturar(venta); setClienteIdOverride(null); setClienteSearch(''); }}
                            disabled={facturarMutation.isPending}
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Generar factura desde esta nota de venta"
                          >
                            <ReceiptText size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación de facturación */}
      {ventaToFacturar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-800">Generar Factura Electrónica</h2>
              <button onClick={() => setVentaToFacturar(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Advertencia */}
              <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-amber-800">
                  Esta acción enviará la factura al <strong>SRI</strong>. Una vez emitida no puede revertirse sin crear una nota de crédito.
                </p>
              </div>

              {/* Info venta */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <p className="text-gray-500">Venta: <span className="font-mono font-semibold text-gray-800">{ventaToFacturar.numero_venta}</span></p>
                <p className="text-gray-500">Total: <span className="font-semibold text-gray-800">${Number(ventaToFacturar.total).toFixed(2)}</span></p>
                <p className="text-gray-500">Cliente actual: <span className="font-semibold text-gray-800">{ventaToFacturar.cliente_detalle?.razon_social || 'Consumidor Final'}</span></p>
              </div>

              {/* Selector de cliente */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-gray-500" />
                  <p className="text-sm font-medium text-gray-700">¿Cambiar cliente para la factura?</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o identificación..."
                    value={clienteSearch}
                    onChange={(e) => { setClienteSearch(e.target.value); setClienteIdOverride(null); }}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                {clienteSearch && clientesFiltrados.length > 0 && !clienteSeleccionado && (
                  <ul className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {clientesFiltrados.slice(0, 8).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => { setClienteIdOverride(c.id); setClienteSearch(c.razon_social); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm"
                        >
                          <span className="font-medium text-gray-800">{c.razon_social}</span>
                          <span className="ml-2 text-gray-400 font-mono text-xs">{c.identificacion}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {clienteSeleccionado && (
                  <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">{clienteSeleccionado.razon_social}</p>
                      <p className="text-xs text-blue-600 font-mono">{clienteSeleccionado.identificacion}</p>
                    </div>
                    <button
                      onClick={() => { setClienteIdOverride(null); setClienteSearch(''); }}
                      className="text-blue-400 hover:text-blue-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {!clienteSearch && !clienteSeleccionado && (
                  <p className="mt-1 text-xs text-gray-400">Si no cambias el cliente, se facturará a: <strong>{ventaToFacturar.cliente_detalle?.razon_social || 'Consumidor Final'}</strong></p>
                )}
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setVentaToFacturar(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => facturarMutation.mutate({ id: ventaToFacturar.id, cliente_id: clienteIdOverride ?? undefined })}
                disabled={facturarMutation.isPending}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {facturarMutation.isPending ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Enviando...</>
                ) : (
                  <><ReceiptText size={16} /> Confirmar y facturar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVenta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Venta {selectedVenta.numero_venta}</h2>
                <p className="text-xs text-gray-500 mt-1">{selectedVenta.factura_detalle ? `Factura: ${selectedVenta.factura_detalle.numero_factura}` : 'Nota de venta/Ticket'}</p>
              </div>
              <div className="flex items-center gap-2">
                {!selectedVenta.factura_detalle && (
                  <button
                    onClick={() => {
                      const printContent = `
                        <html>
                          <head>
                            <title>Nota de Venta ${selectedVenta.numero_venta}</title>
                            <style>
                              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }
                              .header { text-align: center; margin-bottom: 20px; }
                              .header h1 { margin: 0; font-size: 16px; }
                              .header p { margin: 2px 0; }
                              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                              th { background: #f3f4f6; border-bottom: 2px solid #333; padding: 8px; text-align: left; font-weight: bold; }
                              td { border-bottom: 1px solid #e5e7eb; padding: 8px; }
                              .total-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
                              .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                              .total-amount { font-weight: bold; font-size: 14px; }
                              .text-right { text-align: right; }
                              @media print { body { margin: 0; padding: 10px; } }
                            </style>
                          </head>
                          <body>
                            <div class="header">
                              <h1>NOTA DE VENTA</h1>
                              <p><strong>Nro: ${selectedVenta.numero_venta}</strong></p>
                              <p>Fecha: ${selectedVenta.fecha_venta ? format(new Date(selectedVenta.fecha_venta), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}</p>
                              <p>Cliente: ${selectedVenta.cliente_detalle?.razon_social || 'Consumidor Final'}</p>
                            </div>
                            <table>
                              <thead>
                                <tr>
                                  <th>Producto</th>
                                  <th class="text-right">Cantidad</th>
                                  <th class="text-right">Precio</th>
                                  <th class="text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${(selectedVenta.detalles || []).map(d => `
                                  <tr>
                                    <td>${d.producto_detalle?.nombre || 'Producto'}</td>
                                    <td class="text-right">${Number(d.cantidad).toFixed(2)}</td>
                                    <td class="text-right">$${Number(d.precio_unitario).toFixed(2)}</td>
                                    <td class="text-right">$${Number(d.total).toFixed(2)}</td>
                                  </tr>
                                `).join('')}
                              </tbody>
                            </table>
                            <div class="total-section">
                              <div class="total-row">
                                <span>Subtotal:</span>
                                <span class="text-right">$${Number(selectedVenta.subtotal).toFixed(2)}</span>
                              </div>
                              ${Number(selectedVenta.descuento) > 0 ? `
                                <div class="total-row">
                                  <span>Descuento:</span>
                                  <span class="text-right">-$${Number(selectedVenta.descuento).toFixed(2)}</span>
                                </div>
                              ` : ''}
                              ${Number(selectedVenta.iva) > 0 ? `
                                <div class="total-row">
                                  <span>IVA:</span>
                                  <span class="text-right">$${Number(selectedVenta.iva).toFixed(2)}</span>
                                </div>
                              ` : ''}
                              <div class="total-row" style="border-top: 1px solid #999; padding-top: 8px; margin-top: 8px;">
                                <span class="total-amount">TOTAL:</span>
                                <span class="text-right total-amount">$${Number(selectedVenta.total).toFixed(2)}</span>
                              </div>
                            </div>
                          </body>
                        </html>
                      `;
                      const printWindow = window.open('', '', 'width=600,height=800');
                      if (printWindow) {
                        printWindow.document.write(printContent);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                    title="Imprimir nota de venta"
                  >
                    <Printer size={20} />
                  </button>
                )}
                <button onClick={() => setSelectedVenta(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-gray-500 text-xs">Cliente</p>
                  <p className="font-medium">{selectedVenta.cliente_detalle?.razon_social || 'Consumidor Final'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Fecha</p>
                  <p className="font-medium">{selectedVenta.fecha_venta ? format(new Date(selectedVenta.fecha_venta), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}</p>
                </div>
              </div>

              {selectedVenta.detalles && selectedVenta.detalles.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Items de la venta</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b-2">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Producto</th>
                          <th className="text-right px-3 py-2 font-semibold">Cant.</th>
                          <th className="text-right px-3 py-2 font-semibold">P. Unit.</th>
                          <th className="text-right px-3 py-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedVenta.detalles.map((detalle, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800">
                              <div className="font-medium">{detalle.producto_detalle?.nombre || `Producto ${detalle.producto}`}</div>
                              <div className="text-xs text-gray-500">{detalle.producto_detalle?.codigo_principal}</div>
                            </td>
                            <td className="text-right px-3 py-2 text-gray-700">{Number(detalle.cantidad).toFixed(2)}</td>
                            <td className="text-right px-3 py-2 text-gray-700">${Number(detalle.precio_unitario).toFixed(2)}</td>
                            <td className="text-right px-3 py-2 font-semibold text-gray-900">${Number(detalle.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t-2 pt-4 space-y-2 bg-blue-50 p-4 rounded-lg">
                {Number(selectedVenta.subtotal || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-800">${Number(selectedVenta.subtotal).toFixed(2)}</span>
                  </div>
                )}
                {Number(selectedVenta.descuento || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Descuento:</span>
                    <span className="text-rose-600">-${Number(selectedVenta.descuento).toFixed(2)}</span>
                  </div>
                )}
                {Number(selectedVenta.iva || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA:</span>
                    <span className="text-gray-800">${Number(selectedVenta.iva).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t-2 pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-blue-700">${Number(selectedVenta.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 pt-3 border-t flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setSelectedVenta(null)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {nuevaVentaOpen && (
        <NuevaVentaModal
          onClose={() => setNuevaVentaOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['ventas'] });
            queryClient.invalidateQueries({ queryKey: ['ventas-notas'] });
            queryClient.invalidateQueries({ queryKey: ['ventas-coherencia'] });
            queryClient.invalidateQueries({ queryKey: ['facturas'] });
            setSeccion('ventas');
            setVista('cerradas');
          }}
        />
      )}
    </div>
  );
}

type CoherenciaTableProps = {
  loading: boolean;
  searchTerm: string;
  data: CoherenciaFacturacionItem[];
  onReconciliarFila: (ventaId: number) => void;
  isReconcilingRow: boolean;
  resumen?: {
    ventas_facturadas: number;
    coherentes: number;
    inconsistentes: number;
    tolerancia: number;
  };
};

function CoherenciaTable({ loading, searchTerm, data, resumen, onReconciliarFila, isReconcilingRow }: CoherenciaTableProps) {
  const filtered = data.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.numero_venta?.toLowerCase().includes(term) ||
      (item.numero_factura || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ventas facturadas</p>
              <p className="text-2xl font-bold text-gray-800">{resumen?.ventas_facturadas ?? 0}</p>
            </div>
            <FileText className="text-slate-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Coherentes</p>
              <p className="text-2xl font-bold text-gray-800">{resumen?.coherentes ?? 0}</p>
            </div>
            <ShieldCheck className="text-emerald-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Inconsistentes</p>
              <p className="text-2xl font-bold text-gray-800">{resumen?.inconsistentes ?? 0}</p>
            </div>
            <AlertTriangle className="text-amber-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tolerancia</p>
              <p className="text-2xl font-bold text-gray-800">${Number(resumen?.tolerancia ?? 0).toFixed(2)}</p>
            </div>
            <DollarSign className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No hay registros de coherencia para mostrar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Venta</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Factura</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Venta</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Factura</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Diferencia</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.venta_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-blue-700">{row.numero_venta}</td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">{row.numero_factura || '-'}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-800">${Number(row.total_venta).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-800">${Number(row.total_factura).toFixed(2)}</td>
                    <td className={`px-6 py-4 text-right text-sm font-semibold ${Math.abs(Number(row.diferencia || 0)) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      ${Number(row.diferencia).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.estado_factura || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      {Math.abs(Number(row.diferencia || 0)) > 0 ? (
                        <button
                          type="button"
                          onClick={() => onReconciliarFila(row.venta_id)}
                          disabled={isReconcilingRow}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isReconcilingRow ? 'animate-spin' : ''} />
                          Reconciliar
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-semibold">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
