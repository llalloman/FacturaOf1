import { Link } from 'react-router-dom';
import { Mail, Phone, Twitter, Linkedin, Instagram } from 'lucide-react';

const FOOTER_LINKS = {
  Producto: [
    { label: 'Funcionalidades', href: '#funcionalidades' },
    { label: 'Planes y precios', href: '#planes' },
    { label: 'Demo', href: '#demo' },
  ],
  Empresa: [
    { label: 'Acerca de nosotros', href: '#contacto' },
    { label: 'Contacto', href: '#contacto' },
    { label: 'Blog', href: '#' },
  ],
  Legal: [
    { label: 'Términos y Condiciones', href: '/terminos-y-condiciones' },
    { label: 'Política de Privacidad', href: '/politica-privacidad' },
    { label: 'Seguridad', href: '/politica-privacidad#seguridad' },
  ],
  Soporte: [
    { label: 'Centro de ayuda', href: '#' },
    { label: 'Documentación', href: '#' },
    { label: 'Estado del sistema', href: '#' },
  ],
};

const SOCIAL = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Instagram, href: '#', label: 'Instagram' },
];

export default function LandingFooter() {
  const scrollTo = (href: string) => {
    if (href.startsWith('#') && href.length > 1) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer id="contacto" className="bg-slate-900 text-slate-300">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-5 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <img
                src="/logo-of1-1.png"
                alt="FacturaOF1 ERP"
                className="h-10 w-auto object-contain brightness-0 invert"
              />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xs">
              Sistema SaaS de facturación electrónica, inventario y punto de venta
              para negocios ecuatorianos. Conectado al SRI.
            </p>

            {/* Contact */}
            <div className="space-y-2.5">
              <a
                href="mailto:info@of1solutions.com"
                className="flex items-center gap-2.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <Mail className="w-4 h-4 text-blue-500" />
                info@of1solutions.com
              </a>
              <a
                href="tel:+593995298989"
                className="flex items-center gap-2.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <Phone className="w-4 h-4 text-blue-500" />
                +593 99 529 8989
              </a>
            </div>

            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-9 h-9 bg-slate-800 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('#') ? (
                      <button
                        onClick={() => scrollTo(link.href)}
                        className="text-slate-400 hover:text-white text-sm transition-colors"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-slate-400 hover:text-white text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} OF1 Solutions S.A.S. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              Iniciar sesión
            </Link>
            <Link to="/solicitar-demo" className="text-blue-500 hover:text-blue-400 text-xs font-semibold transition-colors">
              Solicitar demostración →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
