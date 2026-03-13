import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, ChevronRight, ChevronDown, RefreshCw,
  TrendingUp, Scale, BookMarked, Lock,
} from 'lucide-react';
import {
  getCuentasArbol,
  inicializarPlan,
  getAsientos,
  crearAsiento,
  bloquearAsiento,
  getBalanceGeneral,
  getEstadoResultados,
  type CuentaContable,
  type AsientoContable,
  type TipoAsiento,
  type BalanceGeneral,
  type EstadoResultados,
} from '../../services/contabilidadService';
import { useToast } from '../../hooks/useToast';

// ── Helpers ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);

const TIPO_LABELS: Record<string, string> = {
  MANUAL: 'Manual', VENTA: 'Venta', COMPRA: 'Compra',
  PAGO: 'Pago', COBRO: 'Cobro', AJUSTE: 'Ajuste',
  APERTURA: 'Apertura', CIERRE: 'Cierre',
};

const TIPO_COLORS: Record<string, string> = {
  ACTIVO: 'bg-blue-100 text-blue-700',
  PASIVO: 'bg-orange-100 text-orange-700',
  PATRIMONIO: 'bg-purple-100 text-purple-700',
  INGRESO: 'bg-green-100 text-green-700',
  GASTO: 'bg-red-100 text-red-700',
  COSTO: 'bg-yellow-100 text-yellow-700',
};

// ── Plan de Cuentas (tree row) ────────────────────────────────────────────

function CuentaRow({ cuenta, depth = 0 }: { cuenta: CuentaContable; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasKids = cuenta.hijos && cuenta.hijos.length > 0;

  return (
    <>
      <tr className="hover:bg-gray-50 border-b border-gray-100">
        <td className="py-2 pr-4" style={{ paddingLeft: `${depth * 20 + 8}px` }}>
          <div className="flex items-center gap-1">
            {hasKids ? (
              <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-4 inline-block" />
            )}
            <span className={`font-mono text-xs ${depth === 0 ? 'font-bold' : ''}`}>{cuenta.codigo}</span>
          </div>
        </td>
        <td className="py-2 pr-4">
          <span className={depth === 0 ? 'font-semibold text-gray-800' : 'text-gray-700'}>
            {cuenta.nombre}
          </span>
        </td>
        <td className="py-2 pr-4">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[cuenta.tipo] || ''}`}>
            {cuenta.tipo}
          </span>
        </td>
        <td className="py-2 text-right font-mono text-sm">
          {cuenta.es_hoja ? (
            <span className={cuenta.saldo >= 0 ? 'text-gray-800' : 'text-red-600'}>
              {fmt(cuenta.saldo)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
      </tr>
      {open && hasKids && cuenta.hijos!.map(h => (
        <CuentaRow key={h.id} cuenta={h} depth={depth + 1} />
      ))}
    </>
  );
}

// ── Asiento form modal ────────────────────────────────────────────────────

interface AsientoModalProps {
  cuentas: CuentaContable[];
  onClose: () => void;
  onSaved: () => void;
}

function AsientoModal({ cuentas, onClose, onSaved }: AsientoModalProps) {
  const { showToast } = useToast();
  const hojas = cuentas.filter(c => c.es_hoja && c.activa);

  type Linea = { cuenta: string; descripcion: string; debe: string; haber: string };
  const emptyLinea = (): Linea => ({ cuenta: '', descripcion: '', debe: '', haber: '' });

  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'MANUAL' as TipoAsiento,
    descripcion: '',
    referencia: '',
  });
  const [lineas, setLineas] = useState<Linea[]>([emptyLinea(), emptyLinea()]);
  const [saving, setSaving] = useState(false);

  const totalDebe  = lineas.reduce((s, l) => s + (parseFloat(l.debe)  || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;

  const addLinea = () => setLineas(ls => [...ls, emptyLinea()]);
  const removeLinea = (i: number) => setLineas(ls => ls.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!form.descripcion.trim()) { showToast('Ingrese una descripción.', 'error'); return; }
    if (lineas.filter(l => l.cuenta).length < 2) { showToast('Mínimo 2 líneas con cuenta.', 'error'); return; }
    if (!cuadra) { showToast('El asiento no cuadra (Debe ≠ Haber).', 'error'); return; }
    setSaving(true);
    try {
      await crearAsiento({
        ...form,
        lineas: lineas
          .filter(l => l.cuenta)
          .map(l => ({
            cuenta: parseInt(l.cuenta),
            descripcion: l.descripcion,
            debe: parseFloat(l.debe) || 0,
            haber: parseFloat(l.haber) || 0,
          })),
      });
      showToast('Asiento registrado.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Flatten cuenta list for selector
  const flatCuentas: CuentaContable[] = [];
  function flatten(list: CuentaContable[]) {
    for (const c of list) {
      flatCuentas.push(c);
      if (c.hijos) flatten(c.hijos);
    }
  }
  flatten(hojas);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Nuevo Asiento Contable</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoAsiento }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
              <input value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Venta de mercadería cliente XYZ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
              <input value={form.referencia}
                onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                placeholder="Nro. factura, doc..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Líneas del asiento</span>
              <button onClick={addLinea}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Plus size={12} /> Agregar línea
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left pb-1 pr-2">Cuenta *</th>
                  <th className="text-left pb-1 pr-2">Descripción</th>
                  <th className="text-right pb-1 pr-2 w-28">Debe</th>
                  <th className="text-right pb-1 w-28">Haber</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="pr-2 py-1">
                      <select value={l.cuenta}
                        onChange={e => setLineas(ls => ls.map((x, idx) => idx === i ? { ...x, cuenta: e.target.value } : x))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs">
                        <option value="">— cuenta —</option>
                        {flatCuentas.sort((a, b) => a.codigo.localeCompare(b.codigo)).map(c => (
                          <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="pr-2 py-1">
                      <input value={l.descripcion}
                        onChange={e => setLineas(ls => ls.map((x, idx) => idx === i ? { ...x, descripcion: e.target.value } : x))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                    </td>
                    <td className="pr-2 py-1">
                      <input type="number" step="0.01" min="0" value={l.debe}
                        onChange={e => setLineas(ls => ls.map((x, idx) => idx === i ? { ...x, debe: e.target.value, haber: e.target.value ? '0' : x.haber } : x))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="py-1">
                      <input type="number" step="0.01" min="0" value={l.haber}
                        onChange={e => setLineas(ls => ls.map((x, idx) => idx === i ? { ...x, haber: e.target.value, debe: e.target.value ? '0' : x.debe } : x))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td>
                      {lineas.length > 2 && (
                        <button onClick={() => removeLinea(i)} className="text-red-400 hover:text-red-600 ml-1">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold">
                  <td colSpan={2} className="pt-2 pr-2 text-right text-gray-500">Totales:</td>
                  <td className="pt-2 pr-2 text-right font-mono">{fmt(totalDebe)}</td>
                  <td className="pt-2 text-right font-mono">{fmt(totalHaber)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="pt-1 text-right text-xs">
                    {cuadra
                      ? <span className="text-green-600 font-medium">✓ Asiento cuadrado</span>
                      : <span className="text-red-600 font-medium">✗ Diferencia: {fmt(Math.abs(totalDebe - totalHaber))}</span>
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !cuadra}
            className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar asiento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Informes ──────────────────────────────────────────────────────────────

type SectionGroup = BalanceGeneral['activo'];

function BalanceSection({ title, group, cls }: { title: string; group: SectionGroup; cls: string }) {
  return (
    <div>
      <div className={`flex justify-between items-center font-semibold px-3 py-2 rounded-t-lg ${cls}`}>
        <span>{title}</span>
        <span>{fmt(group.total)}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {group.cuentas.filter(c => c.saldo !== 0).map(c => (
            <tr key={c.codigo} className="border-b border-gray-100">
              <td className="py-1.5 pl-4 font-mono text-xs text-gray-500 w-24">{c.codigo}</td>
              <td className="py-1.5">{c.nombre}</td>
              <td className="py-1.5 text-right pr-3 font-mono">{fmt(c.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceView({ data }: { data: BalanceGeneral }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <BalanceSection title="ACTIVO" group={data.activo} cls="bg-blue-50 text-blue-800" />
      </div>
      <div className="space-y-4">
        <BalanceSection title="PASIVO" group={data.pasivo} cls="bg-orange-50 text-orange-800" />
        <BalanceSection title="PATRIMONIO" group={data.patrimonio} cls="bg-purple-50 text-purple-800" />
        <div className={`flex justify-between font-bold px-3 py-2 rounded-lg ${data.cuadra ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <span>PASIVO + PATRIMONIO</span>
          <span>{fmt(data.total_pasivo_patrimonio)}</span>
        </div>
        {!data.cuadra && (
          <p className="text-sm text-red-600 text-center">⚠ El balance no cuadra</p>
        )}
      </div>
    </div>
  );
}

function EstadoView({ data }: { data: EstadoResultados }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {[
        { label: 'INGRESOS', group: data.ingresos, cls: 'bg-green-50 text-green-800' },
        { label: 'COSTO DE VENTAS', group: data.costos, cls: 'bg-yellow-50 text-yellow-800' },
        { label: 'GASTOS', group: data.gastos, cls: 'bg-red-50 text-red-800' },
      ].map(({ label, group, cls }) => (
        <div key={label}>
          <div className={`flex justify-between font-semibold px-3 py-2 rounded-t-lg ${cls}`}>
            <span>{label}</span>
            <span>{fmt(group.total)}</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {group.cuentas.filter(c => c.saldo !== 0).map(c => (
                <tr key={c.codigo} className="border-b border-gray-100">
                  <td className="py-1.5 pl-4 font-mono text-xs text-gray-500 w-24">{c.codigo}</td>
                  <td className="py-1.5">{c.nombre}</td>
                  <td className="py-1.5 text-right pr-3 font-mono">{fmt(c.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="border-t pt-3 space-y-1">
        <div className="flex justify-between text-sm px-3">
          <span className="text-gray-600">Utilidad Bruta</span>
          <span className={`font-mono font-semibold ${data.utilidad_bruta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmt(data.utilidad_bruta)}
          </span>
        </div>
        <div className={`flex justify-between font-bold text-base px-3 py-2 rounded-lg ${data.utilidad_neta >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <span>{data.utilidad_neta >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}</span>
          <span className="font-mono">{fmt(Math.abs(data.utilidad_neta))}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'plan',   label: 'Plan de Cuentas', icon: BookOpen },
  { id: 'diario', label: 'Diario',          icon: BookMarked },
  { id: 'balance',label: 'Balance General', icon: Scale },
  { id: 'er',     label: 'Est. Resultados', icon: TrendingUp },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function ContabilidadPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('plan');

  // Plan de cuentas
  const [arbol, setArbol] = useState<CuentaContable[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Diario
  const [asientos, setAsientos] = useState<AsientoContable[]>([]);
  const [showAsientoModal, setShowAsientoModal] = useState(false);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [filAnio, setFilAnio] = useState(String(new Date().getFullYear()));
  const [filMes,  setFilMes]  = useState(String(new Date().getMonth() + 1));

  // Informes
  const [balance, setBalance]  = useState<BalanceGeneral | null>(null);
  const [er,      setEr]       = useState<EstadoResultados | null>(null);
  const [infAnio, setInfAnio]  = useState(String(new Date().getFullYear()));
  const [infMes,  setInfMes]   = useState(String(new Date().getMonth() + 1));
  const [loadingInf, setLoadingInf] = useState(false);

  // Flatten árbol for asiento modal
  const [cuentasFlat, setCuentasFlat] = useState<CuentaContable[]>([]);

  // ── Load plan ──────────────────────────────────────────────────────────
  const loadPlan = useCallback(async () => {
    setLoadingPlan(true);
    try {
      const data = await getCuentasArbol();
      setArbol(data);
      const flat: CuentaContable[] = [];
      const fl = (list: CuentaContable[]) => { list.forEach(c => { flat.push(c); if (c.hijos) fl(c.hijos); }); };
      fl(data);
      setCuentasFlat(flat);
    } catch {
      showToast('Error cargando plan de cuentas', 'error');
    } finally {
      setLoadingPlan(false);
    }
  }, [showToast]);

  // ── Load diario ────────────────────────────────────────────────────────
  const loadDiario = useCallback(async () => {
    setLoadingDiario(true);
    try {
      const params: Record<string, string> = {};
      if (filAnio) params.anio = filAnio;
      if (filMes)  params.mes  = filMes;
      const data = await getAsientos(params);
      setAsientos(data);
    } catch {
      showToast('Error cargando asientos', 'error');
    } finally {
      setLoadingDiario(false);
    }
  }, [filAnio, filMes, showToast]);

  // ── Load informes ──────────────────────────────────────────────────────
  const loadInformes = useCallback(async () => {
    setLoadingInf(true);
    try {
      const [bg, er] = await Promise.all([
        getBalanceGeneral(),
        getEstadoResultados(infAnio, infMes),
      ]);
      setBalance(bg);
      setEr(er);
    } catch {
      showToast('Error cargando informes', 'error');
    } finally {
      setLoadingInf(false);
    }
  }, [infAnio, infMes, showToast]);

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useEffect(() => { if (tab === 'diario') loadDiario(); }, [tab, loadDiario]);
  useEffect(() => { if (tab === 'balance' || tab === 'er') loadInformes(); }, [tab, loadInformes]);

  const handleInicializar = async () => {
    try {
      const res = await inicializarPlan();
      showToast(res.detail, 'success');
      loadPlan();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    }
  };

  const handleBloquear = async (id: number) => {
    try {
      await bloquearAsiento(id);
      showToast('Asiento bloqueado.', 'success');
      loadDiario();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    }
  };

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <BookOpen className="text-indigo-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contabilidad</h1>
            <p className="text-sm text-gray-500">Plan de cuentas, diario y estados financieros</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Plan de Cuentas ────────────────────────────────────────────── */}
      {tab === 'plan' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <span className="font-semibold text-gray-700">Plan de Cuentas (NEC Ecuador)</span>
            <div className="flex gap-2">
              <button onClick={loadPlan}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                <RefreshCw size={13} /> Actualizar
              </button>
              {arbol.length === 0 && (
                <button onClick={handleInicializar}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  <Plus size={13} /> Inicializar plan
                </button>
              )}
            </div>
          </div>
          {loadingPlan ? (
            <div className="p-10 text-center text-gray-400">Cargando…</div>
          ) : arbol.length === 0 ? (
            <div className="p-10 text-center">
              <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">No hay plan de cuentas. Haz clic en "Inicializar plan" para crear el plan NEC estándar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b bg-gray-50">
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Nombre</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-right px-3 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {arbol.map(c => (
                    <CuentaRow key={c.id} cuenta={c} depth={0} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Diario ────────────────────────────────────────────────────── */}
      {tab === 'diario' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filAnio} onChange={e => setFilAnio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={filMes} onChange={e => setFilMes(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos los meses</option>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <button onClick={loadDiario}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw size={13} /> Buscar
            </button>
            <div className="flex-1" />
            <button onClick={() => setShowAsientoModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <Plus size={15} /> Nuevo asiento
            </button>
          </div>

          {loadingDiario ? (
            <div className="p-10 text-center text-gray-400">Cargando…</div>
          ) : asientos.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-xl border border-gray-100">
              <BookMarked size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay asientos en el período seleccionado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {asientos.map(a => (
                <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-500">{a.numero}</span>
                      <span className="font-medium text-gray-800">{a.descripcion}</span>
                      {a.referencia && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                          Ref: {a.referencia}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{a.fecha}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.tipo === 'MANUAL' ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-700'
                      }`}>{TIPO_LABELS[a.tipo]}</span>
                      {a.bloqueado ? (
                        <Lock size={14} className="text-orange-500" />
                      ) : (
                        <button onClick={() => handleBloquear(a.id)}
                          title="Bloquear asiento"
                          className="text-gray-400 hover:text-orange-500">
                          <Lock size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b">
                        <th className="text-left px-4 py-1">Cuenta</th>
                        <th className="text-left px-4 py-1">Descripción</th>
                        <th className="text-right px-4 py-1">Débito</th>
                        <th className="text-right px-4 py-1">Crédito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.lineas.map(l => (
                        <tr key={l.id} className="border-b border-gray-50">
                          <td className="px-4 py-1">
                            <span className="font-mono text-xs text-gray-500 mr-2">{l.cuenta_codigo}</span>
                            {l.cuenta_nombre}
                          </td>
                          <td className="px-4 py-1 text-gray-500 text-xs">{l.descripcion}</td>
                          <td className="px-4 py-1 text-right font-mono">{l.debe > 0 ? fmt(l.debe) : ''}</td>
                          <td className="px-4 py-1 text-right font-mono">{l.haber > 0 ? fmt(l.haber) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold text-sm">
                        <td colSpan={2} className="px-4 py-2 text-right text-gray-500">Total</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(Number(a.total_debe))}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(Number(a.total_haber))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Balance General ───────────────────────────────────────────── */}
      {tab === 'balance' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">Balance General</span>
            <button onClick={loadInformes}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>
          {loadingInf ? (
            <div className="p-10 text-center text-gray-400">Cargando…</div>
          ) : balance ? (
            <>
              <p className="text-xs text-gray-500">Al: {balance.al}</p>
              <BalanceView data={balance} />
            </>
          ) : null}
        </div>
      )}

      {/* ── Estado de Resultados ──────────────────────────────────────── */}
      {tab === 'er' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-700 flex-1">Estado de Resultados</span>
            <select value={infAnio} onChange={e => setInfAnio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={infMes} onChange={e => setInfMes(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todo el año</option>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <button onClick={loadInformes}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw size={13} /> Calcular
            </button>
          </div>
          {loadingInf ? (
            <div className="p-10 text-center text-gray-400">Cargando…</div>
          ) : er ? (
            <EstadoView data={er} />
          ) : null}
        </div>
      )}

      {/* Asiento Modal */}
      {showAsientoModal && (
        <AsientoModal
          cuentas={cuentasFlat}
          onClose={() => setShowAsientoModal(false)}
          onSaved={() => { setShowAsientoModal(false); loadDiario(); }}
        />
      )}
    </div>
  );
}
