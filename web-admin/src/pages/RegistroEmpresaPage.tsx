import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { suscripcionesService } from '../services/suscripcionesService';
import type { PlanSuscripcion } from '../types';
import {
  User, Lock, Mail, Phone, MapPin, CreditCard, Eye, EyeOff,
  AlertCircle, Loader2, CheckCircle2, Shield, Zap, Check, ArrowLeft,
} from 'lucide-react';

// ─── Plan cards config ────────────────────────────────────────────────────────
const planStyle: Record<string, { gradient: string; border: string; badge: string; featured: boolean }> = {
  FREE:        { gradient: 'from-emerald-50 to-teal-50',  border: 'border-emerald-200',  badge: 'bg-emerald-100 text-emerald-700', featured: false },
  BASICO:      { gradient: 'from-slate-50 to-gray-50',    border: 'border-slate-200',    badge: 'bg-slate-100 text-slate-700',    featured: false },
  PROFESIONAL: { gradient: 'from-blue-600 to-blue-800',   border: 'border-blue-500',     badge: 'bg-white/20 text-white',         featured: true  },
  EMPRESARIAL: { gradient: 'from-indigo-50 to-purple-50', border: 'border-indigo-200',   badge: 'bg-indigo-100 text-indigo-700',  featured: false },
  ILIMITADO:   { gradient: 'from-amber-50 to-orange-50',  border: 'border-amber-200',    badge: 'bg-amber-100 text-amber-700',    featured: false },
};

function PlanCard({ plan, selected, onSelect }: { plan: PlanSuscripcion; selected: boolean; onSelect: () => void }) {
  const s = planStyle[plan.tipo] ?? planStyle.BASICO;
  const isFeatured = s.featured;
  const textClass = isFeatured ? 'text-white' : 'text-gray-900';
  const subClass  = isFeatured ? 'text-blue-100' : 'text-gray-500';
  const displayName = plan.tipo === 'FREE' ? 'Demo guiada' : plan.nombre;
  const displayDescription = plan.tipo === 'FREE'
    ? 'Agenda una demostración y recibe asesoría para empezar.'
    : plan.descripcion;

  const features = [
    plan.facturas_mensuales === -1 ? 'Docs ilimitados' : `${plan.facturas_mensuales} docs / período`,
    plan.usuarios_permitidos === -1 ? 'Usuarios ilimitados' : `${plan.usuarios_permitidos} usuario${plan.usuarios_permitidos !== 1 ? 's' : ''}`,
    plan.soporte_prioritario && 'Soporte prioritario',
    plan.reportes_avanzados && 'Reportes avanzados',
    plan.api_access && 'Acceso API',
  ].filter(Boolean) as string[];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-2xl border-2 p-5 transition-all duration-200
        bg-gradient-to-br ${s.gradient}
        ${selected ? `${s.border} ring-2 ring-offset-2 ${isFeatured ? 'ring-blue-400' : 'ring-blue-500'} scale-[1.02]` : `border-transparent hover:${s.border} hover:scale-[1.01]`}
      `}
    >
      {isFeatured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full shadow whitespace-nowrap">
          ⭐ Más popular
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 ${s.badge}`}>{displayName}</span>
          <div className={`flex items-baseline gap-1 ${textClass}`}>
            {plan.precio === 0
              ? <span className="text-2xl font-black">Demo</span>
              : <><span className="text-2xl font-black">${plan.precio}</span><span className={`text-sm ${subClass}`}>/{plan.periodo === 'MENSUAL' ? 'mes' : plan.periodo.toLowerCase()}</span></>
            }
          </div>
          {displayDescription && <p className={`text-xs mt-1 ${subClass}`}>{displayDescription}</p>}
        </div>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors
          ${selected ? (isFeatured ? 'bg-white border-white' : 'bg-blue-600 border-blue-600') : (isFeatured ? 'border-white/50' : 'border-gray-300')}`}>
          {selected && <Check className={`w-3.5 h-3.5 ${isFeatured ? 'text-blue-600' : 'text-white'}`} />}
        </div>
      </div>
      <ul className={`mt-3 space-y-1.5 ${subClass}`}>
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs">
            <Check className={`w-3.5 h-3.5 flex-shrink-0 ${isFeatured ? 'text-blue-200' : 'text-emerald-500'}`} />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RegistroEmpresaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<1 | 2>(1);
  const [planes, setPlanes] = useState<PlanSuscripcion[]>([]);
  const [planesLoading, setPlanesLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [anual, setAnual] = useState(true);

  const handleTogglePeriodo = (newAnual: boolean) => {
    setAnual(newAnual);
    if (selectedPlanId) {
      const current = planes.find((p) => p.id === selectedPlanId);
      if (current && current.tipo !== 'FREE') {
        const match = planes.find((p) => p.tipo === current.tipo && p.periodo === (newAnual ? 'ANUAL' : 'MENSUAL'));
        if (match) setSelectedPlanId(match.id);
      }
    }
  };

  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    cedula: '', nombre: '', apellido: '',
    password: '', confirm_password: '',
    ciudad: '', telefono: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  const setField = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    suscripcionesService.getPlanes()
      .then((data) => {
        setPlanes(data);
        // Pre-select PROFESIONAL ANUAL (default toggle = anual)
        const prof = data.find((p) => p.tipo === 'PROFESIONAL' && p.periodo === 'ANUAL');
        const fallback = data.find((p) => p.periodo === 'ANUAL') ?? data[0];
        setSelectedPlanId((prof ?? fallback)?.id ?? null);
      })
      .finally(() => setPlanesLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!aceptaTerminos) { setError('Debes aceptar los términos y condiciones para continuar.'); return; }
    if (form.password !== form.confirm_password) { setError('Las contraseñas no coinciden.'); return; }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const resp = await authService.registroEmpresa({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        cedula: form.cedula.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
        plan_id: selectedPlanId ?? undefined,
      });
      setAuth(resp.user as any, resp.access, resp.refresh);
      navigate('/verificar-email');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = planes.find((p) => p.id === selectedPlanId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
            <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-16 mx-auto mb-3 object-contain drop-shadow-md" />
            <h1 className="text-2xl font-black text-gray-900 mb-1">Empieza con FacturaOF1 ERP</h1>
            <p className="text-sm text-gray-500">Facturación electrónica SRI y control de negocio</p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" />Demo guiada</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full"><Shield className="w-3.5 h-3.5" />Datos seguros</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-full"><Zap className="w-3.5 h-3.5" />Sin contrato</span>
            </div>
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-3 mt-5">
              <div className={`flex items-center gap-2 text-sm font-semibold ${step === 1 ? 'text-blue-700' : 'text-emerald-600'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'}`}>
                  {step > 1 ? <Check className="w-4 h-4" /> : '1'}
                </span>
                Elige tu plan
              </div>
              <div className="flex-1 h-px bg-gray-200 max-w-[60px]" />
              <div className={`flex items-center gap-2 text-sm font-semibold ${step === 2 ? 'text-blue-700' : 'text-gray-400'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
                Tus datos
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* ── STEP 1: Plan selection ───────────────────────────────────── */}
            {step === 1 && (
              <div>
                <p className="text-sm text-gray-600 mb-5 text-center">
                  Elige el plan que mejor se adapta a tu negocio. Si necesitas ayuda, agenda una demostración.
                </p>
                {planesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Toggle mensual / anual */}
                    <div className="flex items-center justify-center mb-5">
                      <div className="inline-flex items-center bg-slate-100 rounded-full p-1 gap-1">
                        <button
                          onClick={() => handleTogglePeriodo(false)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                            !anual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Mensual
                        </button>
                        <button
                          onClick={() => handleTogglePeriodo(true)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                            anual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Anual
                          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Ahorra 2 meses
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {planes
                        .filter((p) => p.tipo === 'FREE' || p.periodo === (anual ? 'ANUAL' : 'MENSUAL'))
                        .map((plan) => (
                          <PlanCard
                            key={plan.id}
                            plan={plan}
                            selected={selectedPlanId === plan.id}
                            onSelect={() => setSelectedPlanId(plan.id)}
                          />
                        ))}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  disabled={!selectedPlanId || planesLoading}
                  onClick={() => setStep(2)}
                  className="w-full mt-6 py-3.5 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Continuar con {selectedPlan ? `Plan ${selectedPlan.tipo === 'FREE' ? 'Demo guiada' : selectedPlan.nombre}` : '…'}
                </button>
              </div>
            )}

            {/* ── STEP 2: Personal info form ───────────────────────────────── */}
            {step === 2 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mb-5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Cambiar plan
                  {selectedPlan && <span className="ml-1 text-xs text-gray-400">({selectedPlan.nombre})</span>}
                </button>

                {error && (
                  <div className="mb-5 bg-red-50 border-l-4 border-red-500 rounded-r-xl p-3.5">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Correo electrónico *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="tu@correo.com"
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Cédula / RUC</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={form.cedula} onChange={(e) => setField('cedula', e.target.value.replace(/\D/g, ''))} placeholder="1234567890" maxLength={13}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Nombres *</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" required value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} placeholder="Juan"
                          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Apellidos *</label>
                      <input type="text" required value={form.apellido} onChange={(e) => setField('apellido', e.target.value)} placeholder="Pérez"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Contraseña *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPass ? 'text' : 'password'} required value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Mín. 8 caracteres"
                        className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                      <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Confirmar contraseña *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showConfirm ? 'text' : 'password'} required value={form.confirm_password} onChange={(e) => setField('confirm_password', e.target.value)} placeholder="Repite la contraseña"
                        className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50 focus:bg-white transition-all ${form.confirm_password && form.confirm_password !== form.password ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'}`} />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Ciudad</label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={form.ciudad} onChange={(e) => setField('ciudad', e.target.value)} placeholder="Quito"
                          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Teléfono</label>
                      <div className="relative flex">
                        <span className="flex items-center px-3 border border-r-0 border-gray-200 rounded-l-xl bg-gray-100 text-sm text-gray-500 font-medium">+593</span>
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="tel" value={form.telefono} onChange={(e) => setField('telefono', e.target.value.replace(/\D/g, ''))} placeholder="987654321"
                            className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Aceptar términos */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div className="mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={aceptaTerminos}
                        onChange={(e) => setAceptaTerminos(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-xs text-gray-600 leading-relaxed">
                      He leído y acepto los{' '}
                      <Link to="/terminos" target="_blank" className="text-blue-700 font-semibold hover:underline">
                        Términos y Condiciones
                      </Link>{' '}y la{' '}
                      <Link to="/privacidad" target="_blank" className="text-blue-700 font-semibold hover:underline">
                        Política de Privacidad
                      </Link>{' '}de OF1 Solutions.
                    </span>
                  </label>

                  <button type="submit" disabled={loading || !aceptaTerminos}
                    className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
                    {loading
                      ? <><Loader2 className="w-5 h-5 animate-spin" />Creando cuenta&hellip;</>
                      : <><CheckCircle2 className="w-5 h-5" />Crear cuenta</>
                    }
                  </button>
                </form>
              </div>
            )}

            <p className="mt-3 text-center text-sm text-gray-500">¿Ya tienes cuenta? <Link to="/login" className="font-bold text-blue-700 hover:text-blue-800 underline-offset-2 hover:underline transition-colors">Iniciar sesión</Link></p>
            <p className="mt-2 text-center text-xs text-gray-400">© 2026 OF1 Solutions S.A.S.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
