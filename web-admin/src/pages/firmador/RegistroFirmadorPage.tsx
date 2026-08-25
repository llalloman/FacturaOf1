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
      setError('Debes aceptar los terminos y la politica de privacidad para crear tu cuenta.');
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
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid max-h-[calc(100vh-3rem)] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden border-r border-slate-100 bg-blue-950 p-7 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <img src="/logo-of1-1.png" alt="FacturaOF1" className="h-14 w-auto rounded-xl bg-white object-contain p-2" />
              <div className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                <FileSignature className="h-7 w-7" />
              </div>
              <h1 className="mt-5 text-2xl font-black leading-tight">
                Crea tu cuenta de OF1 Firmador
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-blue-100">
                Acceso independiente para firmar documentos PDF con certificado electrónico, sin crear una empresa en el ERP.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <Shield className="h-5 w-5 text-blue-100" />
                <span className="text-sm font-semibold text-white">Certificados protegidos</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-blue-100" />
                <span className="text-sm font-semibold text-white">Cuenta solo para firmador</span>
              </div>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between gap-4">
                <img src="/logo-of1-1.png" alt="FacturaOF1" className="h-14 w-auto object-contain lg:hidden" />
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                  <ArrowLeft className="h-4 w-4" />
                  Iniciar sesión
                </Link>
              </div>
              <div className="mt-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  <FileSignature className="h-3.5 w-3.5" />
                  OF1 Firmador
                </span>
                <h2 className="mt-4 text-2xl font-black text-slate-950">Registro de usuario</h2>
                <p className="mt-1 text-sm text-slate-500">Usa estos datos para ingresar al firmador PDF de OF1 Solutions.</p>
              </div>
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
              <Field label="Correo electrónico *" icon={Mail}>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="tu@correo.com"
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombres *" icon={User}>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(event) => updateField('nombre', event.target.value)}
                    placeholder="Juan"
                    className={inputClass}
                  />
                </Field>
                <Field label="Apellidos *">
                  <input
                    type="text"
                    required
                    value={form.apellido}
                    onChange={(event) => updateField('apellido', event.target.value)}
                    placeholder="Perez"
                    className={plainInputClass}
                  />
                </Field>
              </div>

              <Field label="Contraseña *" icon={Lock}>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Min. 8 caracteres"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>

              <Field label="Confirmar contraseña *" icon={Lock}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={form.confirm_password}
                  onChange={(event) => updateField('confirm_password', event.target.value)}
                  placeholder="Repite la contraseña"
                  className={`${inputClass} pr-10 ${
                    form.confirm_password && form.confirm_password !== form.password
                      ? 'border-red-300 focus:ring-red-400'
                      : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirm ? 'Ocultar confirmacion' : 'Mostrar confirmacion'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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
                    Terminos y Condiciones
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
                    Politica de Privacidad
                  </Link>
                  , incluyendo el uso del servicio OF1 Firmador.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-800 hover:to-blue-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              Crear cuenta de firmador
            </button>

            <p className="mt-5 text-center text-xs text-slate-500">
              Ya tienes cuenta?{' '}
              <Link to="/login" className="font-bold text-blue-700 hover:text-blue-900">
                Inicia sesión
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500';

const plainInputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500';

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
