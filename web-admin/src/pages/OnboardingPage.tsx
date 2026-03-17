import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import {
  Building2,
  Search,
  Upload,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Shield,
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Settings,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmpresaForm {
  ruc: string;
  razon_social: string;
  nombre_comercial: string;
  tipo_contribuyente: string;
  direccion_matriz: string;
  ciudad: string;
  telefono: string;
  email: string;
  ambiente: string;
  establecimiento_codigo: string;
  punto_emision_codigo: string;
}

interface CertForm {
  archivo: File | null;
  password: string;
  fecha_vencimiento: string;
}

interface CertValidation {
  valido: boolean;
  fecha_vencimiento: string;
  subject: string;
}

// ─── Step indicators ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Datos de empresa', icon: Building2 },
  { label: 'Firma electrónica', icon: Shield },
  { label: 'Confirmar', icon: CheckCircle2 },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : active
                    ? 'bg-blue-700 border-blue-700 text-white'
                    : 'bg-gray-100 border-gray-200 text-gray-400'
                }`}
              >
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <p
                className={`text-[10px] font-bold text-center leading-tight ${
                  active ? 'text-blue-700' : done ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 rounded transition-all ${
                  i < current ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={Icon ? 'relative' : ''}>
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />}
        {children}
      </div>
    </div>
  );
}

const inputCls = (withIcon = true) =>
  `w-full ${withIcon ? 'pl-10' : 'px-4'} pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loadingRuc, setLoadingRuc] = useState(false);
  const [loadingCert, setLoadingCert] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [certValidation, setCertValidation] = useState<CertValidation | null>(null);

  const [empresa, setEmpresa] = useState<EmpresaForm>({
    ruc: '',
    razon_social: '',
    nombre_comercial: '',
    tipo_contribuyente: 'NATURAL',
    direccion_matriz: '',
    ciudad: '',
    telefono: '',
    email: user?.email || '',
    ambiente: '1',
    establecimiento_codigo: '001',
    punto_emision_codigo: '001',
  });

  const [cert, setCert] = useState<CertForm>({
    archivo: null,
    password: '',
    fecha_vencimiento: '',
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const setEmp = (field: keyof EmpresaForm, value: string) =>
    setEmpresa((f) => ({ ...f, [field]: value }));

  // ── Step 1: Consultar RUC al SRI ──────────────────────────────────────────
  const handleConsultarRuc = async () => {
    setError('');
    const ruc = empresa.ruc.trim();
    if (ruc.length !== 13 || !/^\d+$/.test(ruc)) {
      setError('El RUC debe tener exactamente 13 dígitos numéricos.');
      return;
    }
    setLoadingRuc(true);
    try {
      const res = await authService.consultarRuc(ruc);
      if (res.found) {
        setEmpresa((f) => ({
          ...f,
          razon_social: res.razon_social || f.razon_social,
          nombre_comercial: res.nombre_comercial || f.nombre_comercial,
          direccion_matriz: res.direccion || f.direccion_matriz,
        }));
      } else {
        setError(res.error || 'No se encontró información en el SRI. Ingresa los datos manualmente.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'No se pudo consultar el SRI. Ingresa los datos manualmente.');
    } finally {
      setLoadingRuc(false);
    }
  };

  // ── Step 2: Validar certificado ───────────────────────────────────────────
  const handleValidarCert = async () => {
    setError('');
    setCertValidation(null);
    if (!cert.archivo) {
      setError('Selecciona un archivo de certificado (.p12 o .pfx).');
      return;
    }
    if (!cert.password) {
      setError('Ingresa la contraseña del certificado.');
      return;
    }
    if (!empresa.ruc) {
      setError('Ve al paso 1 primero e ingresa el RUC.');
      return;
    }
    setLoadingCert(true);
    try {
      const fd = new FormData();
      fd.append('archivo', cert.archivo);
      fd.append('password', cert.password);
      fd.append('ruc', empresa.ruc);
      const res = await authService.validarCertificado(fd);
      setCertValidation(res);
      if (res.fecha_vencimiento) {
        setCert((f) => ({ ...f, fecha_vencimiento: res.fecha_vencimiento }));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Certificado inválido o contraseña incorrecta.');
    } finally {
      setLoadingCert(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    setError('');
    if (step === 0) {
      if (!empresa.ruc || empresa.ruc.length !== 13) { setError('RUC de 13 dígitos requerido.'); return false; }
      if (!empresa.razon_social) { setError('Razón social requerida.'); return false; }
      if (!empresa.direccion_matriz) { setError('Dirección de matriz requerida.'); return false; }
      if (!empresa.email) { setError('Email de la empresa requerido.'); return false; }
    }
    if (step === 1) {
      // Certificate is optional — can be configured later
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(empresa).forEach(([k, v]) => fd.append(k, v));
      if (cert.archivo) {
        fd.append('certificado_digital', cert.archivo);
        fd.append('password_certificado', cert.password);
        if (cert.fecha_vencimiento) fd.append('fecha_vencimiento_certificado', cert.fecha_vencimiento);
      }
      const res = await authService.completarOnboarding(fd);
      updateUser(res.user);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Error al guardar la configuración.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          {/* Logo */}
          <div className="text-center mb-6">
            <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-40 mx-auto object-contain drop-shadow-md" />
            <h1 className="text-xl font-black text-gray-900 mt-3">Configura tu empresa</h1>
            <p className="text-xs text-gray-500 mt-1">Completa estos pasos para comenzar a facturar</p>
          </div>

          <Stepper current={step} />

          {/* Error */}
          {error && (
            <div className="mb-5 bg-red-50 border-l-4 border-red-500 rounded-r-xl p-3.5">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* ── PASO 1: Datos empresa ──────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-black text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-700" />
                Datos de la empresa
              </h2>

              {/* RUC + consultar */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                  RUC <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={empresa.ruc}
                      onChange={(e) => setEmp('ruc', e.target.value.replace(/\D/g, '').slice(0, 13))}
                      placeholder="1234567890001"
                      maxLength={13}
                      className={inputCls()}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleConsultarRuc}
                    disabled={loadingRuc || empresa.ruc.length !== 13}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                  >
                    {loadingRuc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Consultar SRI
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Razón social" icon={Building2} required>
                  <input
                    type="text"
                    value={empresa.razon_social}
                    onChange={(e) => setEmp('razon_social', e.target.value)}
                    placeholder="Mi Empresa S.A."
                    className={inputCls()}
                  />
                </Field>
                <Field label="Nombre comercial" icon={Building2}>
                  <input
                    type="text"
                    value={empresa.nombre_comercial}
                    onChange={(e) => setEmp('nombre_comercial', e.target.value)}
                    placeholder="Nombre comercial"
                    className={inputCls()}
                  />
                </Field>
              </div>

              <Field label="Tipo de contribuyente" required>
                <select
                  value={empresa.tipo_contribuyente}
                  onChange={(e) => setEmp('tipo_contribuyente', e.target.value)}
                  className={inputCls(false)}
                >
                  <option value="NATURAL">Persona Natural</option>
                  <option value="SOCIEDAD">Sociedad</option>
                  <option value="PUBLICA">Institución Pública</option>
                </select>
              </Field>

              <Field label="Dirección matriz" icon={MapPin} required>
                <input
                  type="text"
                  value={empresa.direccion_matriz}
                  onChange={(e) => setEmp('direccion_matriz', e.target.value)}
                  placeholder="Av. Principal 123, Quito"
                  className={inputCls()}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Ciudad" icon={MapPin}>
                  <input
                    type="text"
                    value={empresa.ciudad}
                    onChange={(e) => setEmp('ciudad', e.target.value)}
                    placeholder="Quito"
                    className={inputCls()}
                  />
                </Field>
                <Field label="Teléfono" icon={Phone}>
                  <input
                    type="tel"
                    value={empresa.telefono}
                    onChange={(e) => setEmp('telefono', e.target.value)}
                    placeholder="0987654321"
                    className={inputCls()}
                  />
                </Field>
              </div>

              <Field label="Email empresa" icon={Mail} required>
                <input
                  type="email"
                  value={empresa.email}
                  onChange={(e) => setEmp('email', e.target.value)}
                  placeholder="facturacion@empresa.com"
                  className={inputCls()}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Ambiente" required>
                  <select
                    value={empresa.ambiente}
                    onChange={(e) => setEmp('ambiente', e.target.value)}
                    className={inputCls(false)}
                  >
                    <option value="1">Pruebas</option>
                    <option value="2">Producción</option>
                  </select>
                </Field>
                <Field label="Establecimiento" icon={Settings}>
                  <input
                    type="text"
                    value={empresa.establecimiento_codigo}
                    onChange={(e) => setEmp('establecimiento_codigo', e.target.value.slice(0, 3))}
                    placeholder="001"
                    maxLength={3}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Punto emisión" icon={Settings}>
                  <input
                    type="text"
                    value={empresa.punto_emision_codigo}
                    onChange={(e) => setEmp('punto_emision_codigo', e.target.value.slice(0, 3))}
                    placeholder="001"
                    maxLength={3}
                    className={inputCls()}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── PASO 2: Firma digital ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-black text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-700" />
                Firma electrónica
              </h2>
              <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-xl border border-blue-100">
                El certificado de firma electrónica (.p12 / .pfx) se usa para firmar las facturas ante el SRI.
                Puedes configurarlo ahora o más tarde desde <strong>Configuración</strong>.
              </p>

              {/* File upload */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Archivo de certificado (.p12 / .pfx)
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 cursor-pointer text-center transition-all ${
                    cert.archivo ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".p12,.pfx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCert((f) => ({ ...f, archivo: file }));
                      setCertValidation(null);
                      setError('');
                    }}
                  />
                  {cert.archivo ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <div className="text-left">
                        <p className="font-bold text-emerald-700 text-sm">{cert.archivo.name}</p>
                        <p className="text-xs text-emerald-600">{(cert.archivo.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 font-semibold">Haz clic o arrastra el certificado</p>
                      <p className="text-xs text-gray-400 mt-1">Formatos: .p12, .pfx</p>
                    </>
                  )}
                </div>
              </div>

              {/* Password */}
              <Field label="Contraseña del certificado" icon={Lock}>
                <input
                  type="password"
                  value={cert.password}
                  onChange={(e) => {
                    setCert((f) => ({ ...f, password: e.target.value }));
                    setCertValidation(null);
                  }}
                  placeholder="Contraseña del .p12 / .pfx"
                  className={inputCls()}
                />
              </Field>

              {/* Validate button */}
              {cert.archivo && cert.password && !certValidation && (
                <button
                  type="button"
                  onClick={handleValidarCert}
                  disabled={loadingCert}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-blue-700 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all disabled:opacity-60"
                >
                  {loadingCert ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {loadingCert ? 'Validando certificado…' : 'Validar certificado'}
                </button>
              )}

              {/* Validation result */}
              {certValidation && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-700 text-sm">Certificado válido</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        Vence: <strong>{certValidation.fecha_vencimiento}</strong>
                      </p>
                      {certValidation.subject && (
                        <p className="text-xs text-emerald-600 mt-0.5 break-all">
                          {certValidation.subject}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Fecha manual si no validó pero subió archivo */}
              {cert.archivo && (
                <Field label="Fecha de vencimiento del certificado" icon={Calendar}>
                  <input
                    type="date"
                    value={cert.fecha_vencimiento}
                    onChange={(e) => setCert((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
                    className={inputCls()}
                  />
                </Field>
              )}
            </div>
          )}

          {/* ── PASO 3: Confirmación ───────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-black text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-700" />
                Resumen de configuración
              </h2>

              <div className="bg-gray-50 rounded-2xl p-5 space-y-3 text-sm">
                <Row label="RUC" value={empresa.ruc} />
                <Row label="Razón social" value={empresa.razon_social} />
                {empresa.nombre_comercial && <Row label="Nombre comercial" value={empresa.nombre_comercial} />}
                <Row label="Tipo contribuyente" value={empresa.tipo_contribuyente} />
                <Row label="Dirección" value={empresa.direccion_matriz} />
                {empresa.ciudad && <Row label="Ciudad" value={empresa.ciudad} />}
                <Row label="Email" value={empresa.email} />
                <Row label="Ambiente" value={empresa.ambiente === '1' ? 'Pruebas' : 'Producción'} />
                <Row label="Serie" value={`${empresa.establecimiento_codigo}-${empresa.punto_emision_codigo}`} />
                <Row
                  label="Certificado digital"
                  value={cert.archivo ? `${cert.archivo.name}${certValidation ? ' ✓ validado' : ''}` : 'No configurado (puedes hacerlo después)'}
                  warn={!cert.archivo}
                />
              </div>

              {!cert.archivo && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800">
                  <strong>Nota:</strong> Sin el certificado digital no podrás firmar facturas electrónicas. Puedes subirlo desde <strong>Configuración → Empresa</strong> cuando lo tengas listo.
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className={`flex mt-8 gap-3 ${step > 0 ? 'justify-between' : 'justify-between'}`}>
            {step === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/bienvenida')}
                className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl font-semibold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setError(''); setStep((s) => s - 1); }}
                className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            {step < 2 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Guardando…</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> Comenzar a facturar</>
                )}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">© 2026 OF1 Solutions S.A.S.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 font-medium shrink-0">{label}</span>
      <span className={`font-semibold text-right ${warn ? 'text-amber-600' : 'text-gray-800'}`}>{value || '—'}</span>
    </div>
  );
}
