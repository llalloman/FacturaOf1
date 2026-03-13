import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSearch, FiPlus, FiChevronDown, FiChevronUp, FiDollarSign } from 'react-icons/fi';
import { Landmark, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { carteraService } from '../../services/carteraService';
import { toast } from '../../store/toastStore';
import type { CuentaPorCobrar } from '../../types/index';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-EC', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const estadoColor = (estado: string) => {
  switch (estado) {
    case 'PAGADO':      return 'text-green-700 bg-green-50 border border-green-200';
    case 'PENDIENTE':   return 'text-blue-700 bg-blue-50 border border-blue-200';
    case 'PARCIAL':     return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
    case 'VENCIDA':     return 'text-red-700 bg-red-50 border border-red-200';
    case 'INCOBRABLE':  return 'text-gray-600 bg-gray-100 border border-gray-300';
    default:            return 'text-gray-600 bg-gray-50 border border-gray-200';
  }
};

const bucketColor = (bucket: string) => {
  switch (bucket) {
    case 'vigente': return 'bg-green-500';
    case '1-30':    return 'bg-yellow-400';
    case '31-60':   return 'bg-orange-400';
    case '61-90':   return 'bg-orange-600';
    case '+90':     return 'bg-red-600';
    default:        return 'bg-gray-300';
  }
};

// ── Pago modal ────────────────────────────────────────────────────────────────
interface PagoModalProps {
  cuenta: CuentaPorCobrar;
  onClose: () => void;
  onSuccess: () => void;
}

const PagoModal: React.FC<PagoModalProps> = ({ cuenta, onClose, onSuccess }) => {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    fecha_pago: today,
    monto: cuenta.saldo,
    forma_pago: 'EFECTIVO',
    referencia: '',
    notas: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.monto <= 0) { toast.error('El monto debe ser mayor a cero'); return; }
    if (form.monto > cuenta.saldo) { toast.error(`Monto supera el saldo (${fmtCurrency(cuenta.saldo)})`); return; }
    setLoading(true);
    try {
      await carteraService.registrarPago({ cuenta: cuenta.id, ...form });
      toast.success('Pago registrado correctamente');
      onSuccess();
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Registrar Pago</h2>
        <p className="text-sm text-gray-500 mb-4">
          {cuenta.cliente_nombre} — Saldo: <span className="font-semibold text-gray-800">{fmtCurrency(cuenta.saldo)}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de pago</label>
              <input
                type="date"
                required
                value={form.fecha_pago}
                max={today}
                onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto (USD)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0.01"
                max={String(cuenta.saldo)}
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pago</label>
            <select
              value={form.forma_pago}
              onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia bancaria</option>
              <option value="TARJETA_DEBITO">Tarjeta débito</option>
              <option value="TARJETA_CREDITO">Tarjeta crédito</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referencia (opcional)</label>
            <input
              type="text"
              placeholder="N° transacción, cheque, etc."
              value={form.referencia}
              onChange={(e) => setForm({ ...form, referencia: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── NuevaCuenta modal ─────────────────────────────────────────────────────────
interface NuevaCuentaModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const NuevaCuentaModal: React.FC<NuevaCuentaModalProps> = ({ onClose, onSuccess }) => {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    cliente_id: '',
    numero_cuenta: '',
    fecha_emision: today,
    fecha_vencimiento: '',
    monto_total: '',
    notas: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.fecha_vencimiento || !form.monto_total) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    setLoading(true);
    try {
      await carteraService.createCuenta({
        cliente: parseInt(form.cliente_id),
        numero_cuenta: form.numero_cuenta || undefined,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        monto_total: parseFloat(form.monto_total),
        notas: form.notas,
      });
      toast.success('Cuenta por cobrar creada');
      onSuccess();
    } catch {
      toast.error('Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Nueva Cuenta por Cobrar</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ID Cliente *</label>
            <input
              type="number"
              required
              placeholder="ID del cliente"
              value={form.cliente_id}
              onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">Puede usar el ID de la sección Clientes</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Emisión</label>
              <input
                type="date" required value={form.fecha_emision}
                onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vencimiento *</label>
              <input
                type="date" required value={form.fecha_vencimiento}
                min={form.fecha_emision}
                onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto (USD) *</label>
              <input
                type="number" required step="0.01" min="0.01" placeholder="0.00"
                value={form.monto_total}
                onChange={(e) => setForm({ ...form, monto_total: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N° Cuenta</label>
              <input
                type="text" placeholder="Auto si vacío"
                value={form.numero_cuenta}
                onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea rows={2} value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {loading ? 'Guardando...' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const CarteraPage: React.FC = () => {
  const [tab, setTab] = useState<'cuentas' | 'aging'>('cuentas');
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pagoModal, setPagoModal] = useState<CuentaPorCobrar | null>(null);
  const [nuevaCuenta, setNuevaCuenta] = useState(false);

  const queryClient = useQueryClient();

  const { data: cuentas = [], isLoading: loadingCuentas } = useQuery({
    queryKey: ['cartera-cuentas'],
    queryFn: carteraService.getCuentas,
  });

  const { data: aging = [], isLoading: loadingAging } = useQuery({
    queryKey: ['cartera-aging'],
    queryFn: carteraService.getAging,
  });

  const { data: resumen } = useQuery({
    queryKey: ['cartera-resumen'],
    queryFn: carteraService.getResumen,
  });

  const incobrableMutation = useMutation({
    mutationFn: carteraService.marcarIncobrable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartera-cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['cartera-resumen'] });
      toast.success('Cuenta marcada como incobrable');
    },
    onError: () => toast.error('Error al actualizar la cuenta'),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cartera-cuentas'] });
    queryClient.invalidateQueries({ queryKey: ['cartera-aging'] });
    queryClient.invalidateQueries({ queryKey: ['cartera-resumen'] });
  };

  const filtered = cuentas.filter((c) => {
    const matchSearch =
      c.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numero_cuenta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.factura_numero ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = !estadoFiltro || c.estado === estadoFiltro;
    return matchSearch && matchEstado;
  });

  const kpis = [
    {
      label: 'Por Cobrar',
      value: fmtCurrency(resumen?.total_por_cobrar ?? 0),
      sub: `${resumen?.cuentas_pendientes ?? 0} cuentas`,
      icon: <Landmark className="h-5 w-5 text-blue-600" />,
      color: 'border-blue-200 bg-blue-50',
    },
    {
      label: 'Vencido',
      value: fmtCurrency(resumen?.total_vencido ?? 0),
      sub: `${resumen?.cuentas_vencidas ?? 0} cuentas`,
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      color: 'border-red-200 bg-red-50',
    },
    {
      label: 'Cobrado este mes',
      value: fmtCurrency(resumen?.cobrado_mes ?? 0),
      sub: 'pagos recibidos',
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      color: 'border-green-200 bg-green-50',
    },
    {
      label: 'Incobrable',
      value: fmtCurrency(resumen?.total_incobrable ?? 0),
      sub: 'cartera deteriorada',
      icon: <TrendingUp className="h-5 w-5 text-gray-500" />,
      color: 'border-gray-200 bg-gray-50',
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h1>
            <p className="text-sm text-gray-500">Gestión de cartera y cobros</p>
          </div>
        </div>
        <button
          onClick={() => setNuevaCuenta(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm"
        >
          <FiPlus /> Nueva Cuenta
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl p-4 border shadow-sm ${k.color}`}>
            <div className="flex items-center gap-2 mb-2">{k.icon}<span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{k.label}</span></div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(['cuentas', 'aging'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'cuentas' ? 'Cuentas' : 'Análisis de Vencimiento'}
          </button>
        ))}
      </div>

      {/* ── CUENTAS TAB ── */}
      {tab === 'cuentas' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por cliente, N° cuenta, factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PARCIAL">Parcial</option>
              <option value="VENCIDA">Vencida</option>
              <option value="PAGADO">Pagado</option>
              <option value="INCOBRABLE">Incobrable</option>
            </select>
            <span className="text-xs text-gray-400 self-center whitespace-nowrap">{filtered.length} cuentas</span>
          </div>

          {/* Table */}
          {loadingCuentas ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No hay cuentas por cobrar registradas</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">N° Cuenta</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr
                      className={`border-b border-gray-50 hover:bg-gray-50 transition ${
                        c.estado === 'VENCIDA' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expanded === c.id ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">{c.numero_cuenta || `CxC-${c.id}`}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.cliente_nombre}</div>
                        {c.factura_numero && (
                          <div className="text-xs text-gray-400">Factura {c.factura_numero}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>{fmtDate(c.fecha_vencimiento)}</div>
                        {c.dias_vencimiento < 0 && (
                          <div className="text-xs text-red-500">{Math.abs(c.dias_vencimiento)} días vencida</div>
                        )}
                        {c.dias_vencimiento >= 0 && c.dias_vencimiento <= 7 && (
                          <div className="text-xs text-orange-500">Vence en {c.dias_vencimiento} días</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(c.monto_total)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtCurrency(c.saldo)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoColor(c.estado)}`}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {['PENDIENTE', 'PARCIAL', 'VENCIDA'].includes(c.estado) && (
                            <button
                              onClick={() => setPagoModal(c)}
                              className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded-lg transition"
                            >
                              <FiDollarSign className="h-3 w-3" /> Pagar
                            </button>
                          )}
                          {['PENDIENTE', 'PARCIAL', 'VENCIDA'].includes(c.estado) && (
                            <button
                              onClick={() => {
                                if (confirm('¿Marcar esta cuenta como incobrable?')) {
                                  incobrableMutation.mutate(c.id);
                                }
                              }}
                              className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded-lg transition"
                            >
                              Incobrable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable: historial de pagos */}
                    {expanded === c.id && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={8} className="px-8 py-4">
                          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                            Historial de Pagos
                          </p>
                          {!c.pagos || c.pagos.length === 0 ? (
                            <p className="text-xs text-gray-500">Sin pagos registrados</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="py-1 pr-4">Fecha</th>
                                  <th className="py-1 pr-4">Monto</th>
                                  <th className="py-1 pr-4">Forma de pago</th>
                                  <th className="py-1">Referencia</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.pagos.map((p) => (
                                  <tr key={p.id} className="border-t border-blue-100">
                                    <td className="py-1 pr-4">{fmtDate(p.fecha_pago)}</td>
                                    <td className="py-1 pr-4 font-semibold text-green-700">{fmtCurrency(p.monto)}</td>
                                    <td className="py-1 pr-4 capitalize">{p.forma_pago.replace('_', ' ').toLowerCase()}</td>
                                    <td className="py-1 text-gray-500">{p.referencia || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
      )}

      {/* ── AGING TAB ── */}
      {tab === 'aging' && (
        <div className="space-y-4">
          {loadingAging ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Visual bar */}
              {aging.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Distribución de Cartera</h3>
                  <div className="flex h-8 rounded-xl overflow-hidden mb-3 gap-0.5">
                    {aging.map((b) => {
                      const grandTotal = aging.reduce((s, x) => s + Number(x.total), 0);
                      const pct = grandTotal > 0 ? (Number(b.total) / grandTotal) * 100 : 0;
                      return pct > 0 ? (
                        <div
                          key={b.bucket}
                          className={`${bucketColor(b.bucket)} transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${b.label}: ${fmtCurrency(b.total)}`}
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {aging.map((b) => (
                      <div key={b.bucket} className="flex items-center gap-1.5 text-xs">
                        <span className={`w-3 h-3 rounded-sm ${bucketColor(b.bucket)}`} />
                        <span className="text-gray-600">{b.label}</span>
                        <span className="font-semibold text-gray-800">{fmtCurrency(b.total)}</span>
                        <span className="text-gray-400">({b.cantidad})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buckets */}
              {aging.map((b) => (
                <div key={b.bucket} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className={`flex justify-between items-center px-6 py-3 ${b.bucket === 'vigente' ? 'bg-green-50' : b.bucket === '+90' || b.bucket === '61-90' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${bucketColor(b.bucket)}`} />
                      <span className="font-semibold text-gray-800">{b.label}</span>
                      <span className="text-xs text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">{b.cantidad} cuentas</span>
                    </div>
                    <span className="font-bold text-gray-900 text-lg">{fmtCurrency(b.total)}</span>
                  </div>
                  {b.cuentas.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                          <th className="px-6 py-2">Cliente</th>
                          <th className="px-4 py-2">Vencimiento</th>
                          <th className="px-4 py-2 text-right">Saldo</th>
                          <th className="px-4 py-2">Días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.cuentas.map((c) => (
                          <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-6 py-2.5 font-medium text-gray-700">{c.cliente}</td>
                            <td className="px-4 py-2.5 text-gray-500">{fmtDate(c.fecha_vencimiento)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{fmtCurrency(c.saldo)}</td>
                            <td className="px-4 py-2.5">
                              {c.dias_vencimiento < 0 ? (
                                <span className="text-red-600 text-xs font-semibold">{Math.abs(c.dias_vencimiento)}d vencida</span>
                              ) : (
                                <span className="text-green-600 text-xs">{c.dias_vencimiento}d restantes</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              {aging.every((b) => b.cantidad === 0) && (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                  No hay cuentas pendientes de cobro
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {pagoModal && (
        <PagoModal
          cuenta={pagoModal}
          onClose={() => setPagoModal(null)}
          onSuccess={() => { setPagoModal(null); refresh(); }}
        />
      )}
      {nuevaCuenta && (
        <NuevaCuentaModal
          onClose={() => setNuevaCuenta(false)}
          onSuccess={() => { setNuevaCuenta(false); refresh(); }}
        />
      )}
    </div>
  );
};

export default CarteraPage;
