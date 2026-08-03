import { useMemo, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const WHATSAPP_NUMBER = '593991840854';
const HELP_MESSAGE = 'Hola, necesito ayuda sobre el ERP o firma electronica.';

const HIDDEN_ROUTES = [
  '/pos',
  '/ventas',
  '/facturacion',
  '/productos',
  '/pedidos',
  '/cotizaciones',
  '/guias-remision',
  '/notas-credito',
  '/notas-debito',
  '/solicitar-firma-electronica',
  '/solicitar-demo',
  '/login',
  '/registro',
  '/onboarding',
];

const STORAGE_KEY = 'of1_help_widget_open';

export default function WhatsAppHelpWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  const shouldHide = useMemo(
    () => HIDDEN_ROUTES.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`)),
    [location.pathname],
  );

  const whatsappUrl = `https://api.whatsapp.com/send/?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(HELP_MESSAGE)}&type=phone_number&app_absent=0`;

  const toggleOpen = () => {
    setIsOpen((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  if (shouldHide) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen && (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-emerald-100 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/15">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">Necesito ayuda</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Te atendemos por WhatsApp para consultas sobre ERP, facturacion o firma electronica.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleOpen}
              aria-label="Ocultar ayuda"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X size={17} />
            </button>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <MessageCircle size={18} />
            Escribir por WhatsApp
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Ocultar ayuda' : 'Necesito ayuda'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
