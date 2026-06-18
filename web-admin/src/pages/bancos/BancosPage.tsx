import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, RefreshCw, CheckCircle2, Circle, ArrowDownLeft, ArrowUpRight,
  Pencil, Power,
} from 'lucide-react';
import {
  getResumen, crearCuenta, actualizarCuenta, getExtracto, crearMovimiento, conciliarMovimiento, conciliarMultiples,
  type CuentaBancaria, type ExtractoRow, type TipoMovimiento,
} from '../../services/bancosService';
import { useToast } from '../../hooks/useToast';

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  DEPOSITO: 'Depósito',
  RETIRO: 'Retiro',
  TRANSFERENCIA_ENTRADA: 'Transf. Entrada',
  TRANSFERENCIA_SALIDA: 'Transf. Salida',
  NOTA_CREDITO: 'Nota Crédito',
  NOTA_DEBITO: 'Nota Débito',
  CHEQUE: 'Cheque Emitido',
  PAGO: 'Pago',
  OTRO: 'Otro',
};

const TIPO_COLOR: Record<string, string> = {
  DEPOSITO: 'bg-green-100 text-green-700',
  TRANSFERENCIA_ENTRADA: 'bg-emerald-100 text-emerald-700',
  NOTA_CREDITO: 'bg-blue-100 text-blue-700',
  RETIRO: 'bg-red-100 text-red-700',
  TRANSFERENCIA_SALIDA: 'bg-orange-100 text-orange-700',
  NOTA_DEBITO: 'bg-rose-100 text-rose-700',
  CHEQUE: 'bg-yellow-100 text-yellow-700',
  PAGO: 'bg-purple-100 text-purple-700',
  OTRO: 'bg-gray-100 text-gray-700',
};

// ── Cuenta Card ───────────────────────────────────────────────────────────

function CuentaCard({
  cuenta, selected, onSelect, onEdit, onToggleActive,
}: {
  cuenta: CuentaBancaria;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className={`w-full text-left rounded-xl p-4 border transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50 shadow-md'
          : cuenta.activa
            ? 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
            : 'border-gray-200 bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 text-sm truncate">{cuenta.banco}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${
              cuenta.activa ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {cuenta.activa ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono">{cuenta.numero_cuenta}</p>
          <span className="text-xs text-gray-400">{cuenta.tipo}</span>
        </button>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">{fmt(cuenta.saldo_disponible)}</p>
          <p className="text-xs text-gray-400">Conciliado: {fmt(cuenta.saldo_actual)}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onEdit}
          title="Editar cuenta"
          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-700 hover:bg-indigo-50"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          title={cuenta.activa ? 'Inactivar cuenta' : 'Activar cuenta'}
          className={`p-1.5 rounded-lg ${
            cuenta.activa
              ? 'text-gray-500 hover:text-red-700 hover:bg-red-50'
              : 'text-gray-500 hover:text-green-700 hover:bg-green-50'
          }`}
        >
          <Power size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Nueva Cuenta Modal ────────────────────────────────────────────────────

function NuevaCuentaModal({
  cuenta, onClose, onSaved,
}: {
  cuenta?: CuentaBancaria | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    banco: cuenta?.banco ?? '',
    numero_cuenta: cuenta?.numero_cuenta ?? '',
    tipo: cuenta?.tipo ?? 'CORRIENTE' as CuentaBancaria['tipo'],
    saldo_inicial: String(cuenta?.saldo_inicial ?? '0'),
    descripcion: cuenta?.descripcion ?? '',
    activa: cuenta?.activa ?? true,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(cuenta);

  const handleSave = async () => {
    if (!form.banco || !form.numero_cuenta) {
      showToast('Banco y número de cuenta son requeridos.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, saldo_inicial: parseFloat(form.saldo_inicial) || 0 };
      if (cuenta) {
        await actualizarCuenta(cuenta.id, payload);
      } else {
        await crearCuenta(payload);
      }
      showToast(isEdit ? 'Cuenta actualizada.' : 'Cuenta creada.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{isEdit ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Banco *</label>
              <input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
                placeholder="Ej: Banco Pichincha"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número de Cuenta *</label>
              <input value={form.numero_cuenta} onChange={e => setForm(f => ({ ...f, numero_cuenta: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as CuentaBancaria['tipo'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="CORRIENTE">Cuenta Corriente</option>
                <option value="AHORROS">Cuenta de Ahorros</option>
                <option value="CAJA">Caja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Saldo Inicial</label>
              <input type="number" step="0.01" value={form.saldo_inicial}
                onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.activa}
                onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))}
                className="rounded"
              />
              Cuenta activa
            </label>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Nuevo Movimiento Modal ────────────────────────────────────────────────

function NuevoMovimientoModal({
  cuentas, defaultCuentaId, onClose, onSaved,
}: {
  cuentas: CuentaBancaria[];
  defaultCuentaId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    cuenta: String(defaultCuentaId || ''),
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'DEPOSITO' as TipoMovimiento,
    descripcion: '',
    referencia: '',
    monto: '',
    beneficiario: '',
    notas: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.cuenta || !form.descripcion || !form.monto) {
      showToast('Cuenta, descripción y monto son requeridos.', 'error');
      return;
    }
    setSaving(true);
    try {
      await crearMovimiento({ ...form, cuenta: parseInt(form.cuenta), monto: parseFloat(form.monto) });
      showToast('Movimiento registrado.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Nuevo Movimiento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta *</label>
              <select value={form.cuenta} onChange={e => setForm(f => ({ ...f, cuenta: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione —</option>
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>{c.banco} — {c.numero_cuenta}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMovimiento }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {(Object.keys(TIPO_LABELS) as TipoMovimiento[]).map(t => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
              <input type="number" step="0.01" min="0" value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Cobro factura 001-001-000123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
              <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                placeholder="Nro. transf., cheque..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiario / Origen</label>
              <input value={form.beneficiario} onChange={e => setForm(f => ({ ...f, beneficiario: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function BancosPage() {
  const { showToast } = useToast();
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaBancaria | null>(null);
  const [extracto, setExtracto] = useState<ExtractoRow[]>([]);
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadingExtracto, setLoadingExtracto] = useState(false);
  const [showNuevaCuenta, setShowNuevaCuenta] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<CuentaBancaria | null>(null);
  const [showNuevoMov, setShowNuevoMov] = useState(false);

  // Filtros extracto
  const [filAnio, setFilAnio] = useState(String(new Date().getFullYear()));
  const [filMes,  setFilMes]  = useState(String(new Date().getMonth() + 1));

  // Selección para conciliación masiva
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const loadCuentas = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getResumen();
      setCuentas(res.cuentas);
      setTotalDisponible(res.total_disponible);
      setSelectedCuenta(current => (
        res.cuentas.find(cuenta => cuenta.id === current?.id)
        ?? res.cuentas[0]
        ?? null
      ));
    } catch {
      setLoadError(true);
      showToast('Error cargando cuentas', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadExtracto = useCallback(async () => {
    if (!selectedCuenta) return;
    setLoadingExtracto(true);
    setSelected(new Set());
    try {
      const params: Record<string, string> = {};
      if (filAnio) params.anio = filAnio;
      if (filMes)  params.mes  = filMes;
      const res = await getExtracto(selectedCuenta.id, params);
      setExtracto(res.movimientos);
    } catch {
      showToast('Error cargando extracto', 'error');
    } finally {
      setLoadingExtracto(false);
    }
  }, [selectedCuenta, filAnio, filMes, showToast]);

  useEffect(() => { loadCuentas(); }, [loadCuentas]);
  useEffect(() => { loadExtracto(); }, [loadExtracto]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConciliarSeleccionados = async (conciliado: boolean) => {
    if (selected.size === 0) return;
    try {
      const res = await conciliarMultiples(Array.from(selected), conciliado);
      showToast(`${res.actualizados} movimiento(s) actualizados.`, 'success');
      loadExtracto();
      loadCuentas();
    } catch {
      showToast('Error al conciliar', 'error');
    }
  };

  const handleConciliar = async (id: number) => {
    try {
      await conciliarMovimiento(id);
      loadExtracto();
      loadCuentas();
    } catch {
      showToast('Error al conciliar', 'error');
    }
  };

  const handleToggleCuenta = async (cuenta: CuentaBancaria) => {
    try {
      const updated = await actualizarCuenta(cuenta.id, { activa: !cuenta.activa });
      showToast(updated.activa ? 'Cuenta activada.' : 'Cuenta inactivada.', 'success');
      await loadCuentas();
    } catch {
      showToast('No se pudo actualizar la cuenta.', 'error');
    }
  };

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Building2 className="text-green-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bancos y Tesorería</h1>
            <p className="text-sm text-gray-500">Cuentas bancarias, extractos y conciliación</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNuevaCuenta(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
            <Plus size={15} /> Nueva cuenta
          </button>
          <button onClick={() => setShowNuevoMov(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
            <Plus size={15} /> Nuevo movimiento
          </button>
        </div>
      </div>

      {/* KPI Banner */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl p-5 text-white">
        <p className="text-sm opacity-75">Saldo total disponible</p>
        <p className="text-3xl font-bold">{fmt(totalDisponible)}</p>
        <p className="text-xs opacity-60 mt-1">{cuentas.filter(c => c.activa).length} cuenta(s) activa(s)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar: cuentas */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Cuentas</p>
          {loading ? (
            <div className="text-center text-gray-400 py-8">Cargando…</div>
          ) : loadError ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-600">No se pudieron cargar las cuentas.</p>
              <button
                type="button"
                onClick={loadCuentas}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                Reintentar
              </button>
            </div>
          ) : cuentas.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No hay cuentas.</p>
              <button onClick={() => setShowNuevaCuenta(true)} className="text-indigo-600 text-sm mt-2">+ Crear primera cuenta</button>
            </div>
          ) : (
            cuentas.map(c => (
              <CuentaCard
                key={c.id}
                cuenta={c}
                selected={selectedCuenta?.id === c.id}
                onSelect={() => setSelectedCuenta(c)}
                onEdit={() => setEditingCuenta(c)}
                onToggleActive={() => handleToggleCuenta(c)}
              />
            ))
          )}
        </div>

        {/* Main: extracto */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filAnio} onChange={e => setFilAnio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={filMes} onChange={e => setFilMes(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <button onClick={loadExtracto}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw size={13} />
            </button>

            {selected.size > 0 && (
              <>
                <span className="text-xs text-gray-500">{selected.size} seleccionado(s)</span>
                <button onClick={() => handleConciliarSeleccionados(true)}
                  className="text-xs text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50">
                  ✓ Conciliar
                </button>
                <button onClick={() => handleConciliarSeleccionados(false)}
                  className="text-xs text-orange-700 border border-orange-300 rounded px-2 py-1 hover:bg-orange-50">
                  ✗ Desmarcar
                </button>
              </>
            )}
          </div>

          {/* Table */}
          {!selectedCuenta ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              Selecciona una cuenta para ver el extracto.
            </div>
          ) : loadingExtracto ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">Cargando…</div>
          ) : extracto.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              No hay movimientos en el período.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50 border-b">
                    <th className="px-3 py-2 w-6"></th>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Descripción</th>
                    <th className="text-right px-3 py-2">Entrada</th>
                    <th className="text-right px-3 py-2">Salida</th>
                    <th className="text-right px-3 py-2">Saldo</th>
                    <th className="px-3 py-2 w-8 text-center">Conc.</th>
                  </tr>
                </thead>
                <tbody>
                  {extracto.map(row => (
                    <tr key={row.id}
                      className={`border-b border-gray-50 ${selected.has(row.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleSelect(row.id)}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(row.id)} readOnly
                          className="rounded" />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{row.fecha}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[row.tipo] || 'bg-gray-100 text-gray-700'}`}>
                          {TIPO_LABELS[row.tipo]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-800">{row.descripcion}</span>
                        {row.referencia && <span className="text-xs text-gray-400 ml-1">({row.referencia})</span>}
                        {row.beneficiario && <p className="text-xs text-gray-400">{row.beneficiario}</p>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.entrada > 0 ? (
                          <span className="text-green-600 flex items-center justify-end gap-1">
                            <ArrowDownLeft size={12} />{fmt(row.entrada)}
                          </span>
                        ) : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.salida > 0 ? (
                          <span className="text-red-600 flex items-center justify-end gap-1">
                            <ArrowUpRight size={12} />{fmt(row.salida)}
                          </span>
                        ) : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(row.saldo)}</td>
                      <td className="px-3 py-2 text-center" onClick={e => { e.stopPropagation(); handleConciliar(row.id); }}>
                        {row.conciliado
                          ? <CheckCircle2 size={15} className="text-green-500 mx-auto cursor-pointer" />
                          : <Circle size={15} className="text-gray-300 mx-auto cursor-pointer hover:text-green-400" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-sm">
                    <td colSpan={4} className="px-3 py-2 text-right text-gray-500">Totales</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">
                      {fmt(extracto.reduce((s, r) => s + r.entrada, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">
                      {fmt(extracto.reduce((s, r) => s + r.salida, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNuevaCuenta && (
        <NuevaCuentaModal
          cuenta={null}
          onClose={() => setShowNuevaCuenta(false)}
          onSaved={() => { setShowNuevaCuenta(false); loadCuentas(); }}
        />
      )}

      {editingCuenta && (
        <NuevaCuentaModal
          cuenta={editingCuenta}
          onClose={() => setEditingCuenta(null)}
          onSaved={() => { setEditingCuenta(null); loadCuentas(); }}
        />
      )}

      {showNuevoMov && (
        <NuevoMovimientoModal
          cuentas={cuentas}
          defaultCuentaId={selectedCuenta?.id}
          onClose={() => setShowNuevoMov(false)}
          onSaved={() => { setShowNuevoMov(false); loadExtracto(); loadCuentas(); }}
        />
      )}
    </div>
  );
}
