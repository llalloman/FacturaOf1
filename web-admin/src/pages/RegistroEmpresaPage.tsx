import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { User, Lock, Mail, Phone, MapPin, CreditCard, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, Shield, Zap } from 'lucide-react';

export default function RegistroEmpresaPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', cedula: '', nombre: '', apellido: '', password: '', confirm_password: '', ciudad: '', telefono: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) { setError('Las contraseñas no coinciden.'); return; }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const resp = await authService.registroEmpresa({
        email: form.email.trim().toLowerCase(), password: form.password,
        nombre: form.nombre.trim(), apellido: form.apellido.trim(),
        cedula: form.cedula.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
      });
      setAuth(resp.user as any, resp.access, resp.refresh);
      navigate('/verificar-email');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          <div className="text-center mb-8">
            <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-black text-gray-900 mb-1">Crea tu cuenta gratis</h1>
            <p className="text-sm text-gray-500">30 días de prueba · Sin tarjeta de crédito</p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" />30 días gratis</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full"><Shield className="w-3.5 h-3.5" />Datos seguros</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-full"><Zap className="w-3.5 h-3.5" />Sin contrato</span>
            </div>
          </div>
          {error && (
            <div className="mb-5 bg-red-50 border-l-4 border-red-500 rounded-r-xl p-3.5">
              <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" /><p className="text-sm text-red-800 font-medium">{error}</p></div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Correo electrónico *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@correo.com" className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Cédula / RUC</label>
              <div className="relative">
                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={form.cedula} onChange={(e) => set('cedula', e.target.value.replace(/\D/g, ''))} placeholder="1234567890" maxLength={13} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Nombres *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Juan" className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Apellidos *</label>
                <input type="text" required value={form.apellido} onChange={(e) => set('apellido', e.target.value)} placeholder="Pérez" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Contraseña *</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPass ? 'text' : 'password'} required value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Mín. 8 caracteres" className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Confirmar contraseña *</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showConfirm ? 'text' : 'password'} required value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} placeholder="Repite la contraseña" className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50 focus:bg-white transition-all ${form.confirm_password && form.confirm_password !== form.password ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'}`} />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Ciudad</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} placeholder="Quito" className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Teléfono</label>
                <div className="relative flex">
                  <span className="flex items-center px-3 border border-r-0 border-gray-200 rounded-l-xl bg-gray-100 text-sm text-gray-500 font-medium">+593</span>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" value={form.telefono} onChange={(e) => set('telefono', e.target.value.replace(/\D/g, ''))} placeholder="987654321" className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" />
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
              {loading ? (<><Loader2 className="w-5 h-5 animate-spin" />Creando cuenta&hellip;</>) : (<><CheckCircle2 className="w-5 h-5" />Crear cuenta gratis</>)}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-500">Al registrarte aceptas nuestros <span className="text-blue-700 font-semibold cursor-pointer">términos y condiciones</span></p>
          <p className="mt-4 text-center text-sm text-gray-500">¿Ya tienes cuenta? <Link to="/login" className="font-bold text-blue-700 hover:text-blue-800 underline-offset-2 hover:underline transition-colors">Iniciar sesión</Link></p>
          <p className="mt-2 text-center text-xs text-gray-400">© 2026 OF1 Solutions S.A.S.</p>
        </div>
      </div>
    </div>
  );
}
