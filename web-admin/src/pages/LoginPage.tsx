import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FileSignature, Loader2, Lock, Mail, UserPlus } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const isFirmadorApp = import.meta.env.VITE_APP_TARGET === 'firmador';
  const isFirmadorHost = typeof window !== 'undefined' && window.location.hostname.startsWith('firmador.');
  const isFirmadorMode = isFirmadorHost || isFirmadorApp;
  const registroPath = isFirmadorMode ? '/firmador/registro' : '/registro';
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);

  const product = isFirmadorMode
    ? {
        badge: 'Firmador PDF',
        title: 'Ingresa a OF1 Firmador',
        subtitle: 'Firma, guarda y valida documentos PDF con certificado electrónico.',
        registerCta: 'Crear cuenta de firmador',
        registerHint: 'Cuenta independiente para firmar documentos.',
        icon: FileSignature,
      }
    : {
        badge: 'FacturaOF1 ERP',
        title: 'Ingresa a FacturaOF1',
        subtitle: 'Factura electrónica, inventario, ventas y gestión de negocio.',
        registerCta: 'Registrar empresa',
        registerHint: 'Empieza con una cuenta para tu negocio.',
        icon: UserPlus,
      };
  const ProductIcon = product.icon;

  const resetTransientErrors = () => {
    setError('');
    setNotFound(false);
    setWrongPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetTransientErrors();
    setLoading(true);

    try {
      const response = await authService.login({ email, password });
      const user = response.user;
      setAuth(user, response.access, response.refresh);

      if (user.debe_cambiar_password) {
        navigate('/cambiar-password');
      } else if (!user.email_verificado) {
        navigate('/verificar-email');
      } else if (isFirmadorMode) {
        navigate('/firmador/inicio');
      } else if (user.rol === 'FIRMADOR') {
        navigate('/firmador');
      } else if (user.rol === 'SUPER_ADMIN') {
        navigate('/');
      } else if (from && from !== '/login' && from !== '/registro' && from !== '/firmador/registro') {
        navigate(from);
      } else if (user.onboarding_completado) {
        navigate('/');
      } else {
        navigate('/bienvenida');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.detail || '';
      const detailLower = detail.toLowerCase();
      if (detailLower.includes('no active account') || detailLower.includes('no existe') || detailLower.includes('no encontr')) {
        setNotFound(true);
      } else if (status === 401) {
        setWrongPassword(true);
      } else {
        setError(detail || 'Error al iniciar sesion. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="hidden bg-blue-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <img src="/logo-of1-1.png" alt="FacturaOF1" className="h-14 w-auto rounded-xl bg-white object-contain p-2" />
              <div className="mt-10 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
                <ProductIcon className="h-4 w-4" />
                {product.badge}
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight">{product.title}</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-blue-100">{product.subtitle}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-sm font-bold">No tienes cuenta?</p>
              <p className="mt-1 text-xs text-blue-100">{product.registerHint}</p>
              <Link
                to={registroPath}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-900 hover:bg-blue-50"
              >
                <UserPlus className="h-4 w-4" />
                {product.registerCta}
              </Link>
            </div>
          </aside>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mb-7">
              <div className="flex items-center justify-between gap-4">
                <img src="/logo-of1-1.png" alt="FacturaOF1" className="h-14 w-auto object-contain lg:hidden" />
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  <ProductIcon className="h-3.5 w-3.5" />
                  {product.badge}
                </span>
              </div>
              <h2 className="mt-6 text-2xl font-black text-slate-950">Iniciar sesion</h2>
              <p className="mt-1 text-sm text-slate-500">{product.subtitle}</p>
            </div>

            {notFound ? (
              <StatePanel
                icon={<AlertCircle className="h-7 w-7 text-amber-500" />}
                title="Cuenta no encontrada"
                text={`No existe una cuenta registrada con ${email}.`}
                primaryLabel={product.registerCta}
                onPrimary={() => navigate(`${registroPath}?email=${encodeURIComponent(email)}`)}
                secondaryLabel="Intentar con otro correo"
                onSecondary={() => resetTransientErrors()}
              />
            ) : wrongPassword ? (
              <StatePanel
                icon={<Lock className="h-7 w-7 text-red-500" />}
                title="Contrasena incorrecta"
                text={`La contrasena ingresada no corresponde a ${email}.`}
                primaryLabel="Intentar nuevamente"
                onPrimary={() => {
                  setWrongPassword(false);
                  setPassword('');
                }}
                secondaryLabel="Recuperar contrasena"
                secondaryTo="/recuperar-password"
              />
            ) : (
              <>
                {error && (
                  <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-3.5">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field label="Correo electronico" icon={<Mail className="h-4 w-4" />}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </Field>

                  <Field label="Contrasena" icon={<Lock className="h-4 w-4" />}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      placeholder="Ingresa tu contrasena"
                      required
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                    {loading ? 'Iniciando sesion...' : 'Iniciar sesion'}
                  </button>
                </form>

                <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center sm:grid-cols-[1fr_auto] sm:text-left">
                  <div>
                    <p className="text-sm font-bold text-slate-900">No tienes cuenta?</p>
                    <p className="text-xs text-slate-500">{product.registerHint}</p>
                  </div>
                  <Link
                    to={registroPath}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    {product.registerCta}
                  </Link>
                </div>

                <p className="mt-4 text-center text-sm">
                  <Link to="/recuperar-password" className="font-semibold text-blue-700 hover:text-blue-900">
                    Olvidaste tu contrasena?
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500';

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function StatePanel({
  icon,
  title,
  text,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  secondaryTo,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary?: () => void;
  secondaryTo?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">{icon}</div>
      <h2 className="mt-4 text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 break-words text-sm text-slate-500">{text}</p>
      <button
        type="button"
        onClick={onPrimary}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800"
      >
        <UserPlus className="h-4 w-4" />
        {primaryLabel}
      </button>
      {secondaryTo ? (
        <Link
          to={secondaryTo}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          {secondaryLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSecondary}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
