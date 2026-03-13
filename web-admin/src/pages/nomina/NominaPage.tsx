import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, RefreshCw, CheckCircle2, Clock, DollarSign, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  getEmpleados, crearEmpleado, actualizarEmpleado,
  getRoles, crearRol, actualizarRol, aprobarRol, marcarPagadoRol,
  generarRoles, getResumenNomina,
  type Empleado, type RolPago, type ResumenNomina, type TipoContrato,
} from '../../services/nominaService';
import { useToast } from '../../hooks/useToast';

// ── Helpers ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);

const MESES_LABEL = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-700',
  APROBADO: 'bg-blue-100 text-blue-700',
  PAGADO:   'bg-green-100 text-green-700',
};

// ── Empleado Modal ────────────────────────────────────────────────────────

function EmpleadoModal({
  empleado, onClose, onSaved,
}: {
  empleado?: Empleado;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEdit = !!empleado?.id;
  const [form, setForm] = useState({
    cedula: empleado?.cedula || '',
    nombres: empleado?.nombres || '',
    apellidos: empleado?.apellidos || '',
    cargo: empleado?.cargo || '',
    departamento: empleado?.departamento || '',
    tipo_contrato: (empleado?.tipo_contrato || 'INDEFINIDO') as TipoContrato,
    estado: empleado?.estado || 'ACTIVO',
    fecha_ingreso: empleado?.fecha_ingreso || new Date().toISOString().slice(0, 10),
    sueldo_base: String(empleado?.sueldo_base || ''),
    afiliado_iess: empleado?.afiliado_iess ?? true,
    numero_iess: empleado?.numero_iess || '',
    banco: empleado?.banco || '',
    cuenta_bancaria: empleado?.cuenta_bancaria || '',
    email: empleado?.email || '',
    telefono: empleado?.telefono || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.cedula || !form.nombres || !form.apellidos || !form.sueldo_base) {
      showToast('Cédula, nombres, apellidos y sueldo son requeridos.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, sueldo_base: parseFloat(form.sueldo_base) };
      if (isEdit) {
        await actualizarEmpleado(empleado!.id, payload);
      } else {
        await crearEmpleado(payload);
      }
      showToast(isEdit ? 'Empleado actualizado.' : 'Empleado creado.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { cedula?: string[]; detail?: string } } };
      showToast(e?.response?.data?.cedula?.[0] || e?.response?.data?.detail || 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text', opts?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={String(form[key])}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        {...opts} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{isEdit ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-2 gap-4">
            {field('Cédula / Pasaporte *', 'cedula')}
            {field('Nombres *', 'nombres')}
            {field('Apellidos *', 'apellidos')}
            {field('Cargo', 'cargo')}
            {field('Departamento', 'departamento')}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo Contrato</label>
              <select value={form.tipo_contrato}
                onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value as TipoContrato }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="INDEFINIDO">Indefinido</option>
                <option value="FIJO">Plazo Fijo</option>
                <option value="OBRA">Por Obra</option>
                <option value="HONORARIOS">Honorarios</option>
                <option value="PASANTIA">Pasantía</option>
              </select>
            </div>
            {field('Fecha Ingreso *', 'fecha_ingreso', 'date')}
            {field('Sueldo Base *', 'sueldo_base', 'number', { step: '0.01', min: '0' })}
            <div className="flex items-center gap-3 col-span-2">
              <input type="checkbox" id="iess" checked={form.afiliado_iess}
                onChange={e => setForm(f => ({ ...f, afiliado_iess: e.target.checked }))}
                className="rounded" />
              <label htmlFor="iess" className="text-sm text-gray-700">Afiliado al IESS</label>
            </div>
            {form.afiliado_iess && field('Número IESS', 'numero_iess')}
            {field('Banco', 'banco')}
            {field('Cuenta Bancaria', 'cuenta_bancaria')}
            {field('Email', 'email', 'email')}
            {field('Teléfono', 'telefono')}
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear empleado'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rol Card ──────────────────────────────────────────────────────────────

function RolCard({ rol, onAprobar, onPagar, onEdit }: {
  rol: RolPago;
  onAprobar: () => void;
  onPagar: () => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <div>
            <p className="font-semibold text-gray-800 text-sm">{rol.empleado_nombre}</p>
            <p className="text-xs text-gray-500">{MESES_LABEL[rol.mes]} {rol.anio}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Líquido</p>
            <p className="font-bold text-gray-900">{fmt(rol.liquido_a_pagar)}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_BADGE[rol.estado]}`}>
            {rol.estado}
          </span>
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            {rol.estado === 'BORRADOR' && (
              <>
                <button onClick={onEdit}
                  className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">
                  Editar
                </button>
                <button onClick={onAprobar}
                  className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50">
                  Aprobar
                </button>
              </>
            )}
            {rol.estado === 'APROBADO' && (
              <button onClick={onPagar}
                className="text-xs text-green-600 border border-green-300 rounded px-2 py-1 hover:bg-green-50">
                <DollarSign size={11} className="inline" /> Marcar Pagado
              </button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t grid grid-cols-2 divide-x text-sm">
          <div className="p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ingresos</p>
            <Row label="Sueldo base"            val={rol.sueldo_base} />
            {rol.horas_extra_25 > 0    && <Row label="Horas extra 25%"  val={rol.horas_extra_25} />}
            {rol.horas_extra_100 > 0   && <Row label="Horas extra 100%" val={rol.horas_extra_100} />}
            {rol.comisiones > 0        && <Row label="Comisiones"        val={rol.comisiones} />}
            {rol.bonos > 0             && <Row label="Bonos"             val={rol.bonos} />}
            {rol.otros_ingresos > 0    && <Row label="Otros ingresos"    val={rol.otros_ingresos} />}
            <div className="border-t pt-1 flex justify-between font-semibold">
              <span>Total Ingresos</span><span>{fmt(rol.total_ingresos)}</span>
            </div>
          </div>
          <div className="p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Descuentos</p>
            <Row label="Aporte personal IESS 9.45%" val={rol.aporte_personal} />
            {rol.impuesto_renta > 0   && <Row label="Impuesto Renta" val={rol.impuesto_renta} />}
            {rol.anticipos > 0        && <Row label="Anticipos"       val={rol.anticipos} />}
            {rol.otros_descuentos > 0 && <Row label="Otros desc."     val={rol.otros_descuentos} />}
            <div className="border-t pt-1 flex justify-between font-semibold">
              <span>Total Descuentos</span><span className="text-red-600">({fmt(rol.total_descuentos)})</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span className="text-green-700">Líquido a Pagar</span>
              <span className="text-green-700">{fmt(rol.liquido_a_pagar)}</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase mt-3">Provisiones empresa</p>
            <Row label="Aporte patronal IESS 12.15%" val={rol.aporte_patronal} cls="text-orange-600" />
            <Row label="Décimo tercero"               val={rol.decimo_tercero}  cls="text-orange-600" />
            <Row label="Décimo cuarto"                val={rol.decimo_cuarto}   cls="text-orange-600" />
            <Row label="Vacaciones"                   val={rol.vacaciones}      cls="text-orange-600" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, val, cls = '' }: { label: string; val: number; cls?: string }) {
  return (
    <div className={`flex justify-between text-sm ${cls}`}>
      <span className="text-gray-600">{label}</span>
      <span className="font-mono">{fmt(val)}</span>
    </div>
  );
}

// ── Rol Manual Modal ──────────────────────────────────────────────────────

function RolModal({
  empleados, rol, anio, mes, onClose, onSaved,
}: {
  empleados: Empleado[];
  rol?: RolPago;
  anio: number;
  mes: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEdit = !!rol?.id;

  const [form, setForm] = useState({
    empleado: String(rol?.empleado || ''),
    sueldo_base: String(rol?.sueldo_base || ''),
    horas_extra_25: String(rol?.horas_extra_25 || '0'),
    horas_extra_100: String(rol?.horas_extra_100 || '0'),
    comisiones: String(rol?.comisiones || '0'),
    bonos: String(rol?.bonos || '0'),
    otros_ingresos: String(rol?.otros_ingresos || '0'),
    impuesto_renta: String(rol?.impuesto_renta || '0'),
    anticipos: String(rol?.anticipos || '0'),
    otros_descuentos: String(rol?.otros_descuentos || '0'),
    notas: rol?.notas || '',
  });
  const [saving, setSaving] = useState(false);

  const numField = (label: string, key: keyof typeof form) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" step="0.01" min="0" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right" />
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        anio, mes,
        empleado: parseInt(form.empleado),
        sueldo_base: parseFloat(form.sueldo_base) || 0,
        horas_extra_25: parseFloat(form.horas_extra_25) || 0,
        horas_extra_100: parseFloat(form.horas_extra_100) || 0,
        comisiones: parseFloat(form.comisiones) || 0,
        bonos: parseFloat(form.bonos) || 0,
        otros_ingresos: parseFloat(form.otros_ingresos) || 0,
        impuesto_renta: parseFloat(form.impuesto_renta) || 0,
        anticipos: parseFloat(form.anticipos) || 0,
        otros_descuentos: parseFloat(form.otros_descuentos) || 0,
      };
      if (isEdit) {
        await actualizarRol(rol!.id, payload);
      } else {
        await crearRol(payload);
      }
      showToast('Rol guardado.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { non_field_errors?: string[]; detail?: string } } };
      showToast(e?.response?.data?.non_field_errors?.[0] || e?.response?.data?.detail || 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? 'Editar Rol' : `Nuevo Rol — ${MESES_LABEL[mes]} ${anio}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Empleado *</label>
              <select value={form.empleado} onChange={e => {
                const emp = empleados.find(em => em.id === parseInt(e.target.value));
                setForm(f => ({ ...f, empleado: e.target.value, sueldo_base: String(emp?.sueldo_base || '') }));
              }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione —</option>
                {empleados.filter(e => e.estado === 'ACTIVO').map(e => (
                  <option key={e.id} value={e.id}>{e.apellidos}, {e.nombres}</option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs font-semibold text-gray-500 uppercase">Ingresos</p>
          <div className="grid grid-cols-2 gap-3">
            {numField('Sueldo Base', 'sueldo_base')}
            {numField('Horas Extra 25%', 'horas_extra_25')}
            {numField('Horas Extra 100%', 'horas_extra_100')}
            {numField('Comisiones', 'comisiones')}
            {numField('Bonos', 'bonos')}
            {numField('Otros Ingresos', 'otros_ingresos')}
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase">Descuentos adicionales</p>
          <div className="grid grid-cols-2 gap-3">
            {numField('Impuesto Renta', 'impuesto_renta')}
            {numField('Anticipos', 'anticipos')}
            {numField('Otros Descuentos', 'otros_descuentos')}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

type Tab = 'roles' | 'empleados';

export default function NominaPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('roles');

  // Filtros
  const [filAnio, setFilAnio] = useState(String(new Date().getFullYear()));
  const [filMes,  setFilMes]  = useState(String(new Date().getMonth() + 1));

  // Datos
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [roles,     setRoles]     = useState<RolPago[]>([]);
  const [resumen,   setResumen]   = useState<ResumenNomina | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showEmpleadoModal,  setShowEmpleadoModal]  = useState(false);
  const [editingEmpleado,    setEditingEmpleado]    = useState<Empleado | undefined>();
  const [showRolModal,       setShowRolModal]       = useState(false);
  const [editingRol,         setEditingRol]         = useState<RolPago | undefined>();

  const loadEmpleados = useCallback(async () => {
    const data = await getEmpleados();
    setEmpleados(data);
  }, []);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filAnio) params.anio = filAnio;
      if (filMes)  params.mes  = filMes;
      const [r, res] = await Promise.all([
        getRoles(params),
        getResumenNomina(filAnio, filMes),
      ]);
      setRoles(r);
      setResumen(res);
    } catch {
      showToast('Error cargando nómina', 'error');
    } finally {
      setLoading(false);
    }
  }, [filAnio, filMes, showToast]);

  useEffect(() => { loadEmpleados(); }, [loadEmpleados]);
  useEffect(() => { if (tab === 'roles') loadRoles(); }, [tab, loadRoles]);

  const handleGenerar = async () => {
    try {
      const res = await generarRoles(parseInt(filAnio), parseInt(filMes));
      showToast(res.detail, 'success');
      loadRoles();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    }
  };

  const handleAprobar = async (id: number) => {
    try {
      await aprobarRol(id);
      showToast('Rol aprobado.', 'success');
      loadRoles();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    }
  };

  const handlePagar = async (id: number) => {
    try {
      await marcarPagadoRol(id);
      showToast('Rol marcado como pagado.', 'success');
      loadRoles();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e?.response?.data?.detail || 'Error', 'error');
    }
  };

  const MESES_OPTS = MESES_LABEL.slice(1);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Users className="text-purple-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nómina</h1>
            <p className="text-sm text-gray-500">Empleados, roles de pago y provisiones IESS</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'roles' as Tab,     label: 'Roles de Pago' },
          { id: 'empleados' as Tab, label: 'Empleados' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Roles de Pago ─────────────────────────────────────────────── */}
      {tab === 'roles' && (
        <div className="space-y-4">
          {/* Filtros + acciones */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filAnio} onChange={e => setFilAnio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={filMes} onChange={e => setFilMes(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {MESES_OPTS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <button onClick={loadRoles}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw size={13} />
            </button>
            <div className="flex-1" />
            <button onClick={handleGenerar}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <RefreshCw size={14} /> Generar todos
            </button>
            <button onClick={() => { setEditingRol(undefined); setShowRolModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <Plus size={14} /> Nuevo rol
            </button>
          </div>

          {/* KPIs */}
          {resumen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Empleados', val: resumen.empleados.toString(), mono: false, cls: 'text-gray-900' },
                { label: 'Total Líquido', val: fmt(resumen.total_liquido), mono: true, cls: 'text-green-700' },
                { label: 'Aporte Patronal', val: fmt(resumen.total_aporte_patronal), mono: true, cls: 'text-orange-600' },
                { label: 'Costo Total Empresa', val: fmt(resumen.total_liquido + resumen.total_aporte_patronal + resumen.total_decimo_tercero + resumen.total_decimo_cuarto + resumen.total_vacaciones), mono: true, cls: 'text-red-700' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.cls} ${k.mono ? 'font-mono' : ''}`}>{k.val}</p>
                </div>
              ))}
            </div>
          )}

          {/* Roles */}
          {loading ? (
            <div className="p-10 text-center text-gray-400">Cargando…</div>
          ) : roles.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-xl border border-gray-100">
              <Clock size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-3">No hay roles para este período.</p>
              <button onClick={handleGenerar}
                className="text-purple-600 text-sm border border-purple-300 rounded-lg px-4 py-2 hover:bg-purple-50">
                Generar roles automáticamente
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map(r => (
                <RolCard
                  key={r.id}
                  rol={r}
                  onAprobar={() => handleAprobar(r.id)}
                  onPagar={() => handlePagar(r.id)}
                  onEdit={() => { setEditingRol(r); setShowRolModal(true); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empleados ─────────────────────────────────────────────────── */}
      {tab === 'empleados' && (
        <div className="space-y-4">
          <div className="flex justify-between">
            <p className="text-sm text-gray-500">{empleados.length} empleado(s)</p>
            <div className="flex gap-2">
              <button onClick={loadEmpleados}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                <RefreshCw size={12} />
              </button>
              <button onClick={() => { setEditingEmpleado(undefined); setShowEmpleadoModal(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                <Plus size={14} /> Nuevo empleado
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50 border-b">
                  <th className="text-left px-4 py-2">Nombre</th>
                  <th className="text-left px-4 py-2">Cédula</th>
                  <th className="text-left px-4 py-2">Cargo</th>
                  <th className="text-right px-4 py-2">Sueldo Base</th>
                  <th className="text-center px-4 py-2">IESS</th>
                  <th className="text-center px-4 py-2">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {empleados.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{e.apellidos}, {e.nombres}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.cedula}</td>
                    <td className="px-4 py-3 text-gray-600">{e.cargo}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(e.sueldo_base)}</td>
                    <td className="px-4 py-3 text-center">
                      {e.afiliado_iess
                        ? <CheckCircle2 size={15} className="text-green-500 mx-auto" />
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        e.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{e.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditingEmpleado(e); setShowEmpleadoModal(true); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {empleados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      No hay empleados registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showEmpleadoModal && (
        <EmpleadoModal
          empleado={editingEmpleado}
          onClose={() => setShowEmpleadoModal(false)}
          onSaved={() => { setShowEmpleadoModal(false); loadEmpleados(); }}
        />
      )}

      {showRolModal && (
        <RolModal
          empleados={empleados}
          rol={editingRol}
          anio={parseInt(filAnio)}
          mes={parseInt(filMes)}
          onClose={() => setShowRolModal(false)}
          onSaved={() => { setShowRolModal(false); loadRoles(); }}
        />
      )}
    </div>
  );
}
