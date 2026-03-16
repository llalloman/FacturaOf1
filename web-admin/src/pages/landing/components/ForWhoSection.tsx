import {
  ShoppingBag,
  Warehouse,
  Wine,
  Hammer,
  UtensilsCrossed,
  Briefcase,
} from 'lucide-react';

const WHO = [
  {
    icon: ShoppingBag,
    title: 'Tiendas',
    description: 'Gestiona ventas, facturas y stock de tu tienda desde una sola herramienta.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    icon: Warehouse,
    title: 'Minimarkets',
    description: 'POS ágil + inventario para atender rápido y mantener control del stock.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Wine,
    title: 'Licorerías',
    description: 'Control de productos, facturación electrónica y reportes de ventas.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Hammer,
    title: 'Ferreterías',
    description: 'Administra cientos de productos, genera facturas y cotizaciones fácilmente.',
    color: 'from-orange-500 to-amber-600',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurantes pequeños',
    description: 'Pedidos, caja y facturas electrónicas todas integradas en una plataforma.',
    color: 'from-rose-500 to-pink-600',
  },
  {
    icon: Briefcase,
    title: 'Emprendedores y PyMEs',
    description: 'Comienza con el plan gratis y crece sin cambiar de sistema.',
    color: 'from-cyan-500 to-sky-600',
  },
];

export default function ForWhoSection() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">
            ¿Para quién es?
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Diseñado para negocios ecuatorianos
          </h2>
          <p className="text-slate-500 text-lg">
            Cualquier negocio que necesite facturar electrónicamente y llevar
            un control ordenado puede usar FacturaOF1.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {WHO.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-start gap-4"
            >
              <div
                className={`flex-shrink-0 w-11 h-11 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow`}
              >
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-base mb-1">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
