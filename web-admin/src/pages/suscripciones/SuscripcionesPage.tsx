import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suscripcionesService } from '../../services/suscripcionesService';
import type { PlanSuscripcion, Suscripcion } from '../../types';
import {
  CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  RefreshCw, Star, Sparkles, ToggleLeft, ToggleRight,
  Zap, Shield, Building2, Gift, TrendingUp,
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import { confirmDialog } from '../../store/confirmStore';

// =============================================================================
// PLAN_UI_DATA — Fuente de verdad para contenido comercial y precios visuales.
// Actualiza este objeto para cambiar precios, textos y beneficios sin tocar
// la logica de la pagina.
// =============================================================================

export interface PlanFeature {
  label: string;
  included: boolean;
  highlight?: boolean;
}

/**
 * Estructura de datos recomendada para planes SaaS.
 * Desacoplada del backend para control total del contenido comercial.
 */
export interface PlanUIData {
  /** Texto corto debajo del nombre del plan */
  tagline: string;
  /** Descripcion breve del valor del plan */
  shortDescription: string;
  /** Precio mensual en USD. null = plan gratuito/trial */
  precioMensual: number | null;
  /** Precio anual en USD. null = plan gratuito/trial */
  precioAnual: number | null;
  moneda: 'USD';
  /** Si este plan debe destacarse visualmente */
  featured: boolean;
  /** Etiqueta del badge visible (ej: "Mas Popular") */
  badgeLabel?: string;
  /** Lista de beneficios del plan */
  features: PlanFeature[];
  /** Texto del boton CTA */
  ctaLabel: string;
  /** Gradiente CSS para la carta destacada */
  gradient: string;
  /** Clases Tailwind para el badge de tipo */
  badgeClass: string;
  /** Clases Tailwind para el boton CTA */
  btnClass: string;
  /** Documentos/facturas por mes (null = sin limite) */
  limiteDocumentos: number | null;
  /** Cantidad de usuarios (null = sin limite) */
  limiteUsuarios: number | null;
  /** Cantidad de empresas (0 = sin limite) */
  limiteEmpresas: number;
  /** True si es un plan de prueba, no de pago */
  esTrialGratuito: boolean;
}

export const PLAN_UI_DATA: Record<string, PlanUIData> = {
  FREE: {
    tagline: 'Sin tarjeta de credito',
    shortDescription: 'Prueba todas las funciones principales por 30 dias, sin compromiso.',
    precioMensual: null,
    precioAnual: null,
    moneda: 'USD',
    featured: false,
    features: [
      { label: 'Prueba gratuita por 30 dias', included: true, highlight: true },
      { label: 'Facturacion electronica SRI', included: true },
      { label: 'Hasta 10 documentos de prueba', included: true },
      { label: '1 usuario incluido', included: true },
      { label: '1 empresa', included: true },
      { label: 'Soporte por email', included: true },
      { label: 'Reportes avanzados', included: false },
      { label: 'Acceso a la API', included: false },
    ],
    ctaLabel: 'Comenzar prueba gratis',
    gradient: 'from-emerald-500 to-teal-600',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    limiteDocumentos: 10,
    limiteUsuarios: 1,
    limiteEmpresas: 1,
    esTrialGratuito: true,
  },
  BASICO: {
    tagline: 'Ideal para emprendedores y autonomos',
    shortDescription: 'Factura electronicamente y lleva tu inventario sin complicaciones.',
    precioMensual: 12.99,
    precioAnual: 129.99,
    moneda: 'USD',
    featured: false,
    features: [
      { label: '100 documentos por mes', included: true, highlight: true },
      { label: 'Facturacion electronica SRI', included: true },
      { label: 'Inventario basico', included: true },
      { label: '1 usuario', included: true },
      { label: '1 empresa', included: true },
      { label: 'Soporte por email', included: true },
      { label: 'Reportes avanzados', included: false },
      { label: 'Acceso a la API', included: false },
    ],
    ctaLabel: 'Continuar con Plan Basico',
    gradient: 'from-slate-500 to-slate-700',
    badgeClass: 'bg-slate-100 text-slate-700',
    btnClass: 'bg-slate-800 hover:bg-slate-900 text-white',
    limiteDocumentos: 100,
    limiteUsuarios: 1,
    limiteEmpresas: 1,
    esTrialGratuito: false,
  },
  PROFESIONAL: {
    tagline: 'El favorito de las PyMEs ecuatorianas',
    shortDescription: 'Facturacion, POS e inventario avanzado para negocios en crecimiento.',
    precioMensual: 24.99,
    precioAnual: 249.99,
    moneda: 'USD',
    featured: true,
    badgeLabel: 'Mas Popular',
    features: [
      { label: '500 documentos por mes', included: true, highlight: true },
      { label: 'Facturacion electronica SRI', included: true },
      { label: 'Punto de venta (POS)', included: true },
      { label: 'Inventario avanzado', included: true },
      { label: '3 usuarios incluidos', included: true },
      { label: '1 empresa', included: true },
      { label: 'Reportes avanzados', included: true },
      { label: 'Soporte prioritario', included: true },
    ],
    ctaLabel: 'Continuar con Plan Profesional',
    gradient: 'from-blue-600 to-indigo-700',
    badgeClass: 'bg-white/20 text-white',
    btnClass: 'bg-white hover:bg-blue-50 text-blue-700',
    limiteDocumentos: 500,
    limiteUsuarios: 3,
    limiteEmpresas: 1,
    esTrialGratuito: false,
  },
  EMPRESARIAL: {
    tagline: 'Para empresas con operaciones exigentes',
    shortDescription: 'Potencia maxima con API, multi-empresa y soporte dedicado.',
    precioMensual: 49.99,
    precioAnual: 499.99,
    moneda: 'USD',
    featured: false,
    features: [
      { label: 'Documentos ilimitados', included: true, highlight: true },
      { label: 'Facturacion electronica SRI', included: true },
      { label: 'Punto de venta (POS)', included: true },
      { label: 'Inventario avanzado', included: true },
      { label: 'Usuarios ilimitados', included: true },
      { label: 'Multi-empresa incluida', included: true },
      { label: 'Acceso a la API completa', included: true },
      { label: 'Soporte prioritario 24/7', included: true },
    ],
    ctaLabel: 'Contactar a ventas',
    gradient: 'from-indigo-600 to-violet-700',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    limiteDocumentos: null,
    limiteUsuarios: null,
    limiteEmpresas: 0,
    esTrialGratuito: false,
  },
  ILIMITADO: {
    tagline: 'Sin restricciones de ningun tipo',
    shortDescription: 'El plan mas completo de la plataforma, con todas las funciones.',
    precioMensual: 89.99,
    precioAnual: 899.99,
    moneda: 'USD',
    featured: false,
    features: [
      { label: 'Todo ilimitado', included: true, highlight: true },
      { label: 'Todas las funciones habilitadas', included: true },
      { label: 'Soporte dedicado', included: true },
      { label: 'API avanzada + Webhooks', included: true },
      { label: 'Multi-empresa ilimitada', included: true },
      { label: 'Personalizacion de la plataforma', included: true },
      { label: 'SLA garantizado', included: true },
    ],
    ctaLabel: 'Contactar a ventas',
    gradient: 'from-amber-500 to-orange-600',
    badgeClass: 'bg-amber-100 text-amber-700',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    limiteDocumentos: null,
    limiteUsuarios: null,
    limiteEmpresas: 0,
    esTrialGratuito: false,
  },
};

// Iconos por tipo de plan
const PLAN_ICONS: Record<string, ReactNode> = {
  FREE:        <Gift size={14} />,
  BASICO:      <Zap size={14} />,
  PROFESIONAL: <Star size={14} />,
  EMPRESARIAL: <Shield size={14} />,
  ILIMITADO:   <Building2 size={14} />,
};

// --- Helpers ------------------------------------------------------------------
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
  MENSUAL: 'mes', TRIMESTRAL: '3 meses', SEMESTRAL: '6 meses', ANUAL: 'ano',
};

const tipoColor: Record<string, string> = {
  FREE:        'from-emerald-500 to-teal-600',
  BASICO:      'from-gray-400 to-gray-600',
  PROFESIONAL: 'from-blue-500 to-indigo-600',
  EMPRESARIAL: 'from-indigo-600 to-violet-600',
  ILIMITADO:   'from-amber-400 to-orange-500',
};

// --- Tarjeta de estado actual -------------------------------------------------
function TarjetaEstado({ suscripcion }: { suscripcion: Suscripcion }) {
  const queryClient = useQueryClient();
  const { plan_detalle: plan } = suscripcion;

  const renovarMutation = useMutation({
    mutationFn: () => suscripcionesService.renovar(suscripcion.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suscripcion-activa'] }),
    onError: () => toast.error('Error al renovar la suscripcion'),
  });

  const toggleAutoRenovarMutation = useMutation({
    mutationFn: () => suscripcionesService.toggleAutoRenovar(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suscripcion-activa'] }),
    onError: () => toast.error('Error al cambiar la configuracion'),
  });

  const diasTotales = plan.periodo === 'MENSUAL' ? 30
    : plan.periodo === 'TRIMESTRAL' ? 90
    : plan.periodo === 'SEMESTRAL' ? 180 : 365;

  const progreso = Math.max(0, Math.min(100, (suscripcion.dias_restantes / diasTotales) * 100));

  const facturasUsadas = suscripcion.facturas_emitidas_mes_actual;
  const facturasLimite = plan.facturas_mensuales;
  const esIlimitado = facturasLimite <= 0;
  const facturasPct = !esIlimitado
    ? Math.min(100, (facturasUsadas / facturasLimite) * 100)
    : 0;

  const porVencer = suscripcion.dias_restantes <= 7 && suscripcion.estado === 'ACTIVA';

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className={`bg-gradient-to-r ${tipoColor[plan.tipo] ?? 'from-blue-500 to-blue-600'} p-6 text-white`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Plan actual</p>
            <h2 className="text-3xl font-bold mt-1">{plan.nombre}</h2>
            <p className="text-white/80 text-sm mt-1">{plan.periodo} &middot; ${Number(plan.precio).toFixed(2)} / {periodoLabel[plan.periodo]}</p>
          </div>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 ${estadoBadge(suscripcion.estado).replace('bg-', 'border border-').replace('text-', 'text-white ')}`}>
            {estadoIcono(suscripcion.estado)}
            {suscripcion.estado}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Vigencia</span>
            <span className={`font-semibold ${porVencer ? 'text-red-600' : 'text-gray-800'}`}>
              {suscripcion.dias_restantes} dias restantes
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

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Documentos del periodo</span>
            <span className="font-semibold text-gray-800">
              {facturasUsadas} / {esIlimitado ? '∞' : facturasLimite}
            </span>
          </div>
          {!esIlimitado && (
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${facturasPct >= 90 ? 'bg-red-500' : facturasPct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${facturasPct}%` }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-500 text-xs">Proximo pago</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {suscripcion.fecha_proximo_pago
                ? new Date(suscripcion.fecha_proximo_pago).toLocaleDateString('es-EC')
                : '—'}
            </p>
          </div>
          <button
            onClick={() => { if (!toggleAutoRenovarMutation.isPending) toggleAutoRenovarMutation.mutate(); }}
            disabled={toggleAutoRenovarMutation.isPending}
            className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3 text-left transition-colors disabled:opacity-50 cursor-pointer w-full"
          >
            <p className="text-gray-500 text-xs">Auto-renovar</p>
            <div className="flex items-center gap-2 mt-0.5">
              {suscripcion.auto_renovar
                ? <ToggleRight size={20} className="text-green-600 shrink-0" />
                : <ToggleLeft size={20} className="text-gray-400 shrink-0" />}
              <p className={`font-semibold ${suscripcion.auto_renovar ? 'text-green-600' : 'text-gray-500'}`}>
                {toggleAutoRenovarMutation.isPending ? 'Guardando...' : suscripcion.auto_renovar ? 'Activado' : 'Desactivado'}
              </p>
            </div>
          </button>
        </div>

        {porVencer && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <div>
              <p className="text-red-700 font-semibold text-sm">Suscripcion por vencer</p>
              <p className="text-red-600 text-xs mt-0.5">Renueva ahora para no interrumpir el servicio.</p>
            </div>
          </div>
        )}

        {(suscripcion.estado === 'VENCIDA' || porVencer) && (
          <button
            onClick={async () => { if (await confirmDialog('Renovar suscripcion por otro periodo?')) renovarMutation.mutate(); }}
            disabled={renovarMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            {renovarMutation.isPending ? 'Renovando...' : 'Renovar Suscripcion'}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Bloque de precio ---------------------------------------------------------
function PricingBlock({
  cfg,
  anual,
  dark = false,
}: {
  cfg: PlanUIData;
  anual: boolean;
  dark?: boolean;
}) {
  if (cfg.esTrialGratuito) {
    return (
      <div className={`rounded-2xl p-5 border mb-6 ${dark ? 'bg-white/10 border-white/20' : 'bg-emerald-50 border-emerald-100'}`}>
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className={`text-4xl font-black ${dark ? 'text-white' : 'text-emerald-600'}`}>30 dias</span>
          <span className={`font-bold text-lg ${dark ? 'text-emerald-300' : 'text-emerald-500'}`}>gratis</span>
        </div>
        <p className={`text-sm font-semibold ${dark ? 'text-white/80' : 'text-emerald-700'}`}>Sin tarjeta de credito</p>
        <p className={`text-xs mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Acceso completo durante el periodo de prueba</p>
      </div>
    );
  }

  const precio = anual ? cfg.precioAnual! : cfg.precioMensual!;
  const precioMensualEquivalente = anual ? cfg.precioAnual! / 12 : cfg.precioMensual!;
  const precioAnualSinDesc = cfg.precioMensual! * 12;
  const descPct = cfg.precioAnual != null
    ? Math.round((1 - cfg.precioAnual / precioAnualSinDesc) * 100)
    : 0;
  const ahorro = cfg.precioAnual != null ? precioAnualSinDesc - cfg.precioAnual : 0;

  return (
    <div className="mb-6">
      {anual && descPct > 0 && (
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`line-through text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            ${precioAnualSinDesc.toFixed(2)}/ano
          </span>
          <span className="bg-amber-400 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full">
            -{descPct}%
          </span>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <span className={`text-5xl font-black leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>
          ${precio.toFixed(2)}
        </span>
        <span className={`text-sm pb-1 ${dark ? 'text-white/60' : 'text-gray-400'}`}>
          / {anual ? 'ano' : 'mes'}
        </span>
      </div>

      {anual && (
        <p className={`text-xs mt-1.5 ${dark ? 'text-white/50' : 'text-gray-400'}`}>
          ≈ ${precioMensualEquivalente.toFixed(2)} / mes &middot; Precio + IVA
        </p>
      )}
      {!anual && (
        <p className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Precio + IVA</p>
      )}

      {anual && descPct > 0 && (
        <div className={`flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-xs font-semibold ${
          dark
            ? 'bg-white/10 border border-white/20 text-white/80'
            : 'bg-green-50 border border-green-100 text-green-700'
        }`}>
          <TrendingUp size={12} className="shrink-0" />
          Ahorra ${ahorro.toFixed(2)} al ano &mdash; como 2 meses gratis
        </div>
      )}
    </div>
  );
}

// --- Lista de beneficios ------------------------------------------------------
function FeatureList({ features, dark = false }: { features: PlanFeature[]; dark?: boolean }) {
  return (
    <ul className="space-y-3 flex-1 mb-8">
      {features.map(({ label, included, highlight }) => (
        <li
          key={label}
          className={`flex items-center gap-3 text-sm ${
            included
              ? highlight
                ? dark ? 'text-white font-semibold' : 'text-blue-700 font-semibold'
                : dark ? 'text-white/90' : 'text-gray-700'
              : dark ? 'text-white/25' : 'text-gray-300'
          }`}
        >
          {included ? (
            <CheckCircle
              size={15}
              className={`shrink-0 ${highlight ? (dark ? 'text-amber-300' : 'text-blue-500') : dark ? 'text-green-300' : 'text-green-500'}`}
            />
          ) : (
            <XCircle size={15} className={`shrink-0 ${dark ? 'text-white/15' : 'text-gray-200'}`} />
          )}
          <span className={included ? '' : 'line-through'}>{label}</span>
        </li>
      ))}
    </ul>
  );
}

// --- Card de plan -------------------------------------------------------------
function PlanCard({
  plan,
  esPlanActual,
  anual,
  onElegir,
}: {
  plan: PlanSuscripcion;
  esPlanActual: boolean;
  anual: boolean;
  onElegir: (plan: PlanSuscripcion) => void;
}) {
  const cfg = PLAN_UI_DATA[plan.tipo] ?? PLAN_UI_DATA.BASICO;

  // Plan FREE / Trial
  if (cfg.esTrialGratuito) {
    return (
      <div
        className={`relative bg-white rounded-3xl border-2 shadow-sm hover:shadow-lg transition-all flex flex-col ${
          esPlanActual ? 'border-emerald-400' : 'border-gray-100 hover:border-emerald-200'
        }`}
      >
        {esPlanActual && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-md">
              ✓ Plan Actual
            </span>
          </div>
        )}
        <div className="p-7 flex flex-col flex-1">
          <span className={`self-start flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-3 ${cfg.badgeClass}`}>
            {PLAN_ICONS[plan.tipo]} {plan.tipo}
          </span>
          <h3 className="text-2xl font-black text-gray-900 mb-1">{plan.nombre}</h3>
          <p className="text-gray-500 text-sm mb-5">{cfg.tagline}</p>
          <PricingBlock cfg={cfg} anual={anual} />
          <FeatureList features={cfg.features} />
          {esPlanActual ? (
            <div className="w-full text-center py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold text-sm">
              ✓ Tu plan actual
            </div>
          ) : (
            <button
              onClick={() => onElegir(plan)}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[.98] shadow-sm hover:shadow-md ${cfg.btnClass}`}
            >
              {cfg.ctaLabel}
            </button>
          )}
          <p className="text-center text-xs text-gray-400 mt-3">Sin compromisos &middot; Cancela en cualquier momento</p>
        </div>
      </div>
    );
  }

  // Plan destacado (PROFESIONAL)
  if (cfg.featured) {
    return (
      <div
        className={`relative bg-gradient-to-br ${cfg.gradient} rounded-3xl shadow-2xl p-7 text-white flex flex-col`}
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-900 text-xs font-black px-4 py-1.5 rounded-full shadow-lg">
            <Star size={11} fill="currentColor" /> {cfg.badgeLabel ?? 'Mas Popular'}
          </span>
        </div>
        {esPlanActual && (
          <div className="absolute -top-4 right-4">
            <span className="inline-flex items-center gap-1 bg-green-400 text-green-900 text-xs font-black px-3 py-1.5 rounded-full shadow-md">
              ✓ Actual
            </span>
          </div>
        )}
        <span className={`self-start flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-3 ${cfg.badgeClass}`}>
          {PLAN_ICONS[plan.tipo]} {plan.tipo}
        </span>
        <h3 className="text-2xl font-black mb-1">{plan.nombre}</h3>
        <p className="text-white/70 text-sm mb-5">{cfg.tagline}</p>
        <PricingBlock cfg={cfg} anual={anual} dark />
        <FeatureList features={cfg.features} dark />
        {esPlanActual ? (
          <div className="w-full text-center py-3.5 rounded-2xl bg-white/20 border border-white/30 font-bold text-sm">
            ✓ Tu plan actual
          </div>
        ) : (
          <button
            onClick={() => onElegir(plan)}
            className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-[.98] ${cfg.btnClass}`}
          >
            {cfg.ctaLabel}
          </button>
        )}
        <p className="text-center text-xs text-white/40 mt-3">Sin contratos &middot; Cancela cuando quieras</p>
      </div>
    );
  }

  // Card estandar (BASICO, EMPRESARIAL, ILIMITADO)
  const isEnterprise = plan.tipo === 'EMPRESARIAL' || plan.tipo === 'ILIMITADO';

  return (
    <div
      className={`relative bg-white rounded-3xl border-2 shadow-sm hover:shadow-xl transition-all flex flex-col ${
        esPlanActual ? 'border-blue-400' : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {esPlanActual && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-md">
            ✓ Plan Actual
          </span>
        </div>
      )}
      <div className="p-7 flex flex-col flex-1">
        <span className={`self-start flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-3 ${cfg.badgeClass}`}>
          {PLAN_ICONS[plan.tipo]} {plan.tipo}
        </span>
        <h3 className="text-2xl font-black text-gray-900 mb-1">{plan.nombre}</h3>
        <p className="text-gray-500 text-sm mb-5">{cfg.tagline}</p>
        <PricingBlock cfg={cfg} anual={anual} />
        <FeatureList features={cfg.features} />
        {esPlanActual ? (
          <div className="w-full text-center py-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 font-bold text-sm">
            ✓ Tu plan actual
          </div>
        ) : (
          <button
            onClick={() => onElegir(plan)}
            className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[.98] shadow-sm hover:shadow-md ${cfg.btnClass}`}
          >
            {cfg.ctaLabel}
          </button>
        )}
        {isEnterprise && !esPlanActual && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Necesitas algo a medida?{' '}
            <span className="text-blue-500 underline cursor-pointer">Contactanos</span>
          </p>
        )}
        {!isEnterprise && (
          <p className="text-center text-xs text-gray-400 mt-3">Sin contratos &middot; Cancela cuando quieras</p>
        )}
      </div>
    </div>
  );
}

// --- Toggle mensual / anual --------------------------------------------------
function BillingToggle({ anual, onChange }: { anual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <span
          onClick={() => onChange(false)}
          className={`text-sm font-semibold cursor-pointer transition-colors ${!anual ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Mensual
        </span>
        <button
          onClick={() => onChange(!anual)}
          className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${anual ? 'bg-blue-600' : 'bg-gray-300'}`}
          aria-label="Cambiar periodo de facturacion"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${anual ? 'translate-x-7' : 'translate-x-0'}`}
          />
        </button>
        <span
          onClick={() => onChange(true)}
          className={`text-sm font-semibold cursor-pointer transition-colors flex items-center gap-2 ${anual ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Anual
          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full transition-all duration-300 ${
              anual ? 'bg-green-500 text-white' : 'bg-amber-400 text-amber-900'
            }`}
          >
            {anual ? '✓ Ahorro activo' : 'Ahorra hasta 17%'}
          </span>
        </span>
      </div>
      {anual && (
        <p className="text-xs text-green-600 font-semibold">
          Pagando anual es como recibir 2 meses gratis
        </p>
      )}
    </div>
  );
}

// --- Pagina principal ---------------------------------------------------------
export default function SuscripcionesPage() {
  const queryClient = useQueryClient();

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
  const [anual, setAnual] = useState(true);

  const TIPOS_ORDEN = ['FREE', 'BASICO', 'PROFESIONAL', 'EMPRESARIAL', 'ILIMITADO'] as const;

  // Índice del plan actual para determinar qué es upgrade vs downgrade
  const planActualTipo = suscripcion?.plan_detalle?.tipo as string | undefined;
  const planActualIdx = planActualTipo ? TIPOS_ORDEN.indexOf(planActualTipo as any) : -1;

  const planesPorTipo = new Map<string, { mensual?: PlanSuscripcion; anual?: PlanSuscripcion }>();
  planesArray.forEach((p) => {
    const entry = planesPorTipo.get(p.tipo) ?? {};
    if (p.periodo === 'MENSUAL') entry.mensual = p;
    else if (p.periodo === 'ANUAL') entry.anual = p;
    planesPorTipo.set(p.tipo, entry);
  });

  const planesToShow = TIPOS_ORDEN
    .map((tipo) => {
      const entry = planesPorTipo.get(tipo);
      if (!entry) return null;
      // Ocultar planes de nivel inferior al plan actual (excepto el plan actual mismo)
      const tipoIdx = TIPOS_ORDEN.indexOf(tipo);
      if (planActualIdx >= 0 && tipoIdx < planActualIdx) return null;
      const plan = tipo === 'FREE'
        ? (entry.mensual ?? entry.anual)
        : anual ? (entry.anual ?? entry.mensual) : (entry.mensual ?? entry.anual);
      if (!plan) return null;
      return plan;
    })
    .filter((p): p is PlanSuscripcion => p !== null);

  const [planAElegir, setPlanAElegir] = useState<PlanSuscripcion | null>(null);

  const cambiarPlanMutation = useMutation({
    mutationFn: (plan_id: number) => suscripcionesService.cambiarPlan(plan_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcion-activa'] });
      setPlanAElegir(null);
      toast.success('Plan actualizado correctamente');
    },
    onError: () => toast.error('Error al cambiar el plan. Intenta nuevamente.'),
  });

  const planAElegirUI = planAElegir ? PLAN_UI_DATA[planAElegir.tipo] : null;
  const precioConfirmacion = planAElegir
    ? (anual
        ? (planAElegirUI?.precioAnual ?? Number(planAElegir.precio))
        : (planAElegirUI?.precioMensual ?? Number(planAElegir.precio)))
    : 0;

  return (
    <div className="p-6 space-y-8">

      {/* Modal confirmacion cambio de plan */}
      {planAElegir && planAElegirUI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-black text-gray-900 mb-2">
              Cambiar al {planAElegir.nombre}?
            </h3>
            <p className="text-gray-500 text-sm mb-1">
              Tu suscripcion actual se cancelara y comenzaras inmediatamente el nuevo plan.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 my-4">
              <p className="text-blue-900 font-black text-lg">
                ${precioConfirmacion.toFixed(2)}
                <span className="text-blue-600 font-semibold text-sm ml-1.5">
                  / {anual ? 'ano' : 'mes'} + IVA
                </span>
              </p>
              {anual && planAElegirUI.precioMensual && (
                <p className="text-blue-600 text-xs mt-1">
                  ≈ ${(precioConfirmacion / 12).toFixed(2)} / mes equivalente
                </p>
              )}
              <p className="text-blue-500 text-xs mt-1">{planAElegirUI.tagline}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPlanAElegir(null)}
                disabled={cambiarPlanMutation.isPending}
                className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (await confirmDialog(`Confirmar cambio al ${planAElegir.nombre}?`))
                    cambiarPlanMutation.mutate(planAElegir.id);
                }}
                disabled={cambiarPlanMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors disabled:opacity-50"
              >
                {cambiarPlanMutation.isPending ? 'Cambiando...' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Suscripcion
        </h1>
        <p className="text-gray-600 mt-1">Gestiona tu plan y visualiza el uso de tu cuenta</p>
      </div>

      {/* Estado actual + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {loadingSus ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : errorSus || !suscripcion ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700">Sin suscripcion activa</p>
              <p className="text-sm text-gray-500 mt-1">Elige un plan a continuacion para comenzar.</p>
            </div>
          ) : (
            <TarjetaEstado suscripcion={suscripcion} />
          )}
        </div>

        {suscripcion && (
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
            {[
              { label: 'Plan', value: suscripcion.plan_detalle.nombre, color: 'text-blue-600' },
              { label: 'Dias restantes', value: `${suscripcion.dias_restantes}`, color: suscripcion.dias_restantes <= 7 ? 'text-red-600' : 'text-green-600' },
              { label: 'Estado', value: suscripcion.estado, color: 'text-gray-800' },
              { label: 'Docs. del periodo', value: `${suscripcion.facturas_emitidas_mes_actual}`, color: 'text-blue-600' },
              { label: 'Limite del periodo', value: suscripcion.plan_detalle.facturas_mensuales <= 0 ? '∞' : `${suscripcion.plan_detalle.facturas_mensuales}`, color: 'text-gray-800' },
              { label: 'Usuarios permitidos', value: suscripcion.plan_detalle.usuarios_permitidos <= 0 ? '∞' : `${suscripcion.plan_detalle.usuarios_permitidos}`, color: 'text-gray-800' },
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

        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-black px-4 py-2 rounded-full mb-5">
            <Sparkles size={12} /> Planes y precios
          </span>
          <h2 className="text-4xl font-black text-gray-900 mb-3 leading-tight">
            Elige el plan ideal<br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              para tu negocio
            </span>
          </h2>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Facturacion electronica SRI, inventario y POS en un solo lugar. Sin contratos.
          </p>
        </div>

        <div className="flex justify-center mb-14">
          <BillingToggle anual={anual} onChange={setAnual} />
        </div>

        {loadingPlanes ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : planesToShow.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
            <p>No hay planes disponibles en este momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch max-w-6xl mx-auto">
            {planesToShow.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                anual={anual}
                esPlanActual={suscripcion?.plan === plan.id}
                onElegir={setPlanAElegir}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-gray-400">
            <span>✓ Facturacion electronica SRI</span>
            <span>✓ Sin contratos de permanencia</span>
            <span>✓ Cancela cuando quieras</span>
            <span>✓ Actualizaciones gratuitas</span>
          </div>
          <p className="text-xs text-gray-400">
            Todos los precios en USD &middot; No incluyen IVA (12%) &middot; Pago seguro
          </p>
        </div>
      </section>
    </div>
  );
}
