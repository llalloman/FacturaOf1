import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { suscripcionesService } from '../services/suscripcionesService';
import type { Suscripcion, PlanSuscripcion } from '../types';
import {
  CheckCircle2,
  FileText,
  ArrowRight,
  Rocket,
  Shield,
  Clock,
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
  Star,
  Check,
  Loader2,
  X,
} from 'lucide-react';

// ─── Estilos por tipo de plan (fondo oscuro) ─────────────────────────────────
const PLAN_STYLE: Record<string, { border: string; badge: string; ring: string; featured: boolean }> = {
  FREE:        { border: 'border-emerald-400/40', badge: 'bg-emerald-400/15 text-emerald-300', ring: 'ring-emerald-400', featured: false },
  BASICO:      { border: 'border-slate-400/40',   badge: 'bg-slate-400/15 text-slate-300',   ring: 'ring-slate-300',   featured: false },
  PROFESIONAL: { border: 'border-blue-400/60',    badge: 'bg-blue-400/20 text-blue-200',     ring: 'ring-blue-400',    featured: true  },
  EMPRESARIAL: { border: 'border-violet-400/40',  badge: 'bg-violet-400/15 text-violet-300', ring: 'ring-violet-400',  featured: false },
  ILIMITADO:   { border: 'border-amber-400/40',   badge: 'bg-amber-400/15 text-amber-300',   ring: 'ring-amber-400',   featured: false },
};

// ─── Tarjeta suscripción activa ──────────────────────────────────────────────
function SuscripcionCard({ suscripcion }: { suscripcion: Suscripcion }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [anual, setAnual] = useState(true);

  const handleTogglePeriodo = (newAnual: boolean) => {
    setAnual(newAnual);
    if (seleccionado) {
      const current = planes.find((p) => p.id === seleccionado);
      if (current && current.tipo !== 'FREE') {
        const match = planes.find((p) => p.tipo === current.tipo && p.periodo === (newAnual ? 'ANUAL' : 'MENSUAL'));
        if (match) setSeleccionado(match.id);
      }
    }
  };

  const plan = suscripcion.plan_detalle;
  const isPrueba = suscripcion.estado === 'PRUEBA';

  const { data: planes = [], isLoading: loadingPlanes } = useQuery<PlanSuscripcion[]>({
    queryKey: ['planes-publicos'],
    queryFn: suscripcionesService.getPlanes,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: cambiar, isPending, error: errorCambio } = useMutation({
    mutationFn: (plan_id: number) => suscripcionesService.cambiarPlan(plan_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcion-activa'] });
      setOpen(false);
      setSeleccionado(null);
    },
  });

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-6 mb-8">
      {/* Fila principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/30 rounded-xl flex items-center justify-center">
              <Star size={18} className="text-amber-300" />
            </div>
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Plan seleccionado</p>
              <h3 className="text-white font-black text-lg leading-tight">
                {plan.nombre}
                {isPrueba && (
                  <span className="ml-2 text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full align-middle">
                    Demo activa
                  </span>
                )}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              plan.facturas_mensuales === -1 ? 'Documentos ilimitados' : `${plan.facturas_mensuales} docs/mes`,
              plan.usuarios_permitidos === -1 ? 'Usuarios ilimitados' : `${plan.usuarios_permitidos} usuario${plan.usuarios_permitidos !== 1 ? 's' : ''}`,
              plan.soporte_prioritario && 'Soporte prioritario',
              plan.reportes_avanzados && 'Reportes avanzados',
              plan.api_access && 'API access',
            ].filter(Boolean).map((f) => (
              <span key={f as string} className="inline-flex items-center gap-1 text-xs bg-white/10 text-white/80 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={10} className="text-emerald-400" /> {f}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <button
            onClick={() => { setOpen((v) => !v); setSeleccionado(null); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {open ? <X size={14} /> : <ArrowRight size={14} />}
            {open ? 'Cancelar' : 'Cambiar plan'}
          </button>
        </div>
      </div>

      {/* Grilla de planes desplegable */}
      {open && (
        <div className="mt-6 pt-5 border-t border-white/10">
          {loadingPlanes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="text-white/50 animate-spin" />
            </div>
          ) : (
            <>
              {/* Toggle mensual / anual */}
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center bg-white/10 rounded-full p-1 gap-1">
                  <button
                    onClick={() => handleTogglePeriodo(false)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                      !anual ? 'bg-white text-slate-900 shadow-sm' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    onClick={() => handleTogglePeriodo(true)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                      anual ? 'bg-white text-slate-900 shadow-sm' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Anual
                    <span className="bg-emerald-400/20 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Ahorra 2 meses
                    </span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {planes.filter((p) => p.tipo === 'FREE' || p.periodo === (anual ? 'ANUAL' : 'MENSUAL')).map((p) => {
                  const s = PLAN_STYLE[p.tipo] ?? PLAN_STYLE.BASICO;
                  const esActual = p.id === plan.id;
                  const sel = seleccionado === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={esActual}
                      onClick={() => setSeleccionado(sel ? null : p.id)}
                      className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                        esActual
                          ? `${s.border} bg-white/5 opacity-60 cursor-not-allowed`
                          : sel
                          ? `${s.border} bg-white/15 ring-2 ${s.ring} ring-offset-1 ring-offset-transparent`
                          : `${s.border} bg-white/8 hover:bg-white/15`
                      }`}
                    >
                      {esActual && (
                        <span className="absolute -top-2.5 left-3 text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                          Plan actual
                        </span>
                      )}
                      {s.featured && !esActual && (
                        <span className="absolute -top-2.5 left-3 text-[10px] font-black bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-1 ${s.badge}`}>{p.tipo}</span>
                          <p className="text-white font-bold text-sm leading-tight">{p.nombre}</p>
                        </div>
                        {sel && <Check size={16} className="text-emerald-300 shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-white font-black text-xl">
                        ${Number(p.precio).toFixed(2)}
                        <span className="text-white/40 text-xs font-normal">/{p.periodo.toLowerCase()}</span>
                      </p>
                      <p className="text-white/50 text-xs mt-1.5">
                        {p.facturas_mensuales === -1 ? 'Docs ilimitados' : `${p.facturas_mensuales} docs/período`}
                        {' · '}
                        {p.usuarios_permitidos === -1 ? 'Usuarios ilimitados' : `${p.usuarios_permitidos} usuario${p.usuarios_permitidos !== 1 ? 's' : ''}`}
                      </p>
                    </button>
                  );
                })}
              </div>

              {errorCambio && (
                <p className="mt-3 text-red-300 text-xs">
                  {(errorCambio as any)?.response?.data?.error ?? 'Error al cambiar el plan. Intenta de nuevo.'}
                </p>
              )}

              <div className="flex justify-end mt-5 gap-3">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setSeleccionado(null); }}
                  className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!seleccionado || isPending}
                  onClick={() => seleccionado && cambiar(seleccionado)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors"
                >
                  {isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Cambiando…</>
                    : <><Check size={14} /> Confirmar cambio</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function BienvenidaPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: suscripcion } = useQuery<Suscripcion | null>({
    queryKey: ['suscripcion-activa'],
    queryFn: suscripcionesService.getSuscripcionActiva,
    retry: false,
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(user?.empresa_id),
  });

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
              Tu cuenta fue creada exitosamente. Completa la configuración para empezar a facturar electrónicamente y controlar tu negocio.
            </p>

            {/* Trial highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Clock className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">Demo guiada</p>
                <p className="text-blue-200 text-xs">acompañamiento para iniciar correctamente</p>
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

          {/* Tarjeta suscripción activa */}
          {suscripcion && <SuscripcionCard suscripcion={suscripcion} />}

        </div>

        {/* ── Módulos del sistema ────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-white mb-1">Todo lo que necesita tu negocio</h2>
            <p className="text-white/50 text-sm">Módulos disponibles para facturar y controlar tu operación</p>
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
            href="https://wa.me/593991840854?text=Hola%2C%20necesito%20ayuda%20con%20OF1%20Solutions"
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
