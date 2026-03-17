import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Star, Zap } from 'lucide-react';
import { suscripcionesService } from '../../../services/suscripcionesService';
import type { PlanSuscripcion } from '../../../types';

interface PlanFeature {
  text: string;
  highlight?: boolean;
}

interface Plan {
  id: string;
  name: string;
  badge?: string;
  badgeColor?: string;
  precioMensual: number | null;
  precioAnual: number | null;
  moneda: string;
  descripcion: string;
  ctaLabel: string;
  ctaTo: string;
  esGratis: boolean;
  featured: boolean;
  features: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Prueba gratis',
    precioMensual: null,
    precioAnual: null,
    moneda: 'USD',
    descripcion: '30 días de acceso completo. Sin tarjeta de crédito.',
    ctaLabel: 'Comenzar gratis',
    ctaTo: '/registro',
    esGratis: true,
    featured: false,
    features: [
      { text: '30 días de acceso' },
      { text: 'Sin tarjeta de crédito' },
      { text: 'Facturación electrónica SRI' },
      { text: 'Hasta 50 documentos' },
      { text: '1 usuario · 1 empresa' },
    ],
  },
  {
    id: 'basico',
    name: 'Básico',
    precioMensual: 12.99,
    precioAnual: 129.99,
    moneda: 'USD',
    descripcion: 'Ideal para emprendedores y negocios que están empezando.',
    ctaLabel: 'Continuar con Básico',
    ctaTo: '/registro',
    esGratis: false,
    featured: false,
    features: [
      { text: 'Facturación electrónica SRI' },
      { text: '100 documentos/mes' },
      { text: '1 usuario · 1 empresa' },
      { text: 'Inventario básico' },
      { text: 'Soporte por email' },
    ],
  },
  {
    id: 'profesional',
    name: 'Profesional',
    badge: 'Más popular',
    badgeColor: 'bg-amber-400 text-amber-900',
    precioMensual: 24.99,
    precioAnual: 249.99,
    moneda: 'USD',
    descripcion: 'La opción favorita de tiendas y negocios en crecimiento.',
    ctaLabel: 'Elegir Profesional',
    ctaTo: '/registro',
    esGratis: false,
    featured: true,
    features: [
      { text: 'Facturación electrónica SRI', highlight: true },
      { text: '300 documentos/mes', highlight: true },
      { text: '3 usuarios · 1 empresa' },
      { text: 'Inventario completo' },
      { text: 'Punto de venta POS', highlight: true },
      { text: 'Reportes avanzados' },
      { text: 'Soporte prioritario' },
    ],
  },
  {
    id: 'empresarial',
    name: 'Empresarial',
    precioMensual: 49.99,
    precioAnual: 499.99,
    moneda: 'USD',
    descripcion: 'Para empresas con múltiples usuarios y mayores volúmenes.',
    ctaLabel: 'Elegir Empresarial',
    ctaTo: '/registro',
    esGratis: false,
    featured: false,
    features: [
      { text: 'Facturación electrónica SRI' },
      { text: 'Documentos ilimitados' },
      { text: '10 usuarios · multiempresa' },
      { text: 'Inventario avanzado' },
      { text: 'POS · API access' },
      { text: 'Reportes avanzados' },
      { text: 'Soporte prioritario 24/7' },
    ],
  },
];

/** Extrae precioMensual/precioAnual por tipo desde los planes del API */
function extractPrecios(apiPlanes: PlanSuscripcion[]): Record<string, { mensual: number | null; anual: number | null }> {
  const result: Record<string, { mensual: number | null; anual: number | null }> = {};
  for (const p of apiPlanes) {
    if (!result[p.tipo]) result[p.tipo] = { mensual: null, anual: null };
    if (p.periodo === 'MENSUAL') result[p.tipo].mensual = Number(p.precio);
    if (p.periodo === 'ANUAL') result[p.tipo].anual = Number(p.precio);
  }
  return result;
}

function PlanCard({ plan, anual }: { plan: Plan; anual: boolean }) {
  const precio = anual ? plan.precioAnual : plan.precioMensual;
  const ahorro =
    !plan.esGratis && plan.precioMensual && plan.precioAnual
      ? (plan.precioMensual * 12 - plan.precioAnual).toFixed(2)
      : null;

  return (
    <div
      className={`relative flex flex-col rounded-2xl transition-all duration-300 ${
        plan.featured
          ? 'bg-gradient-to-b from-blue-700 to-indigo-800 border-2 border-blue-400/50 shadow-2xl shadow-blue-900/40 scale-[1.02] z-10'
          : 'bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1'
      }`}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${plan.badgeColor} shadow`}>
            <Star className="w-3 h-3" fill="currentColor" />
            {plan.badge}
          </span>
        </div>
      )}

      <div className="p-6 flex flex-col h-full">
        {/* Name */}
        <div className={`text-sm font-bold uppercase tracking-widest mb-1 ${plan.featured ? 'text-blue-300' : 'text-slate-400'}`}>
          {plan.name}
        </div>

        {/* Price */}
        <div className="mb-3">
          {plan.esGratis ? (
            <div>
              <div className={`text-4xl font-black ${plan.featured ? 'text-white' : 'text-slate-900'}`}>
                Gratis
              </div>
              <div className={`text-sm mt-1 ${plan.featured ? 'text-blue-200' : 'text-slate-500'}`}>
                30 días · sin tarjeta
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-end gap-1.5">
                <span className={`text-4xl font-black ${plan.featured ? 'text-white' : 'text-slate-900'}`}>
                  ${precio?.toFixed(2)}
                </span>
                <span className={`text-sm pb-1.5 ${plan.featured ? 'text-blue-200' : 'text-slate-400'}`}>
                  /{anual ? 'año' : 'mes'}
                </span>
              </div>
              {anual && ahorro && (
                <div className="mt-1 text-xs font-semibold text-emerald-400">
                  Ahorras ${ahorro} — como 2 meses gratis
                </div>
              )}
              {!anual && (
                <div className={`text-xs mt-1 ${plan.featured ? 'text-blue-300/70' : 'text-slate-400'}`}>
                  o ${plan.precioAnual}/año
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className={`text-sm leading-relaxed mb-5 ${plan.featured ? 'text-blue-200' : 'text-slate-500'}`}>
          {plan.descripcion}
        </p>

        {/* Features */}
        <ul className="space-y-2.5 mb-6 flex-1">
          {plan.features.map((feat) => (
            <li key={feat.text} className="flex items-center gap-2.5 text-sm">
              <Check
                className={`w-4 h-4 flex-shrink-0 ${
                  plan.featured ? 'text-emerald-400' : 'text-emerald-500'
                }`}
              />
              <span
                className={
                  feat.highlight
                    ? plan.featured
                      ? 'text-white font-semibold'
                      : 'text-slate-800 font-semibold'
                    : plan.featured
                    ? 'text-blue-100'
                    : 'text-slate-600'
                }
              >
                {feat.text}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          to={plan.ctaTo}
          className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all ${
            plan.featured
              ? 'bg-white text-blue-800 hover:bg-blue-50 shadow-lg hover:shadow-white/20'
              : plan.esGratis
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-blue-600/20'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow'
          }`}
        >
          {plan.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

export default function PricingSection() {
  const [anual, setAnual] = useState(true);

  const { data: apiPlanes = [] } = useQuery<PlanSuscripcion[]>({
    queryKey: ['planes-publicos'],
    queryFn: suscripcionesService.getPlanes,
    staleTime: 1000 * 60 * 10,
  });

  // Sobrescribe precios con los del API; si el API no responde, usa los hardcodeados
  const precios = extractPrecios(apiPlanes);
  const plans = PLANS.map((p) => {
    const tipo = p.id.toUpperCase();
    if (!p.esGratis && precios[tipo]) {
      return {
        ...p,
        precioMensual: precios[tipo].mensual ?? p.precioMensual,
        precioAnual: precios[tipo].anual ?? p.precioAnual,
      };
    }
    return p;
  });

  return (
    <section id="planes" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-block text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">
            Planes y precios
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Precios simples y transparentes
          </h2>
          <p className="text-slate-500 text-lg">
            Empieza gratis y crece según las necesidades de tu negocio. Sin costos ocultos.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setAnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                !anual
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                anual
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Anual
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Ahorra 2 meses
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} anual={anual} />
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-400 text-sm mt-10">
          Todos los precios son + IVA · Sin contratos · Cancela cuando quieras
        </p>
      </div>
    </section>
  );
}
