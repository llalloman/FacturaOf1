import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suscripcionesService } from '../../services/suscripcionesService';
import type { PlanSuscripcion, Suscripcion } from '../../types';
import {
  CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  RefreshCw, Star, Sparkles,
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

const planConfig: Record<string, {
  tagline: string;
  featured: boolean;
  badgeClass: string;
  btnClass: string;
  descuentoAnual: number;
}> = {
  BASICO:      { tagline: 'Ideal para emprendedores',          featured: false, badgeClass: 'bg-slate-100 text-slate-600',   btnClass: 'bg-slate-800 hover:bg-slate-900 text-white',    descuentoAnual: 0.17 },
  PROFESIONAL: { tagline: 'El favorito de las PyMEs',          featured: true,  badgeClass: 'bg-blue-500/20 text-blue-200',  btnClass: 'bg-white hover:bg-blue-50 text-blue-700',       descuentoAnual: 0.20 },
  EMPRESARIAL: { tagline: 'Poder ilimitado, sin restricciones', featured: false, badgeClass: 'bg-indigo-100 text-indigo-700', btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',  descuentoAnual: 0.25 },
  ILIMITADO:   { tagline: 'Sin restricciones de ningún tipo',  featured: false, badgeClass: 'bg-amber-100 text-amber-700',   btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',    descuentoAnual: 0.25 },
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
function PlanCard({ plan, esPlanActual, anual }: { plan: PlanSuscripcion; esPlanActual: boolean; anual: boolean }) {
  const cfg = planConfig[plan.tipo] ?? planConfig.BASICO;
  const precioMensual = Number(plan.precio);
  const descPct = Math.round(cfg.descuentoAnual * 100);
  const precioAnualDescuento = precioMensual * 12 * (1 - cfg.descuentoAnual);
  const precioPrincipal = anual ? precioAnualDescuento : precioMensual;
  const periodoStr = anual ? 'año' : periodoLabel[plan.periodo];

  const features = [
    { label: plan.facturas_mensuales === 0 ? 'Facturas ilimitadas' : `${plan.facturas_mensuales} facturas / mes`, ok: true },
    { label: plan.usuarios_permitidos === 0 ? 'Usuarios ilimitados' : `${plan.usuarios_permitidos} usuarios`, ok: true },
    { label: `${plan.empresas_permitidas} empresa${plan.empresas_permitidas > 1 ? 's' : ''}`, ok: true },
    { label: 'Soporte prioritario', ok: plan.soporte_prioritario },
    { label: 'Acceso API', ok: plan.api_access },
    { label: 'Reportes avanzados', ok: plan.reportes_avanzados },
  ];

  if (cfg.featured) {
    return (
      <div className="relative bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-2xl p-8 text-white flex flex-col md:scale-[1.05] md:-my-4 z-10">
        {/* Badge Más Popular */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-900 text-xs font-black px-4 py-1.5 rounded-full shadow-lg">
            <Star size={11} fill="currentColor" /> Más Popular
          </span>
        </div>

        {esPlanActual && (
          <div className="absolute -top-4 right-4">
            <span className="inline-flex items-center gap-1 bg-green-400 text-green-900 text-xs font-black px-3 py-1.5 rounded-full shadow-md">✓ Actual</span>
          </div>
        )}

        <span className={`self-start text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-3 ${cfg.badgeClass}`}>{plan.tipo}</span>
        <h3 className="text-2xl font-black mb-1">{plan.nombre}</h3>
        <p className="text-blue-200/70 text-sm mb-4">{cfg.tagline}</p>

        <div className="mb-6">
          {anual && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-blue-300/60 line-through text-sm">${(precioMensual * 12).toFixed(2)}/año</span>
              <span className="bg-amber-400 text-amber-900 text-xs font-black px-2 py-0.5 rounded-full">-{descPct}%</span>
            </div>
          )}
          <div>
            <span className="text-5xl font-black">${precioPrincipal.toFixed(2)}</span>
            <span className="text-blue-200/70 text-sm ml-1">/ {periodoStr}</span>
          </div>
          {anual && <p className="text-blue-200/60 text-xs mt-1">≈ ${(precioAnualDescuento / 12).toFixed(2)} / mes</p>}
          <p className="text-blue-200/50 text-xs mt-0.5">Precio + IVA</p>
        </div>

        <ul className="space-y-3.5 flex-1 mb-8">
          {features.map(({ label, ok }) => (
            <li key={label} className={`flex items-center gap-3 text-sm ${ok ? 'text-white' : 'text-blue-300/40'}`}>
              {ok
                ? <CheckCircle size={16} className="text-green-300 shrink-0" />
                : <XCircle size={16} className="text-blue-300/30 shrink-0" />}
              <span className={ok ? '' : 'line-through'}>{label}</span>
            </li>
          ))}
        </ul>

        {esPlanActual
          ? <div className="w-full text-center py-3.5 rounded-2xl bg-white/20 border border-white/30 font-bold text-sm">✓ Tu plan actual</div>
          : <button className="w-full py-3.5 rounded-2xl bg-white hover:bg-blue-50 text-blue-700 font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-[.98]">
              Elegir {plan.nombre}
            </button>
        }
      </div>
    );
  }

  return (
    <div className={`relative bg-white rounded-3xl border-2 shadow-sm hover:shadow-xl transition-all flex flex-col ${
      esPlanActual ? 'border-blue-400' : 'border-gray-100 hover:border-gray-200'
    }`}>
      {esPlanActual && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-md">✓ Plan Actual</span>
        </div>
      )}

      <div className="p-8 flex flex-col flex-1">
        <span className={`self-start text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-3 ${cfg.badgeClass}`}>{plan.tipo}</span>
        <h3 className="text-2xl font-black text-gray-900 mb-1">{plan.nombre}</h3>
        <p className="text-gray-500 text-sm mb-4">{cfg.tagline}</p>

        <div className="mb-6">
          {anual && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-400 line-through text-sm">${(precioMensual * 12).toFixed(2)}/año</span>
              <span className="bg-amber-400 text-amber-900 text-xs font-black px-2 py-0.5 rounded-full">-{descPct}%</span>
            </div>
          )}
          <div>
            <span className="text-5xl font-black text-gray-900">${precioPrincipal.toFixed(2)}</span>
            <span className="text-gray-400 text-sm ml-1">/ {periodoStr}</span>
          </div>
          {anual && <p className="text-gray-400 text-xs mt-1">≈ ${(precioAnualDescuento / 12).toFixed(2)} / mes</p>}
          <p className="text-gray-400 text-xs mt-0.5">Precio + IVA</p>
        </div>

        <ul className="space-y-3.5 flex-1 mb-8">
          {features.map(({ label, ok }) => (
            <li key={label} className={`flex items-center gap-3 text-sm ${ok ? 'text-gray-700' : 'text-gray-300'}`}>
              {ok
                ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                : <XCircle size={16} className="text-gray-300 shrink-0" />}
              <span className={ok ? '' : 'line-through'}>{label}</span>
            </li>
          ))}
        </ul>

        {esPlanActual
          ? <div className="w-full text-center py-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 font-bold text-sm">✓ Tu plan actual</div>
          : <button className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[.98] ${cfg.btnClass}`}>
              Elegir {plan.nombre}
            </button>
        }
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
  const [anual, setAnual] = useState(false);

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
      <section className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 rounded-3xl p-8 border border-gray-100">
        {/* Hero header */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-black px-4 py-2 rounded-full mb-5">
            <Sparkles size={12} /> Planes y precios
          </span>
          <h2 className="text-4xl font-black text-gray-900 mb-3 leading-tight">
            Elige el plan ideal<br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">para tu negocio</span>
          </h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Facturación electrónica, inventario y POS en un solo lugar.
          </p>
        </div>

        {/* Toggle mensual / anual */}
        <div className="flex items-center justify-center gap-4 mb-14">
          <span className={`text-sm font-semibold ${!anual ? 'text-gray-900' : 'text-gray-400'}`}>Mensual</span>
          <button
            onClick={() => setAnual(!anual)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${anual ? 'bg-blue-600' : 'bg-gray-300'}`}
            aria-label="Cambiar periodo de facturación"
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${anual ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-semibold flex items-center gap-2 ${anual ? 'text-gray-900' : 'text-gray-400'}`}>
            Anual
            <span className={`text-xs font-black px-2.5 py-1 rounded-full transition-all duration-300 ${
              anual ? 'bg-green-500 text-white' : 'bg-amber-400 text-amber-900'
            }`}>
              {anual ? '✓ Ahorro activo' : 'Ahorra hasta 25%'}
            </span>
          </span>
        </div>

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center max-w-4xl mx-auto py-6">
            {planesArray.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                esPlanActual={suscripcion?.plan === plan.id}
                anual={anual}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-10">
          Precios + IVA · Sin contratos · Todos los planes incluyen facturación electrónica SRI · Soporte por email · Actualizaciones gratuitas
        </p>
      </section>
    </div>
  );
}
