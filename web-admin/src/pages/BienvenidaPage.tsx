import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { suscripcionesService } from '../services/suscripcionesService';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { PlanSuscripcion } from '../types';
import {
  CheckCircle2,
  FileText,
  User,
  Zap,
  Star,
  BarChart3,
  ArrowRight,
  Rocket,
  Shield,
  Clock,
  Check,
  CheckCircle,
} from 'lucide-react';

const PLAN_STORAGE_KEY = 'of1_plan_elegido';

const planBadge: Record<string, { label: string; cls: string }> = {
  FREE:        { label: 'Gratis',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  BASICO:      { label: 'Básico',  cls: 'bg-slate-100 text-slate-600' },
  PROFESIONAL: { label: 'Popular', cls: 'bg-blue-600 text-white shadow-lg' },
  EMPRESARIAL: { label: 'Premium', cls: 'bg-indigo-100 text-indigo-700' },
  ILIMITADO:   { label: 'Max',     cls: 'bg-amber-100 text-amber-700' },
};

function docsLabel(plan: PlanSuscripcion): string {
  if (plan.tipo === 'FREE') return `${plan.facturas_mensuales} documentos / año`;
  if (plan.facturas_mensuales === 0) return 'Facturas ilimitadas';
  return `${plan.facturas_mensuales} facturas / mes`;
}

function PlanCard({
  plan,
  seleccionado,
  onElegir,
}: {
  plan: PlanSuscripcion;
  seleccionado: boolean;
  onElegir: (plan: PlanSuscripcion) => void;
}) {
  const isFree = plan.tipo === 'FREE';
  const isPopular = plan.tipo === 'PROFESIONAL';
  const badge = planBadge[plan.tipo] ?? planBadge.BASICO;

  const paidFeatures: { icon: React.ElementType; label: string; highlight: boolean }[] = [
    { icon: FileText, label: docsLabel(plan), highlight: false },
    { icon: User, label: plan.usuarios_permitidos === 0 ? 'Usuarios ilimitados' : `${plan.usuarios_permitidos} usuario${plan.usuarios_permitidos !== 1 ? 's' : ''}`, highlight: false },
    ...(plan.soporte_prioritario ? [{ icon: Star, label: 'Soporte prioritario', highlight: true }] : []),
    ...(plan.reportes_avanzados ? [{ icon: BarChart3, label: 'Reportes avanzados', highlight: true }] : []),
    ...(plan.api_access ? [{ icon: Zap, label: 'Acceso API', highlight: true }] : []),
  ];

  return (
    <div className={`relative flex flex-col bg-white rounded-2xl border-2 transition-all ${
      seleccionado
        ? 'border-green-500 shadow-2xl shadow-green-100'
        : isPopular
          ? 'border-blue-500 shadow-2xl shadow-blue-100'
          : 'border-gray-200 shadow-md hover:shadow-xl hover:border-gray-300'
    }`}>
      {/* Badges */}
      {seleccionado ? (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
          <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
            <CheckCircle size={11} fill="currentColor" /> Plan elegido
          </span>
        </div>
      ) : (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-full ${badge.cls}`}>
            {isPopular && <Star size={10} fill="currentColor" />}
            {badge.label}
          </span>
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{plan.tipo}</p>
        <h3 className="text-xl font-black text-gray-900 mb-4">{plan.nombre}</h3>

        {/* Price */}
        <div className="mb-4">
          {isFree ? (
            <>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-emerald-600">Gratis</span>
              </div>
              <p className="text-emerald-600/70 text-xs mt-1 font-medium">Siempre gratis para facturación</p>
            </>
          ) : (
            <>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-gray-900">${Number(plan.precio).toFixed(2)}</span>
                <span className="text-gray-400 text-xs pb-1.5">/ mes</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">Precio + IVA · Sin permanencia</p>
            </>
          )}
        </div>

        <button
          onClick={() => onElegir(plan)}
          className={`w-full py-3 rounded-xl font-black text-sm mb-5 transition-all active:scale-[.98] ${
            seleccionado
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200'
              : isFree
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : isPopular
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-200'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          {seleccionado ? '✓ Plan seleccionado' : isFree ? '¡Empezar gratis!' : `¡Elegir ${plan.nombre}!`}
        </button>

        <div className="border-t border-gray-100 mb-4" />

        {isFree ? (
          <ul className="space-y-2.5 flex-1">
            {/* Billing — free 1 year */}
            <li className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1">Incluido gratis — 1 año</li>
            <li className="flex items-start gap-2.5 text-sm text-gray-700">
              <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>Facturación electrónica SRI</span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-700">
              <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>{docsLabel(plan)}</span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-700">
              <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>1 usuario</span>
            </li>
            {/* Other features — 30-day trial only */}
            <li className="text-xs font-black uppercase tracking-widest text-amber-500 mt-3 mb-1">Solo 30 días de prueba</li>
            <li className="flex items-start gap-2.5 text-sm text-gray-400">
              <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <span>POS y gestión de inventario</span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-400">
              <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <span>Gestión de clientes</span>
            </li>
          </ul>
        ) : (
          <ul className="space-y-2.5 flex-1">
            <li className="flex items-start gap-2.5 text-sm text-gray-600">
              <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />
              Facturación electrónica SRI
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-600">
              <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />
              POS y gestión de inventario
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-600">
              <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />
              Gestión de clientes
            </li>
            {paidFeatures.map(({ icon: Icon, label, highlight }) => (
              <li key={label} className={`flex items-start gap-2.5 text-sm ${
                highlight ? 'text-emerald-700 font-semibold' : 'text-gray-600'
              }`}>
                {highlight
                  ? <Icon size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />}
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function BienvenidaPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [planSeleccionado, setPlanSeleccionado] = useState<PlanSuscripcion | null>(() => {
    try {
      const saved = localStorage.getItem(PLAN_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const { data: planes = [] } = useQuery<PlanSuscripcion[]>({
    queryKey: ['planes'],
    queryFn: suscripcionesService.getPlanes,
    staleTime: 5 * 60 * 1000,
  });

  const handleElegirPlan = (plan: PlanSuscripcion) => {
    setPlanSeleccionado(plan);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-36 mx-auto mb-6 object-contain" />

          {/* Welcome hero */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 mb-8 text-white">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black mb-3">
              ¡Bienvenido, {user?.first_name || user?.email?.split('@')[0]}! 🎉
            </h1>
            <p className="text-blue-100 text-lg max-w-xl mx-auto">
              Tu cuenta fue creada exitosamente. Tu <strong className="text-white">facturación electrónica SRI está activa por 1 año</strong> y tienes <strong className="text-white">30 días de prueba gratuita</strong> para todos los demás servicios.
            </p>

            {/* Trial highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Clock className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">30 días</p>
                <p className="text-blue-200 text-xs">prueba gratis de POS, inventario y más</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <FileText className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">1 año</p>
                <p className="text-blue-200 text-xs">de facturación electrónica activa</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Shield className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">SRI</p>
                <p className="text-blue-200 text-xs">homologado y certificado</p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans section */}
        {planes.length > 0 && (
          <div className="bg-white rounded-3xl p-8 mb-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-gray-900 mb-2">Elige tu plan</h2>
              <p className="text-gray-500 text-sm">
                Selecciona el plan que mejor se adapte a tu negocio. Lo activaremos al vencer los 30 días de prueba.
              </p>
              <p className="text-blue-700 font-semibold text-sm mt-1">Sin tarjeta de crédito requerida durante la prueba.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch py-4">
              {planes.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  seleccionado={planSeleccionado?.id === plan.id}
                  onElegir={handleElegirPlan}
                />
              ))}
            </div>
            {planSeleccionado ? (
              <p className="text-center text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl py-2 px-4 mt-5">
                ✓ Has elegido el plan <strong>{planSeleccionado.nombre}</strong> — lo activaremos automáticamente al finalizar tu período de prueba.
              </p>
            ) : (
              <p className="text-center text-xs text-gray-400 mt-5">
                * Al vencer los 30 días, si no elegiste un plan solo tendrás acceso a facturación y 1 usuario administrador.
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-3 px-10 py-4 bg-white text-blue-900 rounded-2xl font-black text-lg shadow-2xl hover:shadow-white/20 hover:-translate-y-1 transition-all duration-200"
          >
            <CheckCircle2 className="w-6 h-6 text-blue-700" />
            Configurar mi empresa
            <ArrowRight className="w-6 h-6" />
          </button>
          <p className="text-blue-200 text-sm mt-3">
            Solo toma unos minutos · Puedes completarlo después
          </p>
        </div>

        <p className="text-center text-blue-300/50 text-xs mt-8">© 2026 OF1 Solutions S.A.S.</p>
      </div>
    </div>
  );
}
