import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, FileSignature, PenLine, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function FirmadorInicioPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const firmarTo = isAuthenticated ? '/firmador' : '/login';
  const firmarState = isAuthenticated ? undefined : { from: '/firmador' };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section
        className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5"
        style={{
          paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        <header className="flex items-center justify-between gap-4">
          <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-11 w-auto object-contain" />
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
            Firmador
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="mb-8">
            <p className="text-sm font-bold text-blue-700">OF1 Firmador</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950">
              ¿Qué deseas hacer?
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Elige una acción para continuar. Solo se pedirá usuario cuando necesites ingresar a firmar.
            </p>
          </div>

          <div className="grid gap-3">
            <MenuAction
              to={firmarTo}
              state={firmarState}
              icon={FileSignature}
              title="Ingresar a firmar"
              description="Accede con tu usuario para firmar documentos PDF."
              tone="blue"
            />
            <MenuAction
              to="/solicitar-firma-electronica"
              icon={PenLine}
              title="Solicitar firma"
              description="Pide tu certificado de firma electrónica sin iniciar sesión."
              tone="emerald"
            />
            <MenuAction
              to="https://facturaof1.of1solutions.com"
              icon={Building2}
              title="Ingresar al ERP"
              description="Abre FacturaOF1 para facturación, inventario y ventas."
              tone="slate"
            />
          </div>
        </div>

        <footer className="flex items-start gap-3 border-t border-slate-200 pt-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-xs leading-5 text-slate-500">
            La app usa los servicios oficiales de OF1 Solutions.
          </p>
        </footer>
      </section>
    </main>
  );
}

function MenuAction({
  to,
  state,
  icon: Icon,
  title,
  description,
  tone,
}: {
  to: string;
  state?: { from: string };
  icon: ElementType;
  title: string;
  description: string;
  tone: 'blue' | 'emerald' | 'slate';
}) {
  const toneClass = {
    blue: 'bg-blue-700 text-white',
    emerald: 'bg-emerald-600 text-white',
    slate: 'bg-slate-900 text-white',
  }[tone];

  const content = (
    <>
      <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-slate-950">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" />
    </>
  );
  const className =
    'flex min-h-[5.5rem] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-slate-300 hover:shadow-md';

  if (to.startsWith('http')) {
    return (
      <a href={to} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} state={state} className={className}>
      {content}
    </Link>
  );
}
