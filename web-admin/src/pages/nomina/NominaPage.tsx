import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, RefreshCw, CheckCircle2, Clock, DollarSign, ChevronDown, ChevronRight,
  Settings, ListChecks, CalendarCog, Trash2,
} from 'lucide-react';
import {
  getEmpleados, crearEmpleado, actualizarEmpleado,
  getRoles, crearRol, actualizarRol, aprobarRol, marcarPagadoRol,
  generarRoles, getResumenNomina, getRubros, crearRubro, actualizarRubro, sembrarRubrosBase,
  getConceptosEmpleado, crearConceptoEmpleado, actualizarConceptoEmpleado,
  getParametrosNomina, crearParametroNomina, actualizarParametroNomina,
  type Empleado, type RolPago, type ResumenNomina, type TipoContrato,
  type RubroNomina, type DetalleRolPago, type ConceptoEmpleadoNomina, type ParametroNomina,
  type TipoRubroNomina,
} from '../../services/nominaService';
import { getCuentas, type CuentaBancaria } from '../../services/bancosService';
import { useToast } from '../../hooks/useToast';

const fmt = (n: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const num = (value: string | number | undefined) => Number(value || 0);

const MESES_LABEL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-700',
  APROBADO: 'bg-blue-100 text-blue-700',
  PAGADO: 'bg-green-100 text-green-700',
};
const TIPO_BADGE: Record<TipoRubroNomina, string> = {
  INGRESO: 'bg-green-100 text-green-700',
  DESCUENTO: 'bg-red-100 text-red-700',
  PROVISION: 'bg-orange-100 text-orange-700',
};

function Row({ label, val, cls = '' }: { label: string; val: number; cls?: string }) {
  return <div className={`flex justify-between text-sm ${cls}`}><span className="text-gray-600">{label}</span><span className="font-mono">{fmt(val)}</span></div>;
}

function EmpleadoModal({ empleado, onClose, onSaved }: { empleado?: Empleado; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const isEdit = !!empleado?.id;
  const [form, setForm] = useState({
    cedula: empleado?.cedula || '', nombres: empleado?.nombres || '', apellidos: empleado?.apellidos || '', cargo: empleado?.cargo || '',
    departamento: empleado?.departamento || '', tipo_contrato: (empleado?.tipo_contrato || 'INDEFINIDO') as TipoContrato,
    estado: empleado?.estado || 'ACTIVO', fecha_ingreso: empleado?.fecha_ingreso || new Date().toISOString().slice(0, 10),
    sueldo_base: String(empleado?.sueldo_base || ''), afiliado_iess: empleado?.afiliado_iess ?? true, numero_iess: empleado?.numero_iess || '',
    banco: empleado?.banco || '', cuenta_bancaria: empleado?.cuenta_bancaria || '', email: empleado?.email || '', telefono: empleado?.telefono || '',
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
      if (isEdit) await actualizarEmpleado(empleado!.id, payload); else await crearEmpleado(payload);
      showToast(isEdit ? 'Empleado actualizado.' : 'Empleado creado.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { cedula?: string[]; detail?: string } } };
      showToast(e?.response?.data?.cedula?.[0] || e?.response?.data?.detail || 'Error', 'error');
    } finally { setSaving(false); }
  };

  const field = (label: string, key: keyof typeof form, type = 'text', opts?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label><input type={type} value={String(form[key])}
      onChange={e => setForm(f => ({ ...f, [key]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" {...opts} /></div>
  );

  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold text-gray-800">{isEdit ? 'Editar Empleado' : 'Nuevo Empleado'}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button></div>
      <div className="overflow-y-auto flex-1 p-5"><div className="grid grid-cols-2 gap-4">
        {field('Cédula / Pasaporte *', 'cedula')}{field('Nombres *', 'nombres')}{field('Apellidos *', 'apellidos')}{field('Cargo', 'cargo')}{field('Departamento', 'departamento')}
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo Contrato</label><select value={form.tipo_contrato} onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value as TipoContrato }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="INDEFINIDO">Indefinido</option><option value="FIJO">Plazo Fijo</option><option value="OBRA">Por Obra</option><option value="HONORARIOS">Honorarios</option><option value="PASANTIA">Pasantía</option></select></div>
        {field('Fecha Ingreso *', 'fecha_ingreso', 'date')}{field('Sueldo Base *', 'sueldo_base', 'number', { step: '0.01', min: '0' })}
        <div className="flex items-center gap-3 col-span-2"><input type="checkbox" id="iess" checked={form.afiliado_iess} onChange={e => setForm(f => ({ ...f, afiliado_iess: e.target.checked }))} className="rounded" /><label htmlFor="iess" className="text-sm text-gray-700">Afiliado al IESS</label></div>
        {form.afiliado_iess && field('Número IESS', 'numero_iess')}{field('Banco', 'banco')}{field('Cuenta Bancaria', 'cuenta_bancaria')}{field('Email', 'email', 'email')}{field('Teléfono', 'telefono')}
      </div></div>
      <div className="p-5 border-t flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear empleado'}</button></div>
    </div>
  </div>;
}

function RolCard({ rol, onAprobar, onPagar, onEdit }: { rol: RolPago; onAprobar: () => void; onPagar: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const ingresos = (rol.detalles || []).filter(d => d.tipo === 'INGRESO');
  const descuentos = (rol.detalles || []).filter(d => d.tipo === 'DESCUENTO');

  return <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(o => !o)}>
      <div className="flex items-center gap-3">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<div><p className="font-semibold text-gray-800 text-sm">{rol.empleado_nombre}</p><p className="text-xs text-gray-500">{MESES_LABEL[rol.mes]} {rol.anio}</p></div></div>
      <div className="flex items-center gap-4"><div className="text-right"><p className="text-xs text-gray-500">Líquido</p><p className="font-bold text-gray-900">{fmt(rol.liquido_a_pagar)}</p></div><span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_BADGE[rol.estado]}`}>{rol.estado}</span>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>{rol.estado === 'BORRADOR' && <><button onClick={onEdit} className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">Editar</button><button onClick={onAprobar} className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50">Aprobar</button></>}{rol.estado === 'APROBADO' && <button onClick={onPagar} className="text-xs text-green-600 border border-green-300 rounded px-2 py-1 hover:bg-green-50"><DollarSign size={11} className="inline" /> Pagar</button>}</div>
      </div>
    </div>
    {open && <div className="border-t grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x text-sm">
      <div className="p-4 space-y-1"><p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ingresos</p>{ingresos.length > 0 ? ingresos.map((d, i) => <Row key={d.id || i} label={d.descripcion || d.rubro_nombre || 'Ingreso'} val={d.valor_total || 0} />) : <><Row label="Sueldo base" val={rol.sueldo_base} />{rol.horas_extra_25 > 0 && <Row label="Horas extra 25%" val={rol.horas_extra_25} />}{rol.horas_extra_100 > 0 && <Row label="Horas extra 100%" val={rol.horas_extra_100} />}{rol.comisiones > 0 && <Row label="Comisiones" val={rol.comisiones} />}{rol.bonos > 0 && <Row label="Bonos" val={rol.bonos} />}{rol.otros_ingresos > 0 && <Row label="Otros ingresos" val={rol.otros_ingresos} />}</>}<div className="border-t pt-1 flex justify-between font-semibold"><span>Total Ingresos</span><span>{fmt(rol.total_ingresos)}</span></div></div>
      <div className="p-4 space-y-1"><p className="text-xs font-semibold text-gray-500 uppercase mb-2">Descuentos</p><Row label="Aporte personal IESS" val={rol.aporte_personal} />{descuentos.map((d, i) => <Row key={d.id || i} label={d.descripcion || d.rubro_nombre || 'Descuento'} val={d.valor_total || 0} />)}<div className="border-t pt-1 flex justify-between font-semibold"><span>Total Descuentos</span><span className="text-red-600">({fmt(rol.total_descuentos)})</span></div><div className="border-t pt-2 flex justify-between font-bold text-base"><span className="text-green-700">Líquido a Pagar</span><span className="text-green-700">{fmt(rol.liquido_a_pagar)}</span></div><p className="text-xs font-semibold text-gray-400 uppercase mt-3">Provisiones empresa</p><Row label="Aporte patronal IESS" val={rol.aporte_patronal} cls="text-orange-600" /><Row label="Décimo tercero" val={rol.decimo_tercero} cls="text-orange-600" /><Row label="Décimo cuarto" val={rol.decimo_cuarto} cls="text-orange-600" /><Row label="Fondos reserva" val={rol.fondos_reserva} cls="text-orange-600" /><Row label="Vacaciones" val={rol.vacaciones} cls="text-orange-600" />{rol.pago_nomina && <p className="pt-2 text-xs text-gray-500">Pago: {rol.pago_nomina.fecha_pago} {rol.pago_nomina.cuenta_label ? `- ${rol.pago_nomina.cuenta_label}` : ''}</p>}</div>
    </div>}
  </div>;
}

function RolModal({ empleados, rubros, rol, anio, mes, onClose, onSaved }: { empleados: Empleado[]; rubros: RubroNomina[]; rol?: RolPago; anio: number; mes: number; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const isEdit = !!rol?.id;
  const activeRubros = rubros.filter(r => r.activo && r.tipo !== 'PROVISION');
  const [empleado, setEmpleado] = useState(String(rol?.empleado || ''));
  const [notas, setNotas] = useState(rol?.notas || '');
  const [detalles, setDetalles] = useState<DetalleRolPago[]>(() => {
    if (rol?.detalles?.length) return rol.detalles.map(d => ({ ...d, cantidad: num(d.cantidad), valor_unitario: num(d.valor_unitario), valor_total: num(d.valor_total) }));
    const sueldo = rubros.find(r => r.codigo === 'SUELDO_BASE') || rubros.find(r => r.tipo === 'INGRESO');
    return sueldo ? [{ rubro: sueldo.id, descripcion: sueldo.nombre, cantidad: 1, valor_unitario: 0, orden: sueldo.orden }] : [];
  });
  const [saving, setSaving] = useState(false);

  const setDetalle = (index: number, patch: Partial<DetalleRolPago>) => setDetalles(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const addDetalle = (tipo?: TipoRubroNomina) => {
    const rubro = activeRubros.find(r => !tipo || r.tipo === tipo) || activeRubros[0];
    if (!rubro) return;
    setDetalles(rows => [...rows, { rubro: rubro.id, descripcion: rubro.nombre, cantidad: 1, valor_unitario: 0, orden: rubro.orden }]);
  };
  const removeDetalle = (index: number) => setDetalles(rows => rows.filter((_, i) => i !== index));

  const handleRubroChange = (index: number, rubroId: number) => {
    const rubro = rubros.find(r => r.id === rubroId);
    setDetalle(index, { rubro: rubroId, descripcion: rubro?.nombre || '', orden: rubro?.orden || 100 });
  };

  const handleEmpleadoChange = (value: string) => {
    setEmpleado(value);
    const emp = empleados.find(e => e.id === Number(value));
    const sueldo = rubros.find(r => r.codigo === 'SUELDO_BASE');
    if (!emp || !sueldo || isEdit) return;
    setDetalles(rows => rows.length ? rows.map((row, index) => index === 0 ? { ...row, rubro: sueldo.id, descripcion: sueldo.nombre, valor_unitario: emp.sueldo_base, cantidad: 1 } : row) : [{ rubro: sueldo.id, descripcion: sueldo.nombre, cantidad: 1, valor_unitario: emp.sueldo_base, orden: sueldo.orden }]);
  };

  const totalPreview = detalles.reduce((acc, d) => acc + num(d.cantidad) * num(d.valor_unitario), 0);

  const handleSave = async () => {
    if (!empleado) { showToast('Seleccione un empleado.', 'error'); return; }
    if (!detalles.length) { showToast('Agregue al menos un ingreso o descuento.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { empleado: Number(empleado), anio, mes, notas, detalles: detalles.map((d, i) => ({ rubro: Number(d.rubro), descripcion: d.descripcion, cantidad: num(d.cantidad), valor_unitario: num(d.valor_unitario), orden: d.orden || i + 1 })) };
      if (isEdit) await actualizarRol(rol!.id, payload); else await crearRol(payload);
      showToast('Rol guardado.', 'success');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { non_field_errors?: string[]; detail?: string; empleado?: string[] } } };
      showToast(e?.response?.data?.non_field_errors?.[0] || e?.response?.data?.empleado?.[0] || e?.response?.data?.detail || 'Error', 'error');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
    <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold text-gray-800">{isEdit ? 'Editar Rol' : `Nuevo Rol - ${MESES_LABEL[mes]} ${anio}`}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button></div>
    <div className="overflow-y-auto flex-1 p-5 space-y-4">
      {!isEdit && <div><label className="block text-xs font-medium text-gray-600 mb-1">Empleado *</label><select value={empleado} onChange={e => handleEmpleadoChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Seleccione</option>{empleados.filter(e => e.estado === 'ACTIVO').map(e => <option key={e.id} value={e.id}>{e.apellidos}, {e.nombres}</option>)}</select></div>}
      <div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-500 uppercase">Detalle de ingresos y descuentos</p><div className="flex gap-2"><button onClick={() => addDetalle('INGRESO')} className="px-3 py-1.5 text-xs border border-green-300 text-green-700 rounded-lg hover:bg-green-50">Ingreso</button><button onClick={() => addDetalle('DESCUENTO')} className="px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50">Descuento</button></div></div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="text-left px-3 py-2">Rubro</th><th className="text-left px-3 py-2">Descripción</th><th className="text-right px-3 py-2 w-24">Cantidad</th><th className="text-right px-3 py-2 w-32">Valor</th><th className="text-right px-3 py-2 w-32">Total</th><th className="w-10"></th></tr></thead><tbody>{detalles.map((d, index) => <tr key={index} className="border-t"><td className="px-3 py-2"><select value={d.rubro || ''} onChange={e => handleRubroChange(index, Number(e.target.value))} className="w-full border border-gray-300 rounded px-2 py-1 text-xs">{activeRubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></td><td className="px-3 py-2"><input value={d.descripcion} onChange={e => setDetalle(index, { descripcion: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs" /></td><td className="px-3 py-2"><input type="number" step="0.01" min="0" value={d.cantidad} onChange={e => setDetalle(index, { cantidad: num(e.target.value) })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right" /></td><td className="px-3 py-2"><input type="number" step="0.01" min="0" value={d.valor_unitario} onChange={e => setDetalle(index, { valor_unitario: num(e.target.value) })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right" /></td><td className="px-3 py-2 text-right font-mono">{fmt(num(d.cantidad) * num(d.valor_unitario))}</td><td className="px-2 py-2"><button onClick={() => removeDetalle(index)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>
      <div className="flex justify-between text-sm bg-gray-50 border border-gray-100 rounded-lg p-3"><span className="text-gray-500">Total líneas antes de descuentos automáticos</span><span className="font-semibold font-mono">{fmt(totalPreview)}</span></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Notas</label><textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
    </div>
    <div className="p-5 border-t flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button></div>
  </div></div>;
}

function PagarRolModal({ rol, cuentas, onClose, onSaved }: { rol: RolPago; cuentas: CuentaBancaria[]; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [cuenta, setCuenta] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); try { await marcarPagadoRol(rol.id, { cuenta_bancaria: cuenta ? Number(cuenta) : null, fecha_pago: fecha, referencia }); showToast('Rol pagado.', 'success'); onSaved(); } catch (err: unknown) { const e = err as { response?: { data?: { detail?: string } } }; showToast(e?.response?.data?.detail || 'Error registrando pago', 'error'); } finally { setSaving(false); } };
  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-md"><div className="p-5 border-b"><h2 className="font-semibold text-gray-800">Pagar rol</h2><p className="text-sm text-gray-500">{rol.empleado_nombre} - {fmt(rol.liquido_a_pagar)}</p></div><div className="p-5 space-y-3"><div><label className="block text-xs font-medium text-gray-600 mb-1">Cuenta bancaria</label><select value={cuenta} onChange={e => setCuenta(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Sin movimiento bancario</option>{cuentas.filter(c => c.activa).map(c => <option key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha pago</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label><input value={referencia} onChange={e => setReferencia(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div></div><div className="p-5 border-t flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Registrar pago'}</button></div></div></div>;
}

function RubrosPanel({ rubros, onReload }: { rubros: RubroNomina[]; onReload: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ codigo: '', nombre: '', tipo: 'INGRESO' as TipoRubroNomina, aplica_iess: false, aplica_ir: false });
  const save = async () => { if (!form.codigo || !form.nombre) return; try { await crearRubro({ ...form, activo: true, es_recurrente: true }); setForm({ codigo: '', nombre: '', tipo: 'INGRESO', aplica_iess: false, aplica_ir: false }); showToast('Rubro creado.', 'success'); onReload(); } catch { showToast('No se pudo crear el rubro.', 'error'); } };
  const seed = async () => { await sembrarRubrosBase(); showToast('Rubros base disponibles.', 'success'); onReload(); };
  return <div className="space-y-4"><div className="bg-white border border-gray-100 rounded-xl p-4 grid md:grid-cols-6 gap-3"><input placeholder="Código" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><input placeholder="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm md:col-span-2" /><select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoRubroNomina }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="INGRESO">Ingreso</option><option value="DESCUENTO">Descuento</option><option value="PROVISION">Provisión</option></select><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={form.aplica_iess} onChange={e => setForm(f => ({ ...f, aplica_iess: e.target.checked }))} /> IESS</label><button onClick={save} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Crear</button><button onClick={seed} className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-6">Crear rubros base</button></div><div className="bg-white border border-gray-100 rounded-xl overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="text-left px-4 py-2">Código</th><th className="text-left px-4 py-2">Nombre</th><th className="text-left px-4 py-2">Tipo</th><th className="text-center px-4 py-2">IESS</th><th className="text-center px-4 py-2">Activo</th></tr></thead><tbody>{rubros.map(r => <tr key={r.id} className="border-t"><td className="px-4 py-2 font-mono text-xs">{r.codigo}</td><td className="px-4 py-2">{r.nombre}</td><td className="px-4 py-2"><span className={`text-xs px-2 py-1 rounded-full ${TIPO_BADGE[r.tipo]}`}>{r.tipo}</span></td><td className="px-4 py-2 text-center">{r.aplica_iess ? 'Sí' : 'No'}</td><td className="px-4 py-2 text-center"><button onClick={async () => { await actualizarRubro(r.id, { activo: !r.activo }); onReload(); }} className="text-xs text-indigo-600">{r.activo ? 'Activo' : 'Inactivo'}</button></td></tr>)}</tbody></table></div></div>;
}

function ConceptosPanel({ empleados, rubros, conceptos, onReload }: { empleados: Empleado[]; rubros: RubroNomina[]; conceptos: ConceptoEmpleadoNomina[]; onReload: () => void }) {
  const { showToast } = useToast();
  const recurrentes = rubros.filter(r => r.activo && r.es_recurrente && r.codigo !== 'SUELDO_BASE');
  const [form, setForm] = useState({ empleado: '', rubro: '', valor: '', descripcion: '' });
  const save = async () => { if (!form.empleado || !form.rubro || !form.valor) return; try { await crearConceptoEmpleado({ empleado: Number(form.empleado), rubro: Number(form.rubro), valor: Number(form.valor), descripcion: form.descripcion, activo: true }); setForm({ empleado: '', rubro: '', valor: '', descripcion: '' }); showToast('Concepto recurrente creado.', 'success'); onReload(); } catch { showToast('No se pudo crear el concepto.', 'error'); } };
  return <div className="space-y-4"><div className="bg-white border border-gray-100 rounded-xl p-4 grid md:grid-cols-5 gap-3"><select value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Empleado</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.apellidos}, {e.nombres}</option>)}</select><select value={form.rubro} onChange={e => setForm(f => ({ ...f, rubro: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Rubro</option>{recurrentes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select><input type="number" step="0.01" placeholder="Valor" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><input placeholder="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><button onClick={save} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Crear</button></div><div className="bg-white border border-gray-100 rounded-xl overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="text-left px-4 py-2">Empleado</th><th className="text-left px-4 py-2">Rubro</th><th className="text-right px-4 py-2">Valor</th><th className="text-center px-4 py-2">Estado</th></tr></thead><tbody>{conceptos.map(c => <tr key={c.id} className="border-t"><td className="px-4 py-2">{c.empleado_nombre}</td><td className="px-4 py-2">{c.descripcion || c.rubro_nombre}</td><td className="px-4 py-2 text-right font-mono">{fmt(c.valor)}</td><td className="px-4 py-2 text-center"><button onClick={async () => { await actualizarConceptoEmpleado(c.id, { activo: !c.activo }); onReload(); }} className="text-xs text-indigo-600">{c.activo ? 'Activo' : 'Inactivo'}</button></td></tr>)}</tbody></table></div></div>;
}

function ParametrosPanel({ parametros, onReload }: { parametros: ParametroNomina[]; onReload: () => void }) {
  const { showToast } = useToast();
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ anio: String(year), sbu: '460.00', aporte_personal_iess: '0.0945', aporte_patronal_iess: '0.1215' });
  const save = async () => { try { await crearParametroNomina({ anio: Number(form.anio), sbu: Number(form.sbu), aporte_personal_iess: Number(form.aporte_personal_iess), aporte_patronal_iess: Number(form.aporte_patronal_iess), activo: true }); showToast('Parámetro creado.', 'success'); onReload(); } catch { showToast('No se pudo crear el parámetro.', 'error'); } };
  return <div className="space-y-4"><div className="bg-white border border-gray-100 rounded-xl p-4 grid md:grid-cols-5 gap-3"><input type="number" value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><input type="number" step="0.01" value={form.sbu} onChange={e => setForm(f => ({ ...f, sbu: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><input type="number" step="0.0001" value={form.aporte_personal_iess} onChange={e => setForm(f => ({ ...f, aporte_personal_iess: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><input type="number" step="0.0001" value={form.aporte_patronal_iess} onChange={e => setForm(f => ({ ...f, aporte_patronal_iess: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /><button onClick={save} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Crear</button></div><div className="bg-white border border-gray-100 rounded-xl overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="text-left px-4 py-2">Año</th><th className="text-right px-4 py-2">SBU</th><th className="text-right px-4 py-2">IESS personal</th><th className="text-right px-4 py-2">IESS patronal</th><th className="text-center px-4 py-2">Estado</th></tr></thead><tbody>{parametros.map(p => <tr key={p.id} className="border-t"><td className="px-4 py-2">{p.anio}</td><td className="px-4 py-2 text-right">{fmt(p.sbu)}</td><td className="px-4 py-2 text-right">{Number(p.aporte_personal_iess) * 100}%</td><td className="px-4 py-2 text-right">{Number(p.aporte_patronal_iess) * 100}%</td><td className="px-4 py-2 text-center"><button onClick={async () => { await actualizarParametroNomina(p.id, { activo: !p.activo }); onReload(); }} className="text-xs text-indigo-600">{p.activo ? 'Activo' : 'Inactivo'}</button></td></tr>)}</tbody></table></div></div>;
}

type Tab = 'roles' | 'empleados' | 'rubros' | 'conceptos' | 'parametros';

export default function NominaPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('roles');
  const [filAnio, setFilAnio] = useState(String(new Date().getFullYear()));
  const [filMes, setFilMes] = useState(String(new Date().getMonth() + 1));
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [roles, setRoles] = useState<RolPago[]>([]);
  const [rubros, setRubros] = useState<RubroNomina[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoEmpleadoNomina[]>([]);
  const [parametros, setParametros] = useState<ParametroNomina[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [resumen, setResumen] = useState<ResumenNomina | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEmpleadoModal, setShowEmpleadoModal] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | undefined>();
  const [showRolModal, setShowRolModal] = useState(false);
  const [editingRol, setEditingRol] = useState<RolPago | undefined>();
  const [payingRol, setPayingRol] = useState<RolPago | null>(null);

  const loadEmpleados = useCallback(async () => setEmpleados(await getEmpleados()), []);
  const loadRubros = useCallback(async () => setRubros(await getRubros()), []);
  const loadConceptos = useCallback(async () => setConceptos(await getConceptosEmpleado()), []);
  const loadParametros = useCallback(async () => setParametros(await getParametrosNomina()), []);
  const loadCuentas = useCallback(async () => setCuentas(await getCuentas()), []);
  const loadRoles = useCallback(async () => { setLoading(true); try { const params: Record<string, string> = {}; if (filAnio) params.anio = filAnio; if (filMes) params.mes = filMes; const [r, res] = await Promise.all([getRoles(params), getResumenNomina(filAnio, filMes)]); setRoles(r); setResumen(res); } catch { showToast('Error cargando nómina', 'error'); } finally { setLoading(false); } }, [filAnio, filMes, showToast]);

  useEffect(() => { loadEmpleados(); loadRubros(); loadCuentas(); }, [loadEmpleados, loadRubros, loadCuentas]);
  useEffect(() => { if (tab === 'roles') loadRoles(); }, [tab, loadRoles]);
  useEffect(() => { if (tab === 'conceptos') loadConceptos(); }, [tab, loadConceptos]);
  useEffect(() => { if (tab === 'parametros') loadParametros(); }, [tab, loadParametros]);

  const handleGenerar = async () => { try { const res = await generarRoles(parseInt(filAnio), parseInt(filMes)); showToast(res.detail, 'success'); await Promise.all([loadRoles(), loadRubros()]); } catch (err: unknown) { const e = err as { response?: { data?: { detail?: string } } }; showToast(e?.response?.data?.detail || 'Error', 'error'); } };
  const handleAprobar = async (id: number) => { try { await aprobarRol(id); showToast('Rol aprobado.', 'success'); loadRoles(); } catch (err: unknown) { const e = err as { response?: { data?: { detail?: string } } }; showToast(e?.response?.data?.detail || 'Error', 'error'); } };

  const tabs = [
    { id: 'roles' as Tab, label: 'Roles de Pago', icon: Users },
    { id: 'empleados' as Tab, label: 'Empleados', icon: Users },
    { id: 'rubros' as Tab, label: 'Rubros', icon: ListChecks },
    { id: 'conceptos' as Tab, label: 'Recurrentes', icon: Settings },
    { id: 'parametros' as Tab, label: 'Parámetros', icon: CalendarCog },
  ];

  return <div className="p-6 space-y-6 max-w-6xl mx-auto">
    <div className="flex items-center justify-between flex-wrap gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><Users className="text-purple-600" size={20} /></div><div><h1 className="text-xl font-bold text-gray-900">Nómina</h1><p className="text-sm text-gray-500">Empleados, rubros, roles de pago y pagos conectados a bancos</p></div></div></div>
    <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">{tabs.map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Icon size={15} />{t.label}</button>; })}</div>

    {tab === 'roles' && <div className="space-y-4"><div className="flex items-center gap-3 flex-wrap"><select value={filAnio} onChange={e => setFilAnio(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">{Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}</select><select value={filMes} onChange={e => setFilMes(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">{MESES_LABEL.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select><button onClick={loadRoles} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw size={13} /></button><div className="flex-1" /><button onClick={handleGenerar} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700"><RefreshCw size={14} /> Generar todos</button><button onClick={() => { setEditingRol(undefined); setShowRolModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Plus size={14} /> Nuevo rol</button></div>
      {resumen && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[{ label: 'Empleados', val: resumen.empleados.toString(), mono: false, cls: 'text-gray-900' }, { label: 'Total Líquido', val: fmt(resumen.total_liquido), mono: true, cls: 'text-green-700' }, { label: 'Aporte Patronal', val: fmt(resumen.total_aporte_patronal), mono: true, cls: 'text-orange-600' }, { label: 'Costo Total Empresa', val: fmt(resumen.total_liquido + resumen.total_aporte_patronal + resumen.total_decimo_tercero + resumen.total_decimo_cuarto + resumen.total_vacaciones), mono: true, cls: 'text-red-700' }].map(k => <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-500">{k.label}</p><p className={`text-xl font-bold mt-1 ${k.cls} ${k.mono ? 'font-mono' : ''}`}>{k.val}</p></div>)}</div>}
      {loading ? <div className="p-10 text-center text-gray-400">Cargando...</div> : roles.length === 0 ? <div className="p-10 text-center bg-white rounded-xl border border-gray-100"><Clock size={40} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 mb-3">No hay roles para este período.</p><button onClick={handleGenerar} className="text-purple-600 text-sm border border-purple-300 rounded-lg px-4 py-2 hover:bg-purple-50">Generar roles automáticamente</button></div> : <div className="space-y-3">{roles.map(r => <RolCard key={r.id} rol={r} onAprobar={() => handleAprobar(r.id)} onPagar={() => setPayingRol(r)} onEdit={() => { setEditingRol(r); setShowRolModal(true); }} />)}</div>}
    </div>}

    {tab === 'empleados' && <div className="space-y-4"><div className="flex justify-between"><p className="text-sm text-gray-500">{empleados.length} empleado(s)</p><div className="flex gap-2"><button onClick={loadEmpleados} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw size={12} /></button><button onClick={() => { setEditingEmpleado(undefined); setShowEmpleadoModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Plus size={14} /> Nuevo empleado</button></div></div><div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"><table className="w-full text-sm"><thead><tr className="text-xs text-gray-500 bg-gray-50 border-b"><th className="text-left px-4 py-2">Nombre</th><th className="text-left px-4 py-2">Cédula</th><th className="text-left px-4 py-2">Cargo</th><th className="text-right px-4 py-2">Sueldo Base</th><th className="text-center px-4 py-2">IESS</th><th className="text-center px-4 py-2">Estado</th><th className="px-4 py-2"></th></tr></thead><tbody>{empleados.map(e => <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-800">{e.apellidos}, {e.nombres}</td><td className="px-4 py-3 font-mono text-xs text-gray-500">{e.cedula}</td><td className="px-4 py-3 text-gray-600">{e.cargo}</td><td className="px-4 py-3 text-right font-mono">{fmt(e.sueldo_base)}</td><td className="px-4 py-3 text-center">{e.afiliado_iess ? <CheckCircle2 size={15} className="text-green-500 mx-auto" /> : <span className="text-gray-300">No</span>}</td><td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{e.estado}</span></td><td className="px-4 py-3 text-right"><button onClick={() => { setEditingEmpleado(e); setShowEmpleadoModal(true); }} className="text-xs text-indigo-600 hover:text-indigo-800">Editar</button></td></tr>)}{empleados.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No hay empleados registrados.</td></tr>}</tbody></table></div></div>}
    {tab === 'rubros' && <RubrosPanel rubros={rubros} onReload={loadRubros} />}
    {tab === 'conceptos' && <ConceptosPanel empleados={empleados} rubros={rubros} conceptos={conceptos} onReload={loadConceptos} />}
    {tab === 'parametros' && <ParametrosPanel parametros={parametros} onReload={loadParametros} />}

    {showEmpleadoModal && <EmpleadoModal empleado={editingEmpleado} onClose={() => setShowEmpleadoModal(false)} onSaved={() => { setShowEmpleadoModal(false); loadEmpleados(); }} />}
    {showRolModal && <RolModal empleados={empleados} rubros={rubros} rol={editingRol} anio={parseInt(filAnio)} mes={parseInt(filMes)} onClose={() => setShowRolModal(false)} onSaved={() => { setShowRolModal(false); loadRoles(); }} />}
    {payingRol && <PagarRolModal rol={payingRol} cuentas={cuentas} onClose={() => setPayingRol(null)} onSaved={() => { setPayingRol(null); loadRoles(); loadCuentas(); }} />}
  </div>;
}
