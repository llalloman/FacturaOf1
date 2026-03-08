import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { suscripcionesService } from '../services/suscripcionesService';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { suscripcionesService } from '../services/suscripcionesService';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

function PlanCard({ plan }: { plan: PlanSuscripcion }) {
  const isPopular = plan.tipo === 'PROFESIONAL';

  const features: { icon: React.ElementType; label: string; highlight: boolean }[] = [
    { icon: FileText, label: plan.facturas_mensuales === 0 ? 'Facturas ilimitadas' : `${plan.facturas_mensuales} facturas / mes`, highlight: false },
    { icon: User, label: plan.usuarios_permitidos === 0 ? 'Usuarios ilimitados' : `${plan.usuarios_permitidos} usuario${plan.usuarios_permitidos !== 1 ? 's' : ''}`, highlight: false },
    ...(plan.soporte_prioritario ? [{ icon: Star, label: 'Soporte prioritario', highlight: true }] : []),
    ...(plan.reportes_avanzados ? [{ icon: BarChart3, label: 'Reportes avanzados', highlight: true }] : []),
    ...(plan.api_access ? [{ icon: Zap, label: 'Acceso API', highlight: true }] : []),
  ];

  return (
    <div className={`relative flex flex-col bg-white rounded-2xl border-2 transition-all ${
      isPopular
        ? 'border-blue-500 shadow-2xl shadow-blue-100 scale-[1.03]'
        : 'border-gray-200 shadow-md hover:shadow-xl hover:border-gray-300'
    }`}>
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-black px-5 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
            <Star size={10} fill="currentColor" /> Popular
          </span>
        </div>
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Plan name */}
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">{plan.tipo}</p>
        <h3 className="text-2xl font-black text-gray-900 mb-5">{plan.nombre}</h3>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-end gap-1">
            <span className="text-5xl font-black text-gray-900">${Number(plan.precio).toFixed(2)}</span>
            <span className="text-gray-400 text-sm pb-1.5">/ mes</span>
          </div>
          <p className="text-gray-400 text-xs mt-1">Precio + IVA · Sin permanencia</p>
        </div>

        {/* CTA button */}
        <button className={`w-full py-3.5 rounded-xl font-black text-sm mb-7 transition-all active:scale-[.98] ${
          isPopular
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-200'
            : 'bg-gray-900 hover:bg-gray-800 text-white'
        }`}>
          ¡Elegir {plan.nombre}!
        </button>

        {/* Divider */}
        <div className="border-t border-gray-100 mb-5" />

        {/* Features */}
        <ul className="space-y-3 flex-1">
          <li className="flex items-center gap-3 text-sm text-gray-600">
            <Check size={16} className="text-blue-500 shrink-0" />
            Facturación electrónica SRI
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-600">
            <Check size={16} className="text-blue-500 shrink-0" />
            POS y gestión de inventario
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-600">
            <Check size={16} className="text-blue-500 shrink-0" />
            Gestión de clientes
          </li>
          {features.map(({ icon: Icon, label, highlight }) => (
            <li key={label} className={`flex items-center gap-3 text-sm ${
              highlight ? 'text-emerald-700 font-semibold' : 'text-gray-600'
            }`}>
              {highlight
                ? <Icon size={16} className="text-emerald-500 shrink-0" />
                : <Check size={16} className="text-blue-500 shrink-0" />}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function BienvenidaPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: planes = [] } = useQuery<PlanSuscripcion[]>({
    queryKey: ['planes'],
    queryFn: suscripcionesService.getPlanes,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-12">
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
              Tu cuenta fue creada exitosamente. Tienes <strong className="text-white">30 días de acceso completo gratuito</strong> para explorar todas las funcionalidades.
            </p>

            {/* Trial highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Clock className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">30 días</p>
                <p className="text-blue-200 text-xs">prueba gratuita</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <FileText className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">Facturas</p>
                <p className="text-blue-200 text-xs">electrónicas ilimitadas</p>
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
              <h2 className="text-2xl font-black text-gray-900 mb-2">Nuestros Planes</h2>
              <p className="text-gray-500 text-sm">
                Después de los 30 días, elige el plan que mejor se adapte a tu negocio.
                <br />
                <span className="text-blue-700 font-semibold">Sin tarjeta de crédito requerida durante la prueba.</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start py-4">
              {planes.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mt-5">
              * Al vencer el período de prueba, si no contratas un plan solo tendrás acceso a facturación y 1 usuario administrador.
            </p>
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
