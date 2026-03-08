import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suscripcionesService, type ResumenEmpresaSuscripcion } from '../../services/suscripcionesService';
import type { PlanSuscripcion, Suscripcion } from '../../types';
import {
  Building2, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  Play, Pause, RefreshCw, Plus, X, ChevronDown, ChevronUp,
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
    mutationFn: () =>
      suscripcionesService.crearTrial(empresa.empresa_id, Number(planId), Number(dias)),
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
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {planes.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio).toFixed(2)}/{p.periodo.toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Días de prueba</label>
            <input
              type="number"
              min={1}
              max={365}
              value={dias}
              onChange={e => setDias(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !planId}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Creando...' : `Crear ${dias} días de prueba`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de empresa ──────────────────────────────────────────────────────────
function FilaEmpresa({
  item,
  onCrearTrial,
}: {
  item: ResumenEmpresaSuscripcion;
  onCrearTrial: (item: ResumenEmpresaSuscripcion) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const sus: Suscripcion | null = item.suscripcion;

  const diasRestantes = sus?.dias_restantes ?? 0;
  const porVencer = sus && sus.estado !== 'CANCELADA' && diasRestantes <= 7 && diasRestantes > 0;

  const activarMutation = useMutation({
    mutationFn: () => suscripcionesService.activar(sus!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }),
  });
  const suspenderMutation = useMutation({
    mutationFn: () => suscripcionesService.suspender(sus!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }),
  });
  const renovarMutation = useMutation({
    mutationFn: () => suscripcionesService.renovar(sus!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones-admin'] }),
  });

  const isPending = activarMutation.isPending || suspenderMutation.isPending || renovarMutation.isPending;

  return (
    <>
      <tr className={`border-b transition-colors ${expanded ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
        {/* Empresa */}
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 text-left group">
            {expanded ? <ChevronUp size={14} className="text-blue-500 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{item.empresa_nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{item.empresa_ruc}</p>
            </div>
          </button>
        </td>

        {/* Estado empresa */}
        <td className="px-4 py-3 text-center">
          {item.empresa_activa ? (
            <span className="flex items-center justify-center gap-1 text-green-600 text-sm">
              <CheckCircle size={14} /> Activa
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1 text-gray-400 text-sm">
              <XCircle size={14} /> Inactiva
            </span>
          )}
        </td>

        {/* Suscripción */}
        <td className="px-4 py-3">
          {sus ? (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${estadoStyle[sus.estado] ?? estadoStyle.CANCELADA}`}>
                {estadoIcono(sus.estado)}
                {sus.estado}
              </span>
              {porVencer && (
                <span className="text-xs text-orange-600 font-medium">⚠ {diasRestantes}d</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">Sin suscripción</span>
          )}
        </td>

        {/* Plan */}
        <td className="px-4 py-3 text-sm text-gray-700">
          {sus ? sus.plan_detalle.nombre : '—'}
        </td>

        {/* Vencimiento */}
        <td className="px-4 py-3 text-sm text-gray-600">
          {sus ? (
            <div>
              <p className={diasRestantes <= 7 && sus.estado !== 'VENCIDA' && sus.estado !== 'CANCELADA' ? 'text-orange-600 font-semibold' : ''}>
                {new Date(sus.fecha_fin).toLocaleDateString('es-EC')}
              </p>
              {sus.estado === 'ACTIVA' || sus.estado === 'PRUEBA' ? (
                <p className="text-xs text-gray-400">{diasRestantes} días restantes</p>
              ) : null}
            </div>
          ) : '—'}
        </td>

        {/* Acciones */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end">
            {/* Sin suscripción o cancelada: crear trial */}
            {(!sus || sus.estado === 'CANCELADA' || sus.estado === 'VENCIDA') && (
              <button
                onClick={() => onCrearTrial(item)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Crear período de prueba"
              >
                <Plus size={13} /> Trial
              </button>
            )}
            {/* PRUEBA: activar */}
            {sus && sus.estado === 'PRUEBA' && (
              <button
                onClick={() => { if (window.confirm('¿Activar suscripción completa?')) activarMutation.mutate(); }}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                title="Activar"
              >
                <Play size={13} /> Activar
              </button>
            )}
            {/* ACTIVA/PRUEBA: suspender */}
            {sus && (sus.estado === 'ACTIVA' || sus.estado === 'PRUEBA') && (
              <button
                onClick={() => { if (window.confirm('¿Suspender el acceso a esta empresa?')) suspenderMutation.mutate(); }}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
                title="Suspender"
              >
                <Pause size={13} /> Suspender
              </button>
            )}
            {/* VENCIDA/SUSPENDIDA: renovar */}
            {sus && (sus.estado === 'VENCIDA' || sus.estado === 'SUSPENDIDA') && (
              <button
                onClick={() => { if (window.confirm('¿Renovar suscripción por otro periodo?')) renovarMutation.mutate(); }}
                disabled={isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                title="Renovar"
              >
                <RefreshCw size={13} /> Renovar
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Fila expandida con detalle */}
      {expanded && sus && (
        <tr className="bg-blue-50/30 border-b">
          <td colSpan={6} className="px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Facturas emitidas / mes', value: `${sus.facturas_emitidas_mes_actual} / ${sus.plan_detalle.facturas_mensuales === 0 ? '∞' : sus.plan_detalle.facturas_mensuales}` },
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
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SuscripcionesAdminPage() {
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [modalTrial, setModalTrial] = useState<ResumenEmpresaSuscripcion | null>(null);

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

  // KPIs
  const total      = resumen.length;
  const activas    = resumen.filter(r => r.suscripcion?.estado === 'ACTIVA').length;
  const prueba     = resumen.filter(r => r.suscripcion?.estado === 'PRUEBA').length;
  const vencidas   = resumen.filter(r => r.suscripcion?.estado === 'VENCIDA').length;
  const sinSus     = resumen.filter(r => !r.suscripcion || r.suscripcion.estado === 'CANCELADA').length;
  const porVencer  = resumen.filter(r => r.suscripcion && r.suscripcion.dias_restantes <= 7 && r.suscripcion.dias_restantes > 0 && ['ACTIVA','PRUEBA'].includes(r.suscripcion.estado)).length;

  // Filtros
  const filtered = resumen.filter(r => {
    const matchSearch =
      r.empresa_nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.empresa_ruc.includes(search);

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
      <div className="flex items-center gap-3">
        <CreditCard size={28} className="text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Suscripciones</h1>
          <p className="text-sm text-gray-500">Control de acceso y períodos de prueba por empresa</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total empresas', value: total, color: 'text-gray-800', bg: 'bg-white', badge: '' },
          { label: 'Activas', value: activas, color: 'text-green-600', bg: 'bg-white', badge: 'border-l-4 border-green-500' },
          { label: 'En prueba', value: prueba, color: 'text-blue-600', bg: 'bg-white', badge: 'border-l-4 border-blue-500' },
          { label: 'Vencidas', value: vencidas, color: 'text-red-600', bg: 'bg-white', badge: 'border-l-4 border-red-500' },
          { label: 'Por vencer (≤7d)', value: porVencer, color: 'text-orange-600', bg: 'bg-orange-50', badge: 'border-l-4 border-orange-400' },
          { label: 'Sin suscripción', value: sinSus, color: 'text-gray-500', bg: 'bg-white', badge: 'border-l-4 border-gray-300' },
        ].map(({ label, value, color, bg, badge }) => (
          <div key={label} className={`${bg} ${badge} rounded-xl shadow-sm p-4`}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empresa o RUC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500"
          />
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
            <button
              key={key}
              onClick={() => setFiltroEstado(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstado === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mr-3" />
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
                  <FilaEmpresa
                    key={item.empresa_id}
                    item={item}
                    onCrearTrial={setModalTrial}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear trial */}
      {modalTrial && (
        <ModalCrearTrial
          empresa={modalTrial}
          planes={planesArray}
          onClose={() => setModalTrial(null)}
        />
      )}
    </div>
  );
}
