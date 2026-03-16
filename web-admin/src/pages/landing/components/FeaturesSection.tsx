import { ReceiptText, Package, ShoppingCart, BarChart3, Building2, CreditCard } from 'lucide-react';

const FEATURES = [
  {
    icon: ReceiptText,
    title: 'Facturación electrónica',
    description:
      'Emite facturas, notas de crédito, debito, retenciones y guías de remisión directamente conectado al SRI.',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: Package,
    title: 'Inventario',
    description:
      'Control de stock, productos, bodegas y movimientos. Alertas de inventario bajo con reportes de rotación.',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: ShoppingCart,
    title: 'Punto de venta POS',
    description:
      'Interfaz de cobro rápida e intuitiva. Ideal para caja en tiendas, restaurantes y minimarkets.',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: BarChart3,
    title: 'Reportes y métricas',
    description:
      'Consulta ventas por período, productos más vendidos, ingresos y métricas clave del negocio en tiempo real.',
    color: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
  {
    icon: Building2,
    title: 'Multiempresa',
    description:
      'Administra una o varias empresas desde una sola plataforma con una única cuenta de administrador.',
    color: 'from-cyan-500 to-sky-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-100',
  },
  {
    icon: CreditCard,
    title: 'Suscripciones flexibles',
    description:
      'Elige el plan que mejor se adapta a tu tamaño. Desde emprendedores hasta empresas con múltiples sucursales.',
    color: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Caption */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">
            Funcionalidades
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Todo lo que tu negocio necesita
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed">
            Una plataforma completa que reemplaza múltiples herramientas. Desde la
            factura hasta el control de inventario y ventas.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat) => (
            <div
              key={feat.title}
              className={`group relative p-6 rounded-2xl border ${feat.border} ${feat.bg} hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
            >
              <div
                className={`w-12 h-12 bg-gradient-to-br ${feat.color} rounded-xl flex items-center justify-center mb-4 shadow-md`}
              >
                <feat.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-2">{feat.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{feat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
