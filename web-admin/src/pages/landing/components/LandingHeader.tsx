import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Planes', href: '#planes' },
  { label: 'Demo', href: '#demo' },
  { label: 'Contacto', href: '#contacto' },
];

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">

          {/* Logo */}
          <button
            onClick={() => scrollTo('#inicio')}
            className="flex items-center gap-2 group"
          >
            <img
              src="/logo-of1-1.png"
              alt="FacturaOF1 ERP"
              className={`h-10 w-auto object-contain drop-shadow-md group-hover:scale-105 transition-all duration-300 ${
                scrolled ? '' : 'brightness-0 invert'
              }`}
            />
          </button>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  scrolled
                    ? 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* CTA desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                scrolled
                  ? 'text-slate-700 hover:text-blue-700 hover:bg-blue-50'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              Iniciar sesión
            </Link>
            <Link
              to="/solicitar-demo"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-blue-500/30 transition-all hover:-translate-y-px"
            >
              Solicitar demostración
            </Link>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`lg:hidden p-2 rounded-lg transition-colors ${
              scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
            }`}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden transition-all duration-300 overflow-hidden ${
          menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-white border-t border-slate-100 px-4 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="block w-full text-left px-3 py-2.5 text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
            >
              {link.label}
            </button>
          ))}
          <div className="pt-3 pb-1 flex flex-col gap-2 border-t border-slate-100 mt-2">
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="block w-full text-center py-2.5 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/solicitar-demo"
              onClick={() => setMenuOpen(false)}
              className="block w-full text-center py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              Solicitar demostración
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
