import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { useQuery } from '@tanstack/react-query';
import { suscripcionesService } from '../services/suscripcionesService';
import type { PlanSuscripcion } from '../types';
import type { ReactElement } from 'react';
import {
  FileText,
  Building2,
  User,
  Lock,
  Mail,
  Phone,
  CreditCard,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Star,
  Zap,
  Shield,
  BarChart3,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planFeatureIcon(key: string) {
  const icons: Record<string, ReactElement> = {
    soporte_prioritario: <Star className="w-4 h-4" />,
    api_access: <Zap className="w-4 h-4" />,
    reportes_avanzados: <BarChart3 className="w-4 h-4" />,
  };
  return icons[key] ?? <CheckCircle2 className="w-4 h-4" />;
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanSuscripcion;
  selected: boolean;
  onSelect: () => void;
}) {
  const gradients: Record<string, string> = {
    BASICO: 'from-slate-500 to-slate-700',
    PROFESIONAL: 'from-blue-500 to-blue-700',
    EMPRESARIAL: 'from-sky-500 to-sky-800',
    ILIMITADO: 'from-amber-500 to-orange-700',
  };
  const gradient = gradients[plan.tipo] ?? 'from-gray-500 to-gray-700';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
        selected
          ? 'border-blue-600 shadow-lg shadow-blue-100 scale-[1.01]'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <CheckCircle2 className="w-5 h-5 text-blue-700" />
        </div>
      )}
      <div className={`bg-gradient-to-r ${gradient} p-4 text-white`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{plan.tipo}</p>
        <p className="text-lg font-black">{plan.nombre}</p>
        <p className="text-2xl font-black mt-1">
          ${plan.precio}
          <span className="text-sm font-medium opacity-80">/{plan.periodo.toLowerCase()}</span>
        </p>
      </div>
      <div className="p-4 space-y-2 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <FileText className="w-4 h-4 text-gray-400" />
          {plan.facturas_mensuales === 0
            ? 'Facturas ilimitadas'
            : `${plan.facturas_mensuales} facturas/mes`}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User className="w-4 h-4 text-gray-400" />
          {plan.usuarios_permitidos === 0
            ? 'Usuarios ilimitados'
            : `${plan.usuarios_permitidos} usuario${plan.usuarios_permitidos !== 1 ? 's' : ''}`}
        </div>
        {plan.soporte_prioritario && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            {planFeatureIcon('soporte_prioritario')}
            Soporte prioritario
          </div>
        )}
        {plan.reportes_avanzados && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            {planFeatureIcon('reportes_avanzados')}
            Reportes avanzados
          </div>
        )}
        {plan.api_access && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            {planFeatureIcon('api_access')}
            Acceso API
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Empresa', icon: Building2 },
  { label: 'Admin', icon: User },
  { label: 'Plan', icon: CreditCard },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={idx} className="flex items-center">
            <div
              className={`flex flex-col items-center ${
                active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-40'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`text-xs mt-1 font-semibold ${
                  active ? 'text-blue-700' : done ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mb-4 mx-1 transition-all duration-300 ${
                  idx < current ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface FormData {
  // Empresa
  ruc: string;
  razon_social: string;
  email_empresa: string;
  telefono: string;
  // Admin
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  confirm_password: string;
  // Plan
  plan_id: number | null;
}

const INITIAL: FormData = {
  ruc: '',
  razon_social: '',
  email_empresa: '',
  telefono: '',
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  confirm_password: '',
  plan_id: null,
};

export default function RegistroEmpresaPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const { data: planes = [] } = useQuery<PlanSuscripcion[]>({
    queryKey: ['planesPublicos'],
    queryFn: suscripcionesService.getPlanes,
    staleTime: 5 * 60 * 1000,
  });

  const set = (field: keyof FormData, value: string | number | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Validations per step ────────────────────────────────────────────────────

  function validateStep0(): string {
    const ruc = form.ruc.trim();
    if (!ruc || !form.razon_social.trim() || !form.email_empresa.trim()) {
      return 'RUC, razón social y email de la empresa son obligatorios.';
    }
    if (!/^\d{13}$/.test(ruc)) return 'El RUC debe tener exactamente 13 dígitos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email_empresa))
      return 'Ingresa un email de empresa válido.';
    return '';
  }

  function validateStep1(): string {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim() || !form.password) {
      return 'Todos los campos del administrador son obligatorios.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Ingresa un email válido.';
    if (form.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (form.password !== form.confirm_password) return 'Las contraseñas no coinciden.';
    return '';
  }

  function handleNext() {
    setError('');
    const err = step === 0 ? validateStep0() : validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.registroEmpresa({
        ruc: form.ruc.trim(),
        razon_social: form.razon_social.trim(),
        email_empresa: form.email_empresa.trim(),
        telefono: form.telefono.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.plan_id ? { plan_id: form.plan_id } : {}),
      });
      setAuth(response.user, response.access, response.refresh);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; detail?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          axiosErr.response?.data?.detail ||
          'Ocurrió un error al registrar la empresa.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Input field helper ──────────────────────────────────────────────────────

  function Input({
    id,
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    icon: Icon,
    required = false,
  }: {
    id: string;
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    icon: React.ElementType;
    required?: boolean;
  }) {
    const focused = focusedInput === id;
    return (
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">{label}</label>
        <div className="relative">
          <div
            className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-transform duration-200 ${
              focused ? 'scale-110' : 'scale-100'
            }`}
          >
            <Icon
              className={`h-5 w-5 transition-colors duration-200 ${
                focused ? 'text-blue-700' : 'text-gray-400'
              }`}
            />
          </div>
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocusedInput(id)}
            onBlur={() => setFocusedInput(null)}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:bg-white focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none text-gray-900 placeholder-gray-400 font-medium text-sm"
            placeholder={placeholder}
            required={required}
          />
        </div>
      </div>
    );
  }

  // ── Steps ───────────────────────────────────────────────────────────────────

  const stepContent = [
    // Step 0 — Empresa
    <div key="empresa" className="space-y-4">
      <Input
        id="ruc"
        label="RUC *"
        value={form.ruc}
        onChange={(v) => set('ruc', v)}
        placeholder="0990012345001"
        icon={Building2}
        required
      />
      <Input
        id="razon_social"
        label="Razón Social *"
        value={form.razon_social}
        onChange={(v) => set('razon_social', v)}
        placeholder="Mi Empresa S.A."
        icon={FileText}
        required
      />
      <Input
        id="email_empresa"
        label="Email de la Empresa *"
        type="email"
        value={form.email_empresa}
        onChange={(v) => set('email_empresa', v)}
        placeholder="info@miempresa.com"
        icon={Mail}
        required
      />
      <Input
        id="telefono"
        label="Teléfono"
        value={form.telefono}
        onChange={(v) => set('telefono', v)}
        placeholder="0912345678"
        icon={Phone}
      />
    </div>,

    // Step 1 — Admin
    <div key="admin" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="nombre"
          label="Nombre *"
          value={form.nombre}
          onChange={(v) => set('nombre', v)}
          placeholder="Juan"
          icon={User}
          required
        />
        <Input
          id="apellido"
          label="Apellido *"
          value={form.apellido}
          onChange={(v) => set('apellido', v)}
          placeholder="Pérez"
          icon={User}
          required
        />
      </div>
      <Input
        id="email"
        label="Email de acceso *"
        type="email"
        value={form.email}
        onChange={(v) => set('email', v)}
        placeholder="admin@miempresa.com"
        icon={Mail}
        required
      />
      <Input
        id="password"
        label="Contraseña * (mín. 8 caracteres)"
        type="password"
        value={form.password}
        onChange={(v) => set('password', v)}
        placeholder="••••••••"
        icon={Lock}
        required
      />
      <Input
        id="confirm_password"
        label="Confirmar contraseña *"
        type="password"
        value={form.confirm_password}
        onChange={(v) => set('confirm_password', v)}
        placeholder="••••••••"
        icon={Lock}
        required
      />
    </div>,

    // Step 2 — Plan
    <div key="plan" className="space-y-3">
      <p className="text-sm text-gray-500 text-center mb-4">
        Inicia con <strong>30 días gratis</strong> en el plan que elijas. Puedes cambiar después.
      </p>
      {planes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Cargando planes…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-1">
          {planes.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={form.plan_id === plan.id}
              onSelect={() => set('plan_id', form.plan_id === plan.id ? null : plan.id)}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-center text-gray-400 mt-2">
        Si no seleccionas un plan, se asignará automáticamente el más básico disponible.
      </p>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-slate-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e40af15_1px,transparent_1px),linear-gradient(to_bottom,#1e40af15_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Card */}
      <div className="relative w-full max-w-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-slate-600 rounded-3xl blur-2xl opacity-20 animate-pulse" />

        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-3">
              <img
                src="/logo-of1-1.png"
                alt="OF1 Solutions"
                className="h-20 w-auto drop-shadow-xl transform transition-all hover:scale-105 duration-500"
              />
            </div>
            <h1 className="text-2xl font-black">
              <span className="bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
                Crear Cuenta
              </span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">Comienza tu período de prueba de 30 días</p>
          </div>

          {/* Benefits row */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">SRI Autorizado</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">30 días gratis</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full">
              <Zap className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700">Sin tarjeta</span>
            </div>
          </div>

          <Stepper current={step} />

          {/* Error */}
          {error && (
            <div className="mb-5 bg-gradient-to-r from-red-50 to-sky-50 border-l-4 border-red-500 rounded-r-xl p-3.5 animate-shake shadow-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Step content */}
          <form onSubmit={handleSubmit}>
            {stepContent[step]}

            {/* Navigation */}
            <div className={`flex mt-6 gap-3 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep((s) => s - 1);
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Atrás
                </button>
              )}

              {step < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="relative flex-1 group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative bg-gradient-to-r from-blue-700 to-blue-900 text-white py-3.5 px-6 rounded-xl font-bold shadow-xl hover:shadow-2xl transform transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 border border-white/20">
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creando empresa…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Crear empresa gratis
                      </>
                    )}
                  </div>
                </button>
              )}
            </div>
          </form>

          {/* Footer link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              className="font-bold text-blue-700 hover:text-blue-800 underline-offset-2 hover:underline transition-colors"
            >
              Iniciar sesión
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-gray-400">© 2026 OF1 Solutions S.A.S. - Todos los derechos reservados</p>
        </div>
      </div>
    </div>
  );
}
