import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { suscripcionesService } from '../services/suscripcionesService';
import type { PlanSuscripcion } from '../types';
import { PLAN_UI_DATA } from './suscripciones/SuscripcionesPage';
import {
  CheckCircle2,
  FileText,
  ArrowRight,
  Rocket,
  Shield,
  Clock,
  CheckCircle,
  Star,
  TrendingUp,
  CheckCheck,
  XCircle,
  ShoppingCart,
  Package,
  Users,
  FileSpreadsheet,
  Wallet,
  Banknote,
  BarChart3,
  Calculator,
  Building2,
  Zap,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';

const PLAN_STORAGE_KEY = 'of1_plan_elegido';

// ─── Card de plan (bienvenida) ────────────────────────────────────────────────
function PlanCard({
  plan,
  seleccionado,
  anual,
  onElegir,
}: {
  plan: PlanSuscripcion;
  seleccionado: boolean;
  anual: boolean;
  onElegir: (plan: PlanSuscripcion) => void;
}) {
  const cfg = PLAN_UI_DATA[plan.tipo] ?? PLAN_UI_DATA.BASICO;
  const isPopular = cfg.featured;

  // ── Bloque de precio ────────────────────────────────────────────────────────
  const PriceBlock = () => {
    if (cfg.esTrialGratuito) {
      return (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">30 días</span>
            <span className="text-emerald-500 font-bold">gratis</span>
          </div>
          <p className="text-emerald-700 text-xs font-semibold mt-1">Sin tarjeta de crédito</p>
          <p className="text-gray-500 text-xs mt-0.5">Acceso completo durante la prueba</p>
        </div>
      );
    }

    const precio = anual ? cfg.precioAnual! : cfg.precioMensual!;
    const precioAnualSinDesc = cfg.precioMensual! * 12;
    const descPct = cfg.precioAnual != null ? Math.round((1 - cfg.precioAnual / precioAnualSinDesc) * 100) : 0;
    const ahorro = cfg.precioAnual != null ? precioAnualSinDesc - cfg.precioAnual : 0;

    return (
      <div className="mb-4">
        {anual && descPct > 0 && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-400 line-through text-xs">${precioAnualSinDesc.toFixed(2)}/año</span>
            <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">-{descPct}%</span>
          </div>
        )}
        <div className="flex items-end gap-1">
          <span className={`text-4xl font-black ${isPopular ? 'text-white' : 'text-gray-900'}`}>
            ${precio.toFixed(2)}
          </span>
          <span className={`text-xs pb-1.5 ${isPopular ? 'text-white/60' : 'text-gray-400'}`}>
            / {anual ? 'año' : 'mes'}
          </span>
        </div>
        {anual && (
          <p className={`text-xs mt-1 ${isPopular ? 'text-white/50' : 'text-gray-400'}`}>
            ≈ ${(precio / 12).toFixed(2)} / mes · + IVA
          </p>
        )}
        {!anual && (
          <p className={`text-xs mt-0.5 ${isPopular ? 'text-white/40' : 'text-gray-400'}`}>Precio + IVA</p>
        )}
        {anual && descPct > 0 && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1.5 rounded-xl ${
            isPopular
              ? 'bg-white/10 border border-white/20 text-white/80'
              : 'bg-green-50 border border-green-100 text-green-700'
          }`}>
            <TrendingUp size={11} className="shrink-0" />
            Ahorra ${ahorro.toFixed(2)} pagando anual
          </div>
        )}
      </div>
    );
  };

  // ── Card destacada (PROFESIONAL) ────────────────────────────────────────────
  if (isPopular) {
    return (
      <div className={`relative flex flex-col bg-gradient-to-br ${cfg.gradient} rounded-2xl border-2 transition-all shadow-2xl ${
        seleccionado ? 'border-green-400 ring-2 ring-green-400 ring-offset-2' : 'border-blue-400'
      }`}>
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
          {seleccionado ? (
            <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg">
              <CheckCircle size={11} fill="currentColor" /> Plan elegido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-900 text-xs font-black px-4 py-1.5 rounded-full shadow-lg">
              <Star size={10} fill="currentColor" /> Más Popular
            </span>
          )}
        </div>

        <div className="p-5 flex flex-col flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">{plan.tipo}</p>
          <h3 className="text-xl font-black text-white mb-1">{plan.nombre}</h3>
          <p className="text-white/60 text-xs mb-4">{cfg.tagline}</p>

          <PriceBlock />

          <button
            onClick={() => onElegir(plan)}
            className={`w-full py-3 rounded-xl font-black text-sm mb-5 transition-all active:scale-[.98] ${
              seleccionado
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                : 'bg-white hover:bg-blue-50 text-blue-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {seleccionado ? '✓ Plan seleccionado' : cfg.ctaLabel}
          </button>

          <div className="border-t border-white/20 mb-4" />

          <ul className="space-y-2.5 flex-1">
            {cfg.features.map(({ label, included, highlight }) => (
              <li key={label} className={`flex items-start gap-2.5 text-sm ${
                included
                  ? highlight ? 'text-white font-semibold' : 'text-white/85'
                  : 'text-white/25'
              }`}>
                {included
                  ? <CheckCircle size={14} className={`shrink-0 mt-0.5 ${highlight ? 'text-amber-300' : 'text-green-300'}`} />
                  : <XCircle size={14} className="text-white/15 shrink-0 mt-0.5" />}
                <span className={included ? '' : 'line-through'}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // ── Card estándar ───────────────────────────────────────────────────────────
  return (
    <div className={`relative flex flex-col bg-white rounded-2xl border-2 transition-all ${
      seleccionado
        ? 'border-green-500 shadow-2xl shadow-green-100 ring-2 ring-green-400 ring-offset-2'
        : 'border-gray-200 shadow-md hover:shadow-xl hover:border-gray-300'
    }`}>
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
        {seleccionado ? (
          <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg">
            <CheckCircle size={11} fill="currentColor" /> Plan elegido
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full ${cfg.badgeClass}`}>
            {plan.tipo}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{plan.tipo}</p>
        <h3 className="text-xl font-black text-gray-900 mb-1">{plan.nombre}</h3>
        <p className="text-gray-400 text-xs mb-4">{cfg.tagline}</p>

        <PriceBlock />

        <button
          onClick={() => onElegir(plan)}
          className={`w-full py-3 rounded-xl font-black text-sm mb-5 transition-all active:scale-[.98] shadow-sm hover:shadow-md ${
            seleccionado
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200'
              : cfg.btnClass
          }`}
        >
          {seleccionado ? '✓ Plan seleccionado' : cfg.ctaLabel}
        </button>

        <div className="border-t border-gray-100 mb-4" />

        <ul className="space-y-2.5 flex-1">
          {cfg.features.map(({ label, included, highlight }) => (
            <li key={label} className={`flex items-start gap-2.5 text-sm ${
              included
                ? highlight ? 'text-blue-700 font-semibold' : 'text-gray-700'
                : 'text-gray-300'
            }`}>
              {included
                ? <CheckCircle size={14} className={`shrink-0 mt-0.5 ${highlight ? 'text-blue-500' : 'text-green-500'}`} />
                : <XCircle size={14} className="text-gray-200 shrink-0 mt-0.5" />}
              <span className={included ? '' : 'line-through'}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Toggle mensual / anual ───────────────────────────────────────────────────
function BillingToggle({ anual, onChange }: { anual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-5 py-3">
        <span
          onClick={() => onChange(false)}
          className={`text-sm font-semibold cursor-pointer transition-colors ${!anual ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          Mensual
        </span>
        <button
          onClick={() => onChange(!anual)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${anual ? 'bg-blue-500' : 'bg-white/30'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${anual ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
        <span
          onClick={() => onChange(true)}
          className={`text-sm font-semibold cursor-pointer transition-colors flex items-center gap-2 ${anual ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          Anual
          <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
            Ahorra ~17%
          </span>
        </span>
      </div>
      {anual && (
        <p className="text-white/60 text-xs">Pagando anual es como recibir 2 meses gratis</p>
      )}
    </div>
  );
}

export default function BienvenidaPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [anual, setAnual] = useState(true);

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

  // Agrupar por tipo, mostrar el correcto según toggle (FREE siempre mensual)
  const TIPOS_ORDEN = ['FREE', 'BASICO', 'PROFESIONAL', 'EMPRESARIAL'] as const;
  const planesPorTipo = new Map<string, { mensual?: PlanSuscripcion; anual?: PlanSuscripcion }>();
  planes.forEach((p) => {
    const entry = planesPorTipo.get(p.tipo) ?? {};
    if (p.periodo === 'MENSUAL') entry.mensual = p;
    else if (p.periodo === 'ANUAL') entry.anual = p;
    planesPorTipo.set(p.tipo, entry);
  });
  const planesToShow = TIPOS_ORDEN
    .map((tipo) => {
      const entry = planesPorTipo.get(tipo);
      if (!entry) return null;
      const plan = tipo === 'FREE'
        ? (entry.mensual ?? entry.anual)
        : anual ? (entry.anual ?? entry.mensual) : (entry.mensual ?? entry.anual);
      return plan ?? null;
    })
    .filter((p): p is PlanSuscripcion => p !== null);

  const handleElegirPlan = (plan: PlanSuscripcion) => {
    setPlanSeleccionado(plan);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  };

  const planSeleccionadoUI = planSeleccionado ? PLAN_UI_DATA[planSeleccionado.tipo] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12">

        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-44 mx-auto mb-6 object-contain drop-shadow-md" />

          {/* Welcome hero */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 mb-8 text-white">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black mb-3">
              ¡Bienvenido, {user?.first_name || user?.email?.split('@')[0]}! 🎉
            </h1>
            <p className="text-blue-100 text-lg max-w-xl mx-auto">
              Tu cuenta fue creada exitosamente. Tienes{' '}
              <strong className="text-white">30 días de prueba gratuita</strong>{' '}
              para explorar todas las funciones de la plataforma.
            </p>

            {/* Trial highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Clock className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">30 días</p>
                <p className="text-blue-200 text-xs">prueba gratuita, sin tarjeta requerida</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <FileText className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">Todo incluido</p>
                <p className="text-blue-200 text-xs">facturación, POS e inventario activos</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Shield className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">SRI</p>
                <p className="text-blue-200 text-xs">homologado y certificado</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Módulos del sistema ────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-white mb-1">Todo lo que necesita tu negocio</h2>
            <p className="text-white/50 text-sm">Todos los módulos activos durante tu prueba gratuita</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: FileText,       color: 'bg-blue-500',    label: 'Facturación Electrónica',  desc: 'Facturas, N/C, N/D y retenciones firmadas al SRI' },
              { icon: ShoppingCart,   color: 'bg-emerald-500', label: 'Punto de Venta (POS)',      desc: 'Ventas rápidas, gestión de mesas y cobros' },
              { icon: Package,        color: 'bg-amber-500',   label: 'Inventario y Productos',   desc: 'Stock, alertas de mínimos y movimientos' },
              { icon: FileSpreadsheet,color: 'bg-violet-500',  label: 'Cotizaciones',              desc: 'Proformas que se convierten en facturas' },
              { icon: Users,          color: 'bg-sky-500',     label: 'Clientes y Proveedores',   desc: 'Validación de RUC/cédula y trazabilidad' },
              { icon: Wallet,         color: 'bg-rose-500',    label: 'Nómina',                    desc: 'Roles de pago y beneficios de ley' },
              { icon: Banknote,       color: 'bg-teal-500',    label: 'Bancos y Cartera',          desc: 'Cuentas por cobrar y conciliación' },
              { icon: BarChart3,      color: 'bg-indigo-500',  label: 'Declaraciones SRI',         desc: 'Formularios, retenciones y anexos' },
              { icon: Calculator,     color: 'bg-orange-500',  label: 'Contabilidad',              desc: 'Plan de cuentas y asientos automáticos' },
              { icon: RefreshCw,      color: 'bg-cyan-500',    label: 'Guías de Remisión',         desc: 'Documentos de traslado autorizados por el SRI' },
              { icon: Shield,         color: 'bg-green-600',   label: 'Firma Digital',             desc: 'Certificado .p12 integrado para firma automática' },
              { icon: BarChart3,      color: 'bg-blue-700',    label: 'Reportes y Dashboard',      desc: 'KPIs, ventas, proyecciones y exportación Excel' },
            ].map(({ icon: Icon, color, label, desc }) => (
              <div key={label} className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/15 hover:border-white/25 transition-all group">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className="text-white text-sm font-bold leading-tight mb-1">{label}</p>
                <p className="text-white/45 text-xs leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Plans section */}
        {planesToShow.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 mb-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white mb-2">
                Elige tu plan al finalizar la prueba
              </h2>
              <p className="text-white/60 text-sm max-w-sm mx-auto">
                Selecciona ahora y lo activaremos automáticamente al vencer los 30 días.
                Sin tarjeta de crédito requerida.
              </p>
            </div>

            {/* Toggle anual/mensual */}
            <div className="flex justify-center mb-10">
              <BillingToggle anual={anual} onChange={setAnual} />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch py-4 max-w-5xl mx-auto">
              {planesToShow.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  anual={anual}
                  seleccionado={planSeleccionado?.tipo === plan.tipo}
                  onElegir={handleElegirPlan}
                />
              ))}
            </div>

            {/* Confirmación de elección */}
            {planSeleccionado && planSeleccionadoUI ? (
              <div className="flex items-center justify-center gap-3 mt-6 bg-green-500/20 border border-green-400/30 text-green-300 rounded-2xl py-3 px-5">
                <CheckCheck size={18} className="shrink-0" />
                <span className="text-sm font-semibold">
                  Plan <strong className="text-white">{planSeleccionado.nombre}</strong> seleccionado
                  {planSeleccionadoUI.precioMensual && (
                    <> — se activará a ${anual ? planSeleccionadoUI.precioAnual?.toFixed(2) : planSeleccionadoUI.precioMensual?.toFixed(2)} / {anual ? 'año' : 'mes'}</>
                  )}
                </span>
              </div>
            ) : (
              <p className="text-center text-xs text-white/40 mt-5">
                * Si no eliges un plan, al vencer los 30 días continuarás con acceso básico de facturación únicamente.
              </p>
            )}

            {/* Trust signals */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-5 text-xs text-white/35">
              <span>✓ Sin contratos</span>
              <span>✓ Cancela cuando quieras</span>
              <span>✓ Precios + IVA</span>
              <span>✓ Facturación SRI incluida</span>
            </div>
          </div>
        )}

        {/* ── Empieza en 3 pasos ─────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 mb-8">
          <div className="text-center mb-7">
            <h2 className="text-xl font-black text-white mb-1">Empieza a facturar en 3 pasos</h2>
            <p className="text-white/50 text-sm">Solo toma unos minutos. Sin conocimientos técnicos.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              {
                step: '1',
                icon: Building2,
                color: 'from-blue-500 to-blue-700',
                label: 'Configura tu empresa',
                desc: 'Ingresa tu RUC, razón social, logo y sube tu certificado digital .p12 para firma automática.',
                action: 'Ir a Configuración',
                path: '/configuracion',
              },
              {
                step: '2',
                icon: Package,
                color: 'from-amber-500 to-orange-600',
                label: 'Agrega tus productos',
                desc: 'Crea tu catálogo con código, precio e IVA. Activa el inventario para llevar el stock automáticamente.',
                action: 'Ir a Productos',
                path: '/productos',
              },
              {
                step: '3',
                icon: Zap,
                color: 'from-emerald-500 to-teal-600',
                label: 'Emite tu primera factura',
                desc: 'Selecciona el cliente, agrega los productos y emite. La factura se firma y envía al SRI en segundos.',
                action: 'Ir a Facturación',
                path: '/facturacion',
              },
            ].map(({ step, icon: Icon, color, label, desc, action, path }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-xl mb-4 shrink-0`}>
                  <Icon size={24} className="text-white" />
                </div>
                <div className="absolute -top-2 -right-2 sm:static sm:hidden w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-black">{step}</div>
                <p className="text-white font-black text-base mb-2">
                  <span className="inline-block bg-white/15 text-white/70 text-xs font-black px-2 py-0.5 rounded-full mr-2">Paso {step}</span>
                  {label}
                </p>
                <p className="text-white/55 text-xs leading-relaxed mb-4">{desc}</p>
                <button
                  onClick={() => navigate(path)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-white transition-colors"
                >
                  {action} <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

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

        {/* ── Soporte ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 bg-white/5 border border-white/10 rounded-2xl px-6 py-5">
          <MessageCircle size={22} className="text-sky-400 shrink-0" />
          <p className="text-white/70 text-sm text-center sm:text-left">
            ¿Tienes dudas? Nuestro equipo está disponible para ayudarte a configurar la plataforma.
          </p>
          <a
            href="https://wa.me/593983904993?text=Hola%2C%20necesito%20ayuda%20con%20OF1%20Solutions"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors shadow-lg"
          >
            💬 Contactar soporte
          </a>
        </div>

        <p className="text-center text-blue-300/50 text-xs mt-6">© 2026 OF1 Solutions S.A.S.</p>
      </div>
    </div>
  );
}
