import {
  ShieldCheck,
  CalendarCheck,
  CreditCard,
  HeadphonesIcon,
  RefreshCw,
  Lock,
} from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Conectado al SRI',
    description: 'Integración oficial con el Servicio de Rentas Internas del Ecuador para comprobantes electrónicos.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: CalendarCheck,
    title: 'Demo guiada',
    description: 'Agenda una demostración gratuita para conocer el flujo de facturación y control del negocio.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: CreditCard,
    title: 'Firma electrónica disponible',
    description: 'Acompañamiento para solicitar la firma electrónica requerida para emitir comprobantes.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: HeadphonesIcon,
    title: 'Soporte incluido',
    description: 'Equipo de soporte disponible para ayudarte a configurar y sacarle el máximo al sistema.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: RefreshCw,
    title: 'Actualizaciones continuas',
    description: 'La plataforma se actualiza constantemente con nuevas funcionalidades y mejoras de rendimiento.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    icon: Lock,
    title: 'Datos seguros',
    description: 'Tu información está protegida con cifrado de extremo a extremo y backups automáticos diarios.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
];

export default function TrustSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">
            Por qué elegirnos
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Confianza y transparencia
          </h2>
          <p className="text-slate-500 text-lg">
            Construido para ser el aliado tecnológico de tu negocio. Confiable, seguro y siempre actualizado.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 p-5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-300"
            >
              <div className={`flex-shrink-0 w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-sm mb-1">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
