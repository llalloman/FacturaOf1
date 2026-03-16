import { Link } from 'react-router-dom';
import { Play, ArrowRight } from 'lucide-react';

export default function CtaDemoSection() {
  return (
    <section id="demo" className="py-24 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Label */}
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-bold px-3.5 py-1.5 rounded-full mb-6 uppercase tracking-widest">
          <Play className="w-3 h-3" fill="currentColor" />
          Demo del sistema
        </div>

        <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
          Conoce FacturaOF1
          <br />
          <span className="text-blue-600">antes de contratar</span>
        </h2>

        <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
          Explora la plataforma y descubre cómo simplificar la facturación
          electrónica, las ventas y el control de inventario de tu negocio.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:soporte@of1.ec?subject=Solicitud%20de%20Demo%20FacturaOF1"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 border-2 border-blue-600 text-blue-700 font-bold text-base rounded-xl hover:bg-blue-50 transition-all"
          >
            <Play className="w-4 h-4" />
            Solicitar demo
          </a>
          <Link
            to="/registro"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 transition-all hover:-translate-y-px"
          >
            Probar gratis 30 días
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-16 pt-12 border-t border-slate-200">
          {[
            { value: '100%', label: 'Compatible SRI' },
            { value: '30 días', label: 'Prueba gratuita' },
            { value: '24/7', label: 'Disponibilidad' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl lg:text-4xl font-black text-slate-900 mb-1">{stat.value}</div>
              <div className="text-slate-500 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
