import { MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '593995298989';
const HELP_MESSAGE = 'Hola, necesito ayuda sobre el ERP o firma electrónica.';

export default function WhatsAppHelpWidget() {
  const whatsappUrl = `https://api.whatsapp.com/send/?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(HELP_MESSAGE)}&type=phone_number&app_absent=0`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Chatear por WhatsApp"
      className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-3 rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 sm:bottom-6 sm:right-6"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
        <MessageCircle size={21} />
      </span>
      <span className="hidden leading-tight sm:block">
        Necesito ayuda
        <span className="block text-xs font-semibold text-emerald-50">ERP o firma electrónica</span>
      </span>
    </a>
  );
}
