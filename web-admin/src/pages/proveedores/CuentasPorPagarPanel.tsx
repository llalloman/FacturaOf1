import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiCreditCard, FiDollarSign, FiFileText, FiSearch, FiXCircle } from 'react-icons/fi';
import { getCuentas, type CuentaBancaria } from '../../services/bancosService';
import {
  proveedoresService,
  type CuentaPorPagarProveedor,
  type PagoProveedorPayload,
} from '../../services/proveedoresService';
import { toast } from '../../store/toastStore';

const PAGE_SIZE = 10;

const estados = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'PARCIAL', label: 'Parciales' },
  { value: 'PAGADA', label: 'Pagadas' },
  { value: 'ANULADA', label: 'Anuladas' },
];

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100';

export default function CuentasPorPagarPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [estado, setEstado] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaPorPagarProveedor | null>(null);
  const queryClient = useQueryClient();

  const { data: cuentas = [], isLoading } = useQuery({
    queryKey: ['proveedores-cuentas-por-pagar'],
    queryFn: () => proveedoresService.getCuentasPorPagar(),
  });

  const { data: resumen } = useQuery({
    queryKey: ['proveedores-cuentas-por-pagar-resumen'],
    queryFn: proveedoresService.getResumenCuentasPorPagar,
  });

  const { data: cuentasBancarias = [] } = useQuery({
    queryKey: ['bancos-cuentas-para-pagos-proveedor'],
    queryFn: getCuentas,
  });

  const pagarMutation = useMutation({
    mutationFn: proveedoresService.registrarPagoProveedor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores-cuentas-por-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-cuentas-por-pagar-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['bancos-cuentas'] });
      setSelectedCuenta(null);
      toast.success('Pago registrado', 'La cuenta por pagar fue actualizada.');
    },
    onError: (error: unknown) => {
      const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
      toast.error(readApiError(data) || 'No se pudo registrar el pago.');
    },
  });

  const cuentasArray = Array.isArray(cuentas) ? cuentas : [];

  const filtered = cuentasArray.filter((cuenta) => {
    const search = searchTerm.toLowerCase();
    const matchText =
      cuenta.numero_cuenta.toLowerCase().includes(search) ||
      cuenta.proveedor_nombre.toLowerCase().includes(search);
    const matchEstado = !estado || cuenta.estado === estado;
    return matchText && matchEstado;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalFiltrado = filtered.reduce((sum, cuenta) => sum + Number(cuenta.saldo || 0), 0);

  const statusTabs = useMemo(() => [
    { value: '', label: 'Todas', count: cuentasArray.length },
    { value: 'PENDIENTE', label: 'Pendientes', count: cuentasArray.filter((c) => c.estado === 'PENDIENTE').length },
    { value: 'PARCIAL', label: 'Parciales', count: cuentasArray.filter((c) => c.estado === 'PARCIAL').length },
    { value: 'PAGADA', label: 'Pagadas', count: cuentasArray.filter((c) => c.estado === 'PAGADA').length },
  ], [cuentasArray]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard title="Deuda pendiente" value={formatMoney(resumen?.total_deuda ?? 0)} icon={<FiDollarSign />} tone="blue" />
        <MetricCard title="CxP pendientes" value={String(resumen?.cuentas_pendientes ?? 0)} icon={<FiFileText />} tone="amber" />
        <MetricCard title="Vencidas" value={String(resumen?.cuentas_vencidas ?? 0)} icon={<FiXCircle />} tone="red" />
        <MetricCard title="Por vencer" value={String(resumen?.por_vencer_7dias ?? 0)} icon={<FiCheckCircle />} tone="emerald" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[260px] flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número o proveedor..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <select
            value={estado}
            onChange={(event) => {
              setEstado(event.target.value);
              setCurrentPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            {estados.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => {
              const active = estado === tab.value;
              return (
                <button
                  key={tab.value || 'todas'}
                  type="button"
                  onClick={() => {
                    setEstado(tab.value);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                    active ? 'bg-blue-700 text-white shadow-md shadow-blue-900/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs font-semibold text-slate-400">{filtered.length} resultado(s)</p>
        </div>
      </section>

      <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-700" />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    <th className="w-[18%] px-4 py-4 text-left">Cuenta</th>
                    <th className="w-[24%] px-4 py-4 text-left">Proveedor</th>
                    <th className="w-[11%] px-4 py-4 text-left">Emisión</th>
                    <th className="w-[11%] px-4 py-4 text-left">Vence</th>
                    <th className="w-[11%] px-4 py-4 text-right">Total</th>
                    <th className="w-[11%] px-4 py-4 text-right">Saldo</th>
                    <th className="w-[8%] px-4 py-4 text-center">Estado</th>
                    <th className="w-[6%] px-4 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((cuenta) => (
                    <tr key={cuenta.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="truncate font-mono text-sm font-black text-slate-950">{cuenta.numero_cuenta}</p>
                        {cuenta.recepcion_numero && <p className="mt-1 truncate text-xs font-semibold text-slate-400">Recepción {cuenta.recepcion_numero}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-black text-blue-700">
                            {(cuenta.proveedor_nombre || 'PR').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{cuenta.proveedor_nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-500">{formatFechaLocal(cuenta.fecha_emision)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-500">
                        {formatFechaLocal(cuenta.fecha_vencimiento)}
                        {cuenta.dias_vencidos > 0 && <p className="mt-1 text-xs font-bold text-red-600">{cuenta.dias_vencidos} día(s) vencida</p>}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-950">{formatMoney(cuenta.monto_total)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-950">{formatMoney(cuenta.saldo)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getEstadoColor(cuenta.estado)}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {cuenta.estado}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {cuenta.estado !== 'PAGADA' && cuenta.estado !== 'ANULADA' && Number(cuenta.saldo) > 0 && (
                          <ActionButton title="Registrar pago" onClick={() => setSelectedCuenta(cuenta)}>
                            <FiCreditCard />
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {paginated.map((cuenta) => (
                <article key={cuenta.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-black text-slate-950">{cuenta.numero_cuenta}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-600">{cuenta.proveedor_nombre}</p>
                    </div>
                    <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${getEstadoColor(cuenta.estado)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {cuenta.estado}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoMini label="Vence" value={formatFechaLocal(cuenta.fecha_vencimiento)} />
                    <InfoMini label="Saldo" value={formatMoney(cuenta.saldo)} alignRight />
                  </div>
                  {cuenta.estado !== 'PAGADA' && cuenta.estado !== 'ANULADA' && Number(cuenta.saldo) > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCuenta(cuenta)}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white"
                    >
                      <FiCreditCard />
                      Registrar pago
                    </button>
                  )}
                </article>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="py-14 text-center">
                <FiFileText className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-600">No se encontraron cuentas por pagar</p>
                <p className="mt-1 text-xs text-slate-400">Convierte documentos recibidos o ajusta los filtros.</p>
              </div>
            )}
          </>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-400">
              {filtered.length} cuenta(s) · Saldo {formatMoney(totalFiltrado)}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage <= 1}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-700 px-3 text-xs font-black text-white">
                {safePage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage >= totalPages}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>

      {selectedCuenta && (
        <PagoProveedorModal
          cuenta={selectedCuenta}
          cuentasBancarias={cuentasBancarias}
          saving={pagarMutation.isPending}
          onClose={() => setSelectedCuenta(null)}
          onSave={(payload) => pagarMutation.mutate(payload)}
        />
      )}
    </div>
  );
}

function PagoProveedorModal({
  cuenta,
  cuentasBancarias,
  saving,
  onClose,
  onSave,
}: {
  cuenta: CuentaPorPagarProveedor;
  cuentasBancarias: CuentaBancaria[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: PagoProveedorPayload) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fechaPago, setFechaPago] = useState(today);
  const [formaPago, setFormaPago] = useState<PagoProveedorPayload['forma_pago']>('TRANSFERENCIA');
  const [monto, setMonto] = useState(String(cuenta.saldo));
  const [cuentaBancaria, setCuentaBancaria] = useState('');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');

  const requiereCuenta = formaPago !== 'NOTA_CREDITO';
  const cuentasActivas = cuentasBancarias.filter((item) => item.activa);

  const handleSubmit = () => {
    const montoNumber = Number(monto);
    if (!montoNumber || montoNumber <= 0) {
      toast.warning('Ingresa un monto válido.');
      return;
    }
    if (montoNumber > Number(cuenta.saldo)) {
      toast.warning('El monto no puede superar el saldo pendiente.');
      return;
    }
    if (requiereCuenta && !cuentaBancaria) {
      toast.warning('Selecciona la cuenta bancaria origen.');
      return;
    }

    onSave({
      proveedor: cuenta.proveedor,
      cuenta_por_pagar: cuenta.id,
      fecha_pago: fechaPago,
      forma_pago: formaPago,
      monto: montoNumber,
      numero_documento: referencia,
      cuenta_bancaria: requiereCuenta ? Number(cuentaBancaria) : null,
      notas,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Registrar pago</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{cuenta.numero_cuenta}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{cuenta.proveedor_nombre} · Saldo {formatMoney(cuenta.saldo)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <FiXCircle />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de pago">
              <input type="date" value={fechaPago} onChange={(event) => setFechaPago(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Monto">
              <input type="number" min="0" step="0.01" value={monto} onChange={(event) => setMonto(event.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field label="Forma de pago">
            <select value={formaPago} onChange={(event) => setFormaPago(event.target.value as PagoProveedorPayload['forma_pago'])} className={inputClass}>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="NOTA_CREDITO">Nota de crédito</option>
            </select>
          </Field>

          {requiereCuenta && (
            <Field label="Cuenta bancaria origen">
              <select value={cuentaBancaria} onChange={(event) => setCuentaBancaria(event.target.value)} className={inputClass}>
                <option value="">Selecciona una cuenta</option>
                {cuentasActivas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.banco} · {item.numero_cuenta} · {formatMoney(item.saldo_actual)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Referencia">
            <input value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Transferencia, cheque, comprobante..." className={inputClass} />
          </Field>

          <Field label="Notas">
            <textarea value={notas} onChange={(event) => setNotas(event.target.value)} rows={3} className={`${inputClass} h-auto resize-none py-3`} />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-500 transition hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiCreditCard />
            {saving ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const toneClass = {
    blue: 'border-blue-500 text-blue-700',
    emerald: 'border-emerald-500 text-emerald-700',
    amber: 'border-amber-500 text-amber-700',
    red: 'border-red-500 text-red-700',
  }[tone];

  return (
    <div className={`rounded-xl border-l-4 bg-white p-6 shadow-lg ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function ActionButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-sm text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function InfoMini({ label, value, alignRight = false }: { label: string; value: string; alignRight?: boolean }) {
  return (
    <div className={alignRight ? 'text-right' : ''}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function formatMoney(value: number | string) {
  return Number(value || 0).toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatFechaLocal(fecha?: string | null) {
  const value = (fecha ?? '').split('T')[0].split(' ')[0];
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'PAGADA': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PARCIAL': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'PENDIENTE': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'ANULADA': return 'border-red-200 bg-red-50 text-red-700';
    default: return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function readApiError(data?: Record<string, unknown>) {
  if (!data) return '';
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0] ?? '');
  if (typeof first === 'string') return first;
  return '';
}
