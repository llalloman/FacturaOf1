import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight,
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Star,
} from 'lucide-react';

const BENEFITS = [
  'Facturación electrónica aprobada por el SRI',
  'Control de inventario en tiempo real',
  'Punto de venta rápido y sencillo',
  'Administra múltiples empresas',
  'Reportes y métricas clave',
];

function DashboardMock() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur-3xl transform scale-110" />

      {/* Main card */}
      <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-2xl">
        {/* topbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded-full" />
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <div className="w-3 h-3 bg-green-400 rounded-full" />
          </div>
          <div className="text-white/50 text-xs font-mono">facturacion.of1.ec</div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Ventas hoy', value: '$1,842', icon: BarChart3, color: 'from-emerald-400 to-teal-500' },
            { label: 'Facturas', value: '38', icon: ReceiptText, color: 'from-blue-400 to-indigo-500' },
            { label: 'Documentos', value: '142', icon: ShoppingCart, color: 'from-violet-400 to-purple-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 rounded-xl p-3">
              <div className={`w-7 h-7 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center mb-2`}>
                <stat.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="text-white font-bold text-base leading-none">{stat.value}</div>
              <div className="text-white/50 text-[10px] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Chart mock */}
        <div className="bg-white/10 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/70 text-xs font-medium">Ventas últimos 7 días</span>
            <span className="text-emerald-400 text-xs font-bold">+18.4%</span>
          </div>
          <div className="flex items-end gap-1.5 h-14">
            {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Recent invoices */}
        <div className="space-y-2">
          <div className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-2">
            Facturas recientes
          </div>
          {[
            { name: 'Tienda La Esperanza', amount: '$245.00', status: 'Autorizada' },
            { name: 'Ferretería Andina', amount: '$89.50', status: 'Autorizada' },
            { name: 'Minimarket El Sol', amount: '$512.30', status: 'Pendiente' },
          ].map((inv) => (
            <div key={inv.name} className="flex items-center justify-between py-1.5 border-b border-white/10 last:border-0">
              <span className="text-white/80 text-xs">{inv.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-xs">{inv.amount}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    inv.status === 'Autorizada'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}
                >
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/30 flex items-center gap-1.5">
        <Star className="w-3 h-3" fill="currentColor" />
        Conectado al SRI
      </div>
      <div className="absolute -bottom-4 -left-4 bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Firma disponible
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 pt-16"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-3xl" />
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Pensado para negocios en Ecuador
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight mb-4">
              Todo lo que necesitas para facturar electrónicamente y controlar tu negocio
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-lg">
              FacturaOF1 ERP integra facturación electrónica SRI, punto de venta,
              inventario, clientes, cartera y reportes. Si aún no tienes firma
              electrónica, también te acompañamos en la solicitud.
            </p>

            {/* Benefit list */}
            <ul className="space-y-2.5 mb-10">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-3 text-slate-200 text-sm">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/solicitar-demo"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base rounded-xl shadow-xl shadow-blue-700/30 hover:shadow-blue-500/40 transition-all hover:-translate-y-px"
              >
                Solicitar demostración del ERP
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/registro"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/20 text-white/90 hover:text-white hover:bg-white/10 font-semibold text-base rounded-xl transition-all"
              >
                Quiero empezar a facturar
              </Link>
            </div>

            <p className="text-slate-500 text-xs mt-4">
              Pensado para Ecuador · Compatible con procesos del SRI · Soporte personalizado · Firma electrónica disponible
            </p>
            <Link to="/solicitar-firma-electronica" className="mt-3 inline-flex text-sm font-semibold text-blue-300 hover:text-blue-200">
              ¿Solo necesitas firma electrónica?
            </Link>
          </div>

          {/* Right: dashboard mock */}
          <div className="flex justify-center lg:justify-end">
            <DashboardMock />
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" className="fill-white w-full block">
          <path d="M0,60 C360,0 1080,60 1440,20 L1440,60 Z" />
        </svg>
      </div>
    </section>
  );
}
