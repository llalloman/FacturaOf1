import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSignature,
  Loader2,
  Lock,
  Mail,
  Shield,
  User,
  UserPlus,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

const firmadorTermsVersion = 'terminos-2026-08-24';
const firmadorPrivacyVersion = 'privacidad-2026-08-24';

export default function RegistroFirmadorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({
    email: searchParams.get('email') ?? '',
    password: '',
    confirm_password: '',
    nombre: '',
    apellido: '',
    accepted_terms: false,
    accepted_privacy: false,
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!form.accepted_terms || !form.accepted_privacy) {
      setError('Debes aceptar los términos y la política de privacidad para crear tu cuenta.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.registroFirmador({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        accepted_terms: form.accepted_terms,
        accepted_privacy: form.accepted_privacy,
        terms_version: firmadorTermsVersion,
        privacy_version: firmadorPrivacyVersion,
      });
      setAuth(response.user, response.access, response.refresh);
      navigate(response.user.email_verificado ? '/firmador' : '/verificar-email', { replace: true });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string; error?: string; email?: string[] } } };
      setError(
        axiosError.response?.data?.detail ||
        axiosError.response?.data?.error ||
        axiosError.response?.data?.email?.[0] ||
        'No se pudo crear la cuenta.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="grid min-h-screen lg:grid-cols-[0.82fr_1fr]">
        <aside className="hidden bg-[#172b4d] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <BrandMark mode="Firmador" dark />

            <div className="mt-16 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
              <FileSignature className="h-4 w-4" />
              Firmador PDF
            </div>
            <h1 className="mt-8 max-w-sm text-4xl font-black leading-tight">
              Crea tu cuenta de OF1 Firmador
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-blue-100">
              Una cuenta independiente para firmar, guardar y validar documentos PDF sin crear una empresa en el ERP.
            </p>
          </div>

          <div className="space-y-5 border-t border-white/15 pt-8">
            <SideBenefit icon={Shield} title="Certificados protegidos" text="Tus archivos se almacenan cifrados y la clave no se guarda." />
            <SideBenefit icon={CheckCircle2} title="Cuenta para firmador" text="Acceso directo al firmador PDF y al historial de documentos." />
            <SideBenefit icon={FileSignature} title="Validación QR" text="Genera enlaces verificables cuando guardas una copia del documento." />
          </div>
        </aside>

        <div className="flex items-center justify-center px-5 py-8">
          <form onSubmit={handleSubmit} className="w-full max-w-md">
            <div className="mb-7">
              <div className="flex items-center justify-between gap-4">
                <BrandMark mode="Firmador" />
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">
                  <ArrowLeft className="h-4 w-4" />
                  Iniciar sesión
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-700">
                <FileSignature className="h-4 w-4" />
                OF1 Firmador
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-950">Crear cuenta</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Usa estos datos para ingresar al firmador PDF de OF1 Solutions.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-3.5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Field label="Correo electrónico" icon={Mail}>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="correo@empresa.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  spellCheck={false}
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombres" icon={User}>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(event) => updateField('nombre', event.target.value)}
                    placeholder="Juan"
                    autoComplete="given-name"
                    className={inputClass}
                  />
                </Field>
                <Field label="Apellidos">
                  <input
                    type="text"
                    required
                    value={form.apellido}
                    onChange={(event) => updateField('apellido', event.target.value)}
                    placeholder="Pérez"
                    autoComplete="family-name"
                    className={plainInputClass}
                  />
                </Field>
              </div>

              <Field label="Contraseña" icon={Lock}>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className={`${inputClass} pr-12`}
                />
                <PasswordToggle show={showPass} onClick={() => setShowPass((value) => !value)} />
              </Field>

              <Field label="Confirmar contraseña" icon={Lock}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={form.confirm_password}
                  onChange={(event) => updateField('confirm_password', event.target.value)}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  className={`${inputClass} pr-12 ${
                    form.confirm_password && form.confirm_password !== form.password
                      ? 'border-red-300 focus:ring-red-400'
                      : ''
                  }`}
                />
                <PasswordToggle show={showConfirm} onClick={() => setShowConfirm((value) => !value)} />
              </Field>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.accepted_terms}
                  onChange={(event) => updateField('accepted_terms', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                />
                <span>
                  Acepto los{' '}
                  <Link to="/terminos-y-condiciones" target="_blank" className="font-bold text-blue-700 hover:underline">
                    Términos y Condiciones
                  </Link>{' '}
                  de OF1 Firmador.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.accepted_privacy}
                  onChange={(event) => updateField('accepted_privacy', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                />
                <span>
                  Autorizo el tratamiento de mis datos personales conforme a la{' '}
                  <Link to="/politica-privacidad" target="_blank" className="font-bold text-blue-700 hover:underline">
                    Política de Privacidad
                  </Link>
                  , incluyendo el uso del servicio OF1 Firmador.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {loading ? 'Creando cuenta...' : 'Crear cuenta de firmador'}
            </button>

            <p className="mt-5 text-center text-sm text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-bold text-blue-700 hover:text-blue-900">
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500';

const plainInputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500';

function BrandMark({ mode, dark = false }: { mode: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl ${dark ? 'bg-white' : 'border border-slate-200 bg-white shadow-sm'}`}>
        <img src="/logo-of1-1.png" alt="FacturaOF1" className="h-full w-full object-contain p-1" />
      </div>
      <div>
        <p className={`text-lg font-black leading-tight ${dark ? 'text-white' : 'text-slate-950'}`}>FacturaOF1</p>
        <p className={`text-xs font-bold uppercase tracking-wide ${dark ? 'text-blue-300' : 'text-blue-600'}`}>
          {mode}
        </p>
      </div>
    </div>
  );
}

function SideBenefit({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-blue-200">{text}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        {children}
      </div>
    </label>
  );
}

function PasswordToggle({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
