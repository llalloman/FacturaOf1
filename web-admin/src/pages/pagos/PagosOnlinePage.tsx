import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CreditCard, Eye, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { pagosService, type PagoOnline, type PagoOnlineFilters } from '../../services/pagosService';
import { useToast } from '../../hooks/useToast';

const money = (value?: string | number | null) => `$${Number(value || 0).toFixed(2)}`;
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('es-EC') : '-';

const estadoBadge: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const estadoLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

const origenLabel: Record<string, string> = {
  FIRMA: 'Firma electrónica',
  SUSCRIPCION: 'Suscripción ERP',
  VENTA: 'Venta',
  CARTERA: 'Cartera',
  OTRO: 'Otro',
};

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge[value] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{estadoLabel[value] ?? value}</span>;
}

function JsonBlock({ title, data }: { title: string; data?: Record<string, unknown> }) {
  const empty = !data || Object.keys(data).length === 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{empty ? 'Sin datos' : JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default function PagosOnlinePage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [filters, setFilters] = useState<PagoOnlineFilters>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['pagos-online', filters],
    queryFn: () => pagosService.listOnline(filters),
  });

  const selected = useMemo(() => pagos.find((p) => p.id === selectedId) ?? pagos[0], [pagos, selectedId]);

  const retryMutation = useMutation({
    mutationFn: (id: number) => pagosService.retryApplication(id),
    onSuccess: () => {
      showToast('Aplicación interna reintentada', 'success');
      queryClient.invalidateQueries({ queryKey: ['pagos-online'] });
    },
    onError: () => {
      showToast('No se pudo aplicar el pago. Revisa el detalle.', 'error');
      queryClient.invalidateQueries({ queryKey: ['pagos-online'] });
    },
  });

  const setFilter = (field: keyof PagoOnlineFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value || undefined }));
  };

  const totalAprobado = pagos.filter((p) => p.estado === 'APPROVED').reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const conErrorAplicacion = pagos.filter((p) => p.application_error).length;

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-600"><CreditCard size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Pagos Online</h1>
            <p className="text-sm text-slate-500">Audita cobros PayPhone, aplicación a ventas y movimientos bancarios.</p>
          </div>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['pagos-online'] })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-white">
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Transacciones</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pagos.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Aprobado filtrado</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{money(totalAprobado)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Errores aplicación</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{conErrorAplicacion}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Buscar transacción" value={filters.search ?? ''} onChange={(e) => setFilter('search', e.target.value)} />
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.estado ?? ''} onChange={(e) => setFilter('estado', e.target.value)}>
          <option value="">Estado</option><option value="APPROVED">Aprobado</option><option value="PENDING">Pendiente</option><option value="FAILED">Fallido</option><option value="CANCELLED">Cancelado</option>
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.origen ?? ''} onChange={(e) => setFilter('origen', e.target.value)}>
          <option value="">Origen</option><option value="FIRMA">Firma electrónica</option><option value="SUSCRIPCION">Suscripción ERP</option><option value="VENTA">Venta</option><option value="CARTERA">Cartera</option><option value="OTRO">Otro</option>
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.metodo ?? ''} onChange={(e) => setFilter('metodo', e.target.value)}>
          <option value="">Método</option><option value="PAYPHONE">PayPhone</option><option value="TARJETA_CREDITO">Tarjeta crédito</option><option value="TARJETA_DEBITO">Tarjeta débito</option><option value="TRANSFERENCIA">Transferencia</option>
        </select>
        <button onClick={() => setFilters({})} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Limpiar</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Transacción</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Montos</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Aplicación</th><th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></td></tr>}
                {!isLoading && pagos.map((pago) => (
                  <tr key={pago.id} className={selected?.id === pago.id ? 'bg-blue-50/60' : ''}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{pago.client_transaction_id}</p><p className="text-xs text-slate-500">{dateTime(pago.confirmed_at || pago.created_at)}</p></td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-700">{origenLabel[pago.origen] ?? pago.origen}</p><p className="text-xs text-slate-500">{pago.provider} - {pago.metodo}</p></td>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{money(pago.total_amount)}</p><p className="text-xs text-slate-500">Base {money(pago.base_amount)} + recargo {money(Number(pago.processing_fee) + Number(pago.processing_fee_tax))}</p></td>
                    <td className="px-4 py-3"><Badge value={pago.estado} /></td>
                    <td className="px-4 py-3">
                      {pago.applied_at ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> Aplicado</span> : pago.application_error ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle size={14} /> Pendiente</span> : <span className="text-xs text-slate-500">Sin aplicar</span>}
                      {pago.venta_numero && <p className="text-xs text-blue-600">Venta {pago.venta_numero}</p>}
                    </td>
                    <td className="px-4 py-3 text-right"><button onClick={() => setSelectedId(pago.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><Eye size={14} /> Ver</button></td>
                  </tr>
                ))}
                {!isLoading && pagos.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No hay pagos con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {!selected ? <div className="py-20 text-center text-sm text-slate-400">Selecciona un pago.</div> : <PagoDetalle pago={selected} retrying={retryMutation.isPending} onRetry={() => retryMutation.mutate(selected.id)} />}
        </div>
      </div>
    </div>
  );
}

function PagoDetalle({ pago, retrying, onRetry }: { pago: PagoOnline; retrying: boolean; onRetry: () => void }) {
  const canRetry = pago.estado === 'APPROVED' && !pago.applied_at;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Detalle de pago</p>
          <h2 className="mt-1 break-all text-lg font-bold text-slate-950">{pago.client_transaction_id}</h2>
        </div>
        <Badge value={pago.estado} />
      </div>

      {pago.application_error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><p className="font-semibold">No se pudo aplicar internamente</p><p className="mt-1">{pago.application_error}</p></div>}
      {pago.error_message && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="font-semibold">Error proveedor</p><p className="mt-1">{pago.error_message}</p></div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Origen" value={origenLabel[pago.origen] ?? pago.origen} />
        <Info label="Origen ID" value={pago.origen_id || '-'} />
        <Info label="Base" value={money(pago.base_amount)} />
        <Info label="Recargo" value={money(pago.processing_fee)} />
        <Info label="IVA recargo" value={money(pago.processing_fee_tax)} />
        <Info label="Total" value={`${money(pago.total_amount)} ${pago.currency}`} />
        <Info label="Confirmado" value={dateTime(pago.confirmed_at)} />
        <Info label="Aplicado" value={dateTime(pago.applied_at)} />
        <Info label="Venta" value={pago.venta_numero || (pago.venta ? `#${pago.venta}` : '-')} />
        <Info label="Movimiento banco" value={pago.movimiento_bancario ? `#${pago.movimiento_bancario}` : '-'} />
        <Info label="Autorización" value={pago.authorization_code || '-'} />
        <Info label="Transacción proveedor" value={pago.provider_transaction_id || '-'} />
      </div>

      {canRetry && <button onClick={onRetry} disabled={retrying} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {retrying ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Reintentar aplicación interna
      </button>}

      <JsonBlock title="Metadata" data={pago.metadata} />
      <JsonBlock title="Respuesta PayPhone" data={pago.raw_response} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>;
}
