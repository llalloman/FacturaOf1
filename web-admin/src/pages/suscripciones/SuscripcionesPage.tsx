import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suscripcionesService } from '../../services/suscripcionesService';
import type { PlanSuscripcion, Suscripcion } from '../../types';
import {
  CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  Zap, Users, FileText, Building2, Shield, BarChart2, RefreshCw,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const estadoBadge = (estado: Suscripcion['estado']) => {
  const map: Record<string, string> = {
    ACTIVA:     'bg-green-100 text-green-700',
    PRUEBA:     'bg-blue-100 text-blue-700',
    VENCIDA:    'bg-red-100 text-red-700',
    SUSPENDIDA: 'bg-yellow-100 text-yellow-700',
    CANCELADA:  'bg-gray-100 text-gray-600',
  };
  return map[estado] ?? 'bg-gray-100 text-gray-600';
};

const estadoIcono = (estado: Suscripcion['estado']) => {
  switch (estado) {
    case 'ACTIVA':  return <CheckCircle size={14} />;
    case 'PRUEBA':  return <Clock size={14} />;
    case 'VENCIDA': return <XCircle size={14} />;
    default:        return <AlertTriangle size={14} />;
  }
};

const periodoLabel: Record<string, string> = {
  MENSUAL: 'mes', TRIMESTRAL: '3 meses', SEMESTRAL: '6 meses', ANUAL: 'año',
};

const tipoColor: Record<string, string> = {
  BASICO:       'from-gray-400 to-gray-600',
  PROFESIONAL:  'from-blue-500 to-blue-600',
  EMPRESARIAL:  'from-sky-500 to-sky-600',
  ILIMITADO:    'from-amber-400 to-orange-500',
};

// ─── Tarjeta de estado actual ─────────────────────────────────────────────────
function TarjetaEstado({ suscripcion }: { suscripcion: Suscripcion }) {
  const queryClient = useQueryClient();
  const { plan_detalle: plan } = suscripcion;

  const renovarMutation = useMutation({
    mutationFn: () => suscripcionesService.renovar(suscripcion.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suscripcion-activa'] }),
    onError: () => alert('Error al renovar la suscripción'),
  });

  const diasTotales = plan.periodo === 'MENSUAL' ? 30
    : plan.periodo === 'TRIMESTRAL' ? 90
    : plan.periodo === 'SEMESTRAL' ? 180 : 365;

  const progreso = Math.max(0, Math.min(100, (suscripcion.dias_restantes / diasTotales) * 100));

  const facturasUsadas = suscripcion.facturas_emitidas_mes_actual;
  const facturasLimite = plan.facturas_mensuales;
  const facturasPct = facturasLimite > 0
    ? Math.min(100, (facturasUsadas / facturasLimite) * 100)
    : 0;

  const porVencer = suscripcion.dias_restantes <= 7 && suscripcion.estado === 'ACTIVA';

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header degradado */}
      <div className={`bg-gradient-to-r ${tipoColor[plan.tipo] ?? 'from-blue-500 to-blue-600'} p-6 text-white`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Plan actual</p>
            <h2 className="text-3xl font-bold mt-1">{plan.nombre}</h2>
            <p className="text-white/80 text-sm mt-1">{plan.periodo} · ${Number(plan.precio).toFixed(2)} / {periodoLabel[plan.periodo]}</p>
          </div>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 ${estadoBadge(suscripcion.estado).replace('bg-', 'border border-').replace('text-', 'text-white ')}`}>
            {estadoIcono(suscripcion.estado)}
            {suscripcion.estado}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Días restantes */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Vigencia</span>
            <span className={`font-semibold ${porVencer ? 'text-red-600' : 'text-gray-800'}`}>
              {suscripcion.dias_restantes} días restantes
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${porVencer ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${progreso}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{new Date(suscripcion.fecha_inicio).toLocaleDateString('es-EC')}</span>
            <span>{new Date(suscripcion.fecha_fin).toLocaleDateString('es-EC')}</span>
          </div>
        </div>

        {/* Facturas del mes */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Facturas este mes</span>
            <span className="font-semibold text-gray-800">
              {facturasUsadas} / {facturasLimite === 0 ? '∞' : facturasLimite}
            </span>
          </div>
          {facturasLimite > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${facturasPct >= 90 ? 'bg-red-500' : facturasPct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${facturasPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Info adicional */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-500 text-xs">Próximo pago</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {suscripcion.fecha_proximo_pago
                ? new Date(suscripcion.fecha_proximo_pago).toLocaleDateString('es-EC')
                : '—'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-500 text-xs">Auto-renovar</p>
            <p className={`font-semibold mt-0.5 ${suscripcion.auto_renovar ? 'text-green-600' : 'text-gray-500'}`}>
              {suscripcion.auto_renovar ? 'Activado' : 'Desactivado'}
            </p>
          </div>
        </div>

        {/* Alerta por vencer */}
        {porVencer && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <div>
              <p className="text-red-700 font-semibold text-sm">Suscripción por vencer</p>
              <p className="text-red-600 text-xs mt-0.5">Renueva ahora para no interrumpir el servicio.</p>
            </div>
          </div>
        )}

        {(suscripcion.estado === 'VENCIDA' || porVencer) && (
          <button
            onClick={() => { if (window.confirm('¿Renovar suscripción por otro periodo?')) renovarMutation.mutate(); }}
            disabled={renovarMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            {renovarMutation.isPending ? 'Renovando...' : 'Renovar Suscripción'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Card de plan ─────────────────────────────────────────────────────────────
function PlanCard({ plan, esPlanActual }: { plan: PlanSuscripcion; esPlanActual: boolean }) {
  const features = [
    { icon: FileText,  label: `${plan.facturas_mensuales === 0 ? 'Facturas ilimitadas' : `${plan.facturas_mensuales} facturas / mes`}`, ok: true },
    { icon: Users,     label: `${plan.usuarios_permitidos === 0 ? 'Usuarios ilimitados' : `${plan.usuarios_permitidos} usuarios`}`, ok: true },
    { icon: Building2, label: `${plan.empresas_permitidas} empresa${plan.empresas_permitidas > 1 ? 's' : ''}`, ok: true },
    { icon: Shield,    label: 'Soporte prioritario', ok: plan.soporte_prioritario },
    { icon: Zap,       label: 'Acceso API', ok: plan.api_access },
    { icon: BarChart2, label: 'Reportes avanzados', ok: plan.reportes_avanzados },
  ];

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${esPlanActual ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-gray-100 shadow-sm hover:border-gray-300'}`}>
      {esPlanActual && (
        <div className="bg-blue-500 text-white text-center text-xs font-bold py-1.5 rounded-t-xl tracking-wider">
          PLAN ACTUAL
        </div>
      )}
      <div className={`bg-gradient-to-r ${tipoColor[plan.tipo] ?? 'from-blue-500 to-blue-600'} ${esPlanActual ? 'rounded-t-none' : 'rounded-t-xl'} p-5 text-white`}>
        <h3 className="text-xl font-bold">{plan.nombre}</h3>
        <p className="text-white/70 text-xs uppercase tracking-wider mt-0.5">{plan.tipo}</p>
        <div className="mt-3">
          <span className="text-4xl font-extrabold">${Number(plan.precio).toFixed(0)}</span>
          <span className="text-white/70 text-sm"> / {periodoLabel[plan.periodo]}</span>
        </div>
      </div>
      <div className="p-5 space-y-2.5">
        {features.map(({ icon: Icon, label, ok }) => (
          <div key={label} className={`flex items-center gap-2.5 text-sm ${ok ? 'text-gray-700' : 'text-gray-300'}`}>
            <Icon size={15} className={ok ? 'text-green-500' : 'text-gray-300'} />
            <span className={ok ? '' : 'line-through'}>{label}</span>
            {ok && <CheckCircle size={13} className="ml-auto text-green-400 shrink-0" />}
          </div>
        ))}
        {plan.descripcion && (
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">{plan.descripcion}</p>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SuscripcionesPage() {
  const { data: suscripcion, isLoading: loadingSus, error: errorSus } = useQuery({
    queryKey: ['suscripcion-activa'],
    queryFn: suscripcionesService.getSuscripcionActiva,
    retry: false,
  });

  const { data: planes = [], isLoading: loadingPlanes } = useQuery({
    queryKey: ['planes-suscripcion'],
    queryFn: suscripcionesService.getPlanes,
  });

  const planesArray: PlanSuscripcion[] = Array.isArray(planes) ? planes : [];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
          Suscripción
        </h1>
        <p className="text-gray-600 mt-1">Gestiona tu plan y visualiza el uso de tu cuenta</p>
      </div>

      {/* Estado actual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {loadingSus ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : errorSus || !suscripcion ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700">Sin suscripción activa</p>
              <p className="text-sm text-gray-500 mt-1">Contacta al administrador para activar un plan.</p>
            </div>
          ) : (
            <TarjetaEstado suscripcion={suscripcion} />
          )}
        </div>

        {/* KPIs rápidos del plan */}
        {suscripcion && (
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
            {[
              { label: 'Plan', value: suscripcion.plan_detalle.nombre, color: 'text-blue-600' },
              { label: 'Días restantes', value: `${suscripcion.dias_restantes}`, color: suscripcion.dias_restantes <= 7 ? 'text-red-600' : 'text-green-600' },
              { label: 'Estado', value: suscripcion.estado, color: 'text-gray-800' },
              { label: 'Facturas este mes', value: `${suscripcion.facturas_emitidas_mes_actual}`, color: 'text-blue-600' },
              { label: 'Límite facturas', value: suscripcion.plan_detalle.facturas_mensuales === 0 ? '∞' : `${suscripcion.plan_detalle.facturas_mensuales}`, color: 'text-gray-800' },
              { label: 'Usuarios permitidos', value: suscripcion.plan_detalle.usuarios_permitidos === 0 ? '∞' : `${suscripcion.plan_detalle.usuarios_permitidos}`, color: 'text-gray-800' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Planes disponibles */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Planes disponibles</h2>
        <p className="text-sm text-gray-500 mb-5">Compara las características de cada plan</p>

        {loadingPlanes ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : planesArray.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
            <p>No hay planes disponibles en este momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {planesArray.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                esPlanActual={suscripcion?.plan === plan.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
