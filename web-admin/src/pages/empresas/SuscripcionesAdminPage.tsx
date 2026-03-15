import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suscripcionesService, type ResumenEmpresaSuscripcion } from '../../services/suscripcionesService';
import type { PlanSuscripcion, Suscripcion } from '../../types';
import { confirmDialog } from '../../store/confirmStore';
import { toast } from '../../store/toastStore';
import {
  Building2, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  Play, Pause, RefreshCw, Plus, X, ChevronDown, ChevronUp, Trash2, Edit2,
  Package,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const estadoStyle: Record<string, string> = {
  ACTIVA:     'bg-green-100 text-green-700 border-green-200',
  PRUEBA:     'bg-blue-100 text-blue-700 border-blue-200',
  VENCIDA:    'bg-red-100 text-red-700 border-red-200',
  SUSPENDIDA: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CANCELADA:  'bg-gray-100 text-gray-500 border-gray-200',
};

const estadoIcono = (estado: string) => {
  switch (estado) {
    case 'ACTIVA':     return <CheckCircle size={13} />;
    case 'PRUEBA':     return <Clock size={13} />;
    case 'VENCIDA':    return <XCircle size={13} />;
    case 'SUSPENDIDA': return <AlertTriangle size={13} />;
    default:           return <XCircle size={13} />;
  }
};

// ─── Modal crear/editar suscripción ───────────────────────────────────────────
function ModalSuscripcion({
  suscripcion,
  planes,
  empresaId,
  onClose,
}: {
  suscripcion?: Suscripcion;
  planes: PlanSuscripcion[];
  empresaId?: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!suscripcion;

  const [form, setForm] = useState({
    empresa: empresaId ?? suscripcion?.empresa ?? '',
    plan: suscripcion?.plan ?? planes[0]?.id ?? '',
    fecha_inicio: suscripcion?.fecha_inicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    fecha_fin: suscripcion?.fecha_fin?.slice(0, 10) ?? '',
    estado: suscripcion?.estado ?? 'PRUEBA',
    auto_renovar: suscripcion?.auto_renovar ?? false,
    notas: suscripcion?.notas ?? '',
  });

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? suscripcionesService.updateSuscripcion(suscripcion!.id, {
          plan: Number(form.plan),
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          estado: form.estado as Suscripcion['estado'],
          auto_renovar: form.auto_renovar,
          notas: form.notas,
        })
      : suscripcionesService.createSuscripcion({
          empresa: Number(form.empresa),
          plan: Number(form.plan),
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          fecha_proximo_pago: form.fecha_fin,
          estado: form.estado as Suscripcion['estado'],
          auto_renovar: form.auto_renovar,
          notas: form.notas,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suscripciones-admin'] });
      toast.success(isEdit ? 'Suscripción actualizada' : 'Suscripción creada');
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: Record<string, unknown> } };
      toast.error(JSON.stringify(err.response?.data ?? 'Error'));
    },
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? 'Editar suscripción' : 'Nueva suscripción'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Plan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select value={form.plan} onChange={e => set('plan', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['PRUEBA','ACTIVA','SUSPENDIDA','VENCIDA','CANCELADA'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          {/* Auto renovar */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.auto_renovar} onChange={e => set('auto_renovar', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            Auto-renovar
          </label>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.plan || !form.fecha_fin}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear suscripción'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal crear trial ────────────────────────────────────────────────────────
function ModalCrearTrial({
  empresa,
  planes,
  onClose,
}: {
  empresa: ResumenEmpresaSuscripcion;
  planes: PlanSuscripcion[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [planId, setPlanId] = useState<string>(planes[0]?.id?.toString() ?? '');
  const [dias, setDias] = useState('30');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => suscripcionesService.crearTrial(empresa.empresa_id, Number(planId), Number(dias)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suscripciones-admin'] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? 'Error al crear el período de prueba');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="text-lg font-bold text-gray-900">Crear período de prueba</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            <strong>{empresa.empresa_nombre}</strong><br />
            <span className="text-xs text-blue-600">{empresa.empresa_ruc}</span>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select value={planId} onChange={e => setPlanId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio).toFixed(2)}/{p.periodo.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Días de prueba</label>
            <input type="number" min={1} max={365} value={dias} onChange={e => setDias(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !planId}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
            {mutation.isPending ? 'Creando...' : `Crear ${dias} días de prueba`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal CRUD Plan ──────────────────────────────────────────────────────────
function ModalPlan({ plan, onClose }: { plan?: PlanSuscripcion; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!plan;
  const [form, setForm] = useState({
    nombre: plan?.nombre ?? '',
    codigo: plan?.codigo ?? '',
    tipo: plan?.tipo ?? 'BASICO',
    periodo: plan?.periodo ?? 'MENSUAL',
    precio: plan?.precio?.toString() ?? '0',
    facturas_mensuales: plan?.facturas_mensuales?.toString() ?? '50',
    usuarios_permitidos: plan?.usuarios_permitidos?.toString() ?? '3',
    soporte_prioritario: plan?.soporte_prioritario ?? false,
    api_access: plan?.api_access ?? false,
    reportes_avanzados: plan?.reportes_avanzados ?? false,
    activo: plan?.activo ?? true,
    descripcion: plan?.descripcion ?? '',
  });

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? suscripcionesService.updatePlan(plan!.id, { ...form, precio: Number(form.precio), facturas_mensuales: Number(form.facturas_mensuales), usuarios_permitidos: Number(form.usuarios_permitidos) })
      : suscripcionesService.createPlan({ ...form, precio: Number(form.precio), facturas_mensuales: Number(form.facturas_mensuales), usuarios_permitidos: Number(form.usuarios_permitidos) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planes-admin'] });
      qc.invalidateQueries({ queryKey: ['planes-suscripcion'] });
      toast.success(isEdit ? 'Plan actualizado' : 'Plan creado');
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: Record<string, unknown> } };
      toast.error(JSON.stringify(err.response?.data ?? 'Error'));
    },
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? 'Editar plan' : 'Nuevo plan'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['FREE','BASICO','PROFESIONAL','EMPRESARIAL','ILIMITADO'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <select value={form.periodo} onChange={e => set('periodo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['MENSUAL','TRIMESTRAL','SEMESTRAL','ANUAL'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio $</label>
              <input type="number" min={0} step={0.01} value={form.precio} onChange={e => set('precio', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facturas por período</label>
              <input type="number" min={0} value={form.facturas_mensuales} onChange={e => set('facturas_mensuales', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-0.5">0 = ilimitado (total del período)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuarios</label>
              <input type="number" min={0} value={form.usuarios_permitidos} onChange={e => set('usuarios_permitidos', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-0.5">0 = ilimitado</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {([
              { k: 'soporte_prioritario', label: 'Soporte prioritario' },
              { k: 'api_access', label: 'Acceso API' },
              { k: 'reportes_avanzados', label: 'Reportes avanzados' },
              { k: 'activo', label: 'Plan activo' },
            ] as { k: keyof typeof form; label: string }[]).map(({ k, label }) => (
              <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form[k] as boolean} onChange={e => set(k, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                {label}
              </label>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.nombre || !form.codigo}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pestaña Planes ───────────────────────────────────────────────────────────
function TabPlanes() {
  const qc = useQueryClient();
  const [modalPlan, setModalPlan] = useState<PlanSuscripcion | null | 'new'>(null);

  const { data: planes = [], isLoading } = useQuery({
    queryKey: ['planes-admin'],
    queryFn: suscripcionesService.getTodosPlanes,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => suscripcionesService.deletePlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planes-admin'] });
      qc.invalidateQueries({ queryKey: ['planes-suscripcion'] });
      toast.success('Plan eliminado');
    },
    onError: () => toast.error('No se puede eliminar un plan con suscripciones activas'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{planes.length} planes configurados</p>
        <button onClick={() => setModalPlan('new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> Nuevo plan
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {planes.map(plan => (
            <div key={plan.id} className={`bg-white rounded-xl border-2 p-5 space-y-3 ${plan.activo ? 'border-blue-100' : 'border-gray-100 opacity-60'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900">{plan.nombre}</h3>
                  <span className="text-xs font-mono text-gray-400">{plan.codigo}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModalPlan(plan)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={async () => {
                    if (await confirmDialog(`¿Eliminar el plan "${plan.nombre}"?`, undefined, 'danger'))
                      deleteMut.mutate(plan.id);
                  }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-gray-900">${Number(plan.precio).toFixed(2)}</span>
                <span className="text-sm text-gray-400 mb-0.5">/{plan.periodo.toLowerCase()}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <span className="bg-gray-50 rounded-lg px-2 py-1">
                  📄 {plan.facturas_mensuales === 0 ? 'Ilimitadas' : `${plan.facturas_mensuales}/período`}
                </span>
                <span className="bg-gray-50 rounded-lg px-2 py-1">
                  👤 {plan.usuarios_permitidos === 0 ? 'Ilimitados' : `${plan.usuarios_permitidos} usuarios`}
                </span>
                {plan.api_access && <span className="bg-purple-50 text-purple-700 rounded-lg px-2 py-1">🔌 API Access</span>}
                {plan.soporte_prioritario && <span className="bg-orange-50 text-orange-700 rounded-lg px-2 py-1">⭐ Soporte +</span>}
                {plan.reportes_avanzados && <span className="bg-green-50 text-green-700 rounded-lg px-2 py-1">📊 Reportes</span>}
              </div>
              {!plan.activo && <span className="text-xs text-red-400 font-medium">⚠ Inactivo</span>}
            </div>
          ))}
        </div>
      )}

      {modalPlan === 'new' && <ModalPlan onClose={() => setModalPlan(null)} />}
      {modalPlan && modalPlan !== 'new' && <ModalPlan plan={modalPlan as PlanSuscripcion} onClose={() => setModalPlan(null)} />}
    </div>
  );
}

// ─── Fila empresa ─────────────────────────────────────────────────────────────
function FilaEmpresa({
  item,
  planes,
  onCrearTrial,
}: {
  item: ResumenEmpresaSuscripcion;
  planes: PlanSuscripcion[];
  onCrearTrial: (item: ResumenEmpresaSuscripcion) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const sus: Suscripcion | null = item.suscripcion;

  const diasRestantes = sus?.dias_restantes ?? 0;
  const porVencer = sus && sus.estado !== 'CANCELADA' && diasRestantes <= 7 && diasRestantes > 0;

  const activarMutation   = useMutation({ mutationFn: () => suscripcionesService.activar(sus!.id),   onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }) });
  const suspenderMutation = useMutation({ mutationFn: () => suscripcionesService.suspender(sus!.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }) });
  const renovarMutation   = useMutation({ mutationFn: () => suscripcionesService.renovar(sus!.id),   onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }) });
  const deleteMutation    = useMutation({
    mutationFn: () => suscripcionesService.deleteSuscripcion(sus!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }); toast.success('Suscripción eliminada'); },
  });

  const isPending = activarMutation.isPending || suspenderMutation.isPending || renovarMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <tr className={`border-b transition-colors ${expanded ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 text-left group">
            {expanded ? <ChevronUp size={14} className="text-blue-500 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{item.empresa_nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{item.empresa_ruc}</p>
            </div>
          </button>
        </td>
        <td className="px-4 py-3 text-center">
          {item.empresa_activa
            ? <span className="flex items-center justify-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Activa</span>
            : <span className="flex items-center justify-center gap-1 text-gray-400 text-sm"><XCircle size={14} /> Inactiva</span>}
        </td>
        <td className="px-4 py-3">
          {sus ? (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${estadoStyle[sus.estado] ?? estadoStyle.CANCELADA}`}>
                {estadoIcono(sus.estado)}{sus.estado}
              </span>
              {porVencer && <span className="text-xs text-orange-600 font-medium">⚠ {diasRestantes}d</span>}
            </div>
          ) : <span className="text-xs text-gray-400 italic">Sin suscripción</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{sus ? sus.plan_detalle.nombre : '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {sus ? (
            <div>
              <p className={diasRestantes <= 7 && sus.estado !== 'VENCIDA' && sus.estado !== 'CANCELADA' ? 'text-orange-600 font-semibold' : ''}>
                {new Date(sus.fecha_fin).toLocaleDateString('es-EC')}
              </p>
              {(sus.estado === 'ACTIVA' || sus.estado === 'PRUEBA') && (
                <p className="text-xs text-gray-400">{diasRestantes} días restantes</p>
              )}
            </div>
          ) : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end">
            {(!sus || sus.estado === 'CANCELADA' || sus.estado === 'VENCIDA') && (
              <button onClick={() => onCrearTrial(item)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Plus size={13} /> Trial
              </button>
            )}
            {sus && sus.estado === 'PRUEBA' && (
              <button onClick={async () => { if (await confirmDialog('¿Activar suscripción completa?')) activarMutation.mutate(); }}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50">
                <Play size={13} /> Activar
              </button>
            )}
            {sus && (sus.estado === 'ACTIVA' || sus.estado === 'PRUEBA') && (
              <button onClick={async () => { if (await confirmDialog('¿Suspender el acceso a esta empresa?', undefined, 'warning')) suspenderMutation.mutate(); }}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50">
                <Pause size={13} /> Suspender
              </button>
            )}
            {sus && (sus.estado === 'VENCIDA' || sus.estado === 'SUSPENDIDA') && (
              <button onClick={async () => { if (await confirmDialog('¿Renovar suscripción?')) renovarMutation.mutate(); }}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw size={13} /> Renovar
              </button>
            )}
            {sus && (
              <button onClick={() => setEditModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                <Edit2 size={13} /> Editar
              </button>
            )}
            {sus && (
              <button onClick={async () => { if (await confirmDialog('¿Eliminar esta suscripción?', undefined, 'danger')) deleteMutation.mutate(); }}
                disabled={isPending}
                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && sus && (
        <tr className="bg-blue-50/30 border-b">
          <td colSpan={6} className="px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Docs emitidos / período', value: `${sus.facturas_emitidas_mes_actual} / ${sus.plan_detalle.facturas_mensuales === 0 ? '∞' : sus.plan_detalle.facturas_mensuales}` },
                { label: 'Período', value: sus.plan_detalle.periodo },
                { label: 'Precio plan', value: `$${Number(sus.plan_detalle.precio).toFixed(2)}` },
                { label: 'Auto-renovar', value: sus.auto_renovar ? 'Sí' : 'No' },
                { label: 'Inicio', value: new Date(sus.fecha_inicio).toLocaleDateString('es-EC') },
                { label: 'Fin', value: new Date(sus.fecha_fin).toLocaleDateString('es-EC') },
                { label: 'Usuarios permitidos', value: sus.plan_detalle.usuarios_permitidos === 0 ? '∞' : `${sus.plan_detalle.usuarios_permitidos}` },
                { label: 'API Access', value: sus.plan_detalle.api_access ? 'Sí' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-lg p-2.5 border border-blue-100">
                  <p className="text-gray-400 uppercase tracking-wider" style={{ fontSize: '10px' }}>{label}</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{value}</p>
                </div>
              ))}
              {sus.notas && (
                <div className="col-span-4 bg-yellow-50 rounded-lg p-2.5 border border-yellow-100">
                  <p className="text-gray-400 uppercase tracking-wider" style={{ fontSize: '10px' }}>Notas</p>
                  <p className="text-gray-700 mt-0.5 text-sm">{sus.notas}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {editModal && sus && (
        <ModalSuscripcion
          suscripcion={sus}
          planes={planes}
          onClose={() => setEditModal(false)}
        />
      )}
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SuscripcionesAdminPage() {
  const [tab, setTab] = useState<'suscripciones' | 'planes'>('suscripciones');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [modalTrial, setModalTrial] = useState<ResumenEmpresaSuscripcion | null>(null);
  const [modalNueva, setModalNueva] = useState(false);

  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['suscripciones-admin'],
    queryFn: suscripcionesService.getResumenAdmin,
    refetchInterval: 30_000,
  });

  const { data: planes = [] } = useQuery({
    queryKey: ['planes-suscripcion'],
    queryFn: suscripcionesService.getPlanes,
  });

  const planesArray: PlanSuscripcion[] = Array.isArray(planes) ? planes : [];

  const total     = resumen.length;
  const activas   = resumen.filter(r => r.suscripcion?.estado === 'ACTIVA').length;
  const prueba    = resumen.filter(r => r.suscripcion?.estado === 'PRUEBA').length;
  const vencidas  = resumen.filter(r => r.suscripcion?.estado === 'VENCIDA').length;
  const sinSus    = resumen.filter(r => !r.suscripcion || r.suscripcion.estado === 'CANCELADA').length;
  const porVencer = resumen.filter(r => r.suscripcion && r.suscripcion.dias_restantes <= 7 && r.suscripcion.dias_restantes > 0 && ['ACTIVA','PRUEBA'].includes(r.suscripcion.estado)).length;

  const filtered = resumen.filter(r => {
    const matchSearch = r.empresa_nombre.toLowerCase().includes(search.toLowerCase()) || r.empresa_ruc.includes(search);
    const estado = r.suscripcion?.estado ?? 'SIN';
    const matchEstado =
      filtroEstado === 'TODOS' ? true :
      filtroEstado === 'SIN' ? !r.suscripcion || r.suscripcion.estado === 'CANCELADA' :
      filtroEstado === 'POR_VENCER' ? (r.suscripcion?.dias_restantes ?? 0) <= 7 && (r.suscripcion?.dias_restantes ?? 0) > 0 :
      estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Suscripciones</h1>
            <p className="text-sm text-gray-500">Control de acceso y planes por empresa</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'suscripciones', label: 'Suscripciones', icon: <Building2 size={15} /> },
          { key: 'planes',        label: 'Planes',         icon: <Package size={15} /> },
        ].map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key as 'suscripciones' | 'planes')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'planes' && <TabPlanes />}

      {tab === 'suscripciones' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total empresas',  value: total,     color: 'text-gray-800',   bg: 'bg-white',       badge: '' },
              { label: 'Activas',         value: activas,   color: 'text-green-600',  bg: 'bg-white',       badge: 'border-l-4 border-green-500' },
              { label: 'En prueba',       value: prueba,    color: 'text-blue-600',   bg: 'bg-white',       badge: 'border-l-4 border-blue-500' },
              { label: 'Vencidas',        value: vencidas,  color: 'text-red-600',    bg: 'bg-white',       badge: 'border-l-4 border-red-500' },
              { label: 'Por vencer (≤7d)',value: porVencer, color: 'text-orange-600', bg: 'bg-orange-50',   badge: 'border-l-4 border-orange-400' },
              { label: 'Sin suscripción', value: sinSus,    color: 'text-gray-500',   bg: 'bg-white',       badge: 'border-l-4 border-gray-300' },
            ].map(({ label, value, color, bg, badge }) => (
              <div key={label} className={`${bg} ${badge} rounded-xl shadow-sm p-4`}>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar empresa o RUC..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {[
                  { key: 'TODOS', label: 'Todos' },
                  { key: 'ACTIVA', label: 'Activos' },
                  { key: 'PRUEBA', label: 'En prueba' },
                  { key: 'VENCIDA', label: 'Vencidos' },
                  { key: 'SUSPENDIDA', label: 'Suspendidos' },
                  { key: 'POR_VENCER', label: '⚠ Por vencer' },
                  { key: 'SIN', label: 'Sin sus.' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setFiltroEstado(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstado === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setModalNueva(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              <Plus size={16} /> Nueva suscripción
            </button>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3" />
                <span className="text-gray-500">Cargando empresas...</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Empresa</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Suscripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Vencimiento</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-gray-400">
                        <Building2 size={40} className="mx-auto mb-2 opacity-20" />
                        No hay empresas con ese filtro
                      </td>
                    </tr>
                  ) : (
                    filtered.map(item => (
                      <FilaEmpresa key={item.empresa_id} item={item} planes={planesArray} onCrearTrial={setModalTrial} />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {modalTrial && (
        <ModalCrearTrial empresa={modalTrial} planes={planesArray} onClose={() => setModalTrial(null)} />
      )}
      {modalNueva && (
        <ModalSuscripcion planes={planesArray} onClose={() => setModalNueva(false)} />
      )}
    </div>
  );
}
