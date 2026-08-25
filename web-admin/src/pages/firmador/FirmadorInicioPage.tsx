import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileSignature, LogOut, PenLine, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function FirmadorInicioPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const displayName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email || 'Usuario';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-12 w-auto rounded-xl bg-white p-2" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">OF1 Firmador</p>
              <h1 className="text-lg font-black">Inicio</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10"
            aria-label="Cerrar sesion"
            title="Cerrar sesion"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="mb-8">
            <p className="text-sm text-slate-400">Hola,</p>
            <h2 className="mt-1 text-3xl font-black leading-tight">{displayName}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Elige que deseas hacer. Puedes firmar tus documentos, solicitar una firma electronica o entrar al ERP.
            </p>
          </div>

          <div className="grid gap-4">
            <MenuAction
              to="/firmador"
              icon={FileSignature}
              title="Ingresar a firmar"
              description="Sube tu certificado, selecciona un PDF y genera el documento firmado."
              tone="emerald"
            />
            <MenuAction
              to="/solicitar-firma-electronica"
              icon={PenLine}
              title="Solicitar firma electronica"
              description="Compra o solicita tu certificado de firma electronica con OF1."
              tone="blue"
            />
            <MenuAction
              to="https://facturaof1.of1solutions.com"
              icon={Building2}
              title="Ingresar al ERP"
              description="Abre FacturaOF1 para facturacion, ventas, inventario y administracion."
              tone="slate"
            />
          </div>
        </div>

        <footer className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
            <p className="text-xs leading-5 text-slate-300">
              La app usa el backend oficial de OF1. Si ves errores de conexion, revisa internet o la disponibilidad del servicio.
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}

function MenuAction({
  to,
  icon: Icon,
  title,
  description,
  tone,
}: {
  to: string;
  icon: ElementType;
  title: string;
  description: string;
  tone: 'emerald' | 'blue' | 'slate';
}) {
  const toneClass = {
    emerald: 'bg-emerald-400 text-slate-950',
    blue: 'bg-blue-500 text-white',
    slate: 'bg-white text-slate-950',
  }[tone];

  const content = (
    <div className="flex items-center gap-4">
      <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-black text-white">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
      </div>
    </div>
  );
  const className = 'group rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:border-white/20 hover:bg-white/[0.1]';

  if (to.startsWith('http')) {
    return (
      <a href={to} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link
      to={to}
      className={className}
    >
      {content}
    </Link>
  );
}
