import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { Lock, User, AlertCircle, Loader2, ShieldCheck, Zap, UserPlus, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotFound(false);
    setLoading(true);

    try {
      const response = await authService.login({ email, password });
      const user = response.user;
      setAuth(user, response.access, response.refresh);
      if (user.rol === 'SUPER_ADMIN' || (user.email_verificado && user.onboarding_completado)) {
        navigate('/');
      } else if (!user.email_verificado) {
        navigate('/verificar-email');
      } else {
        navigate('/bienvenida');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.detail || '';
      if (status === 401 || detail.toLowerCase().includes('no active account')) {
        setNotFound(true);
      } else {
        setError(detail || 'Error al iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-slate-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000"></div>
      </div>

      {/* Decorative grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e40af15_1px,transparent_1px),linear-gradient(to_bottom,#1e40af15_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-slate-600 rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
        
        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/20">
          {/* Logo y Header */}
          <div className="text-center mb-10">
            <div className="relative inline-block mb-4">
              <img
                src="/logo-of1-1.png"
                alt="OF1 Solutions"
                className="h-28 w-auto drop-shadow-2xl transform transition-all hover:scale-105 duration-500"
              />
            </div>
            
            <h1 className="text-3xl font-black mb-1">
              <span className="bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
                Facturación Electrónica
              </span>
            </h1>
            <p className="text-gray-600 font-medium text-sm">Sistema Integral de Gestión · SRI Ecuador</p>
            
            {/* Features badges */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Seguro</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full">
                <Zap className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold text-slate-700">Rápido</span>
              </div>
            </div>
          </div>

          {/* ── NOT REGISTERED PANEL ── */}
          {notFound ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Cuenta no encontrada</h2>
              <p className="text-sm text-gray-500 mb-1">
                No existe ninguna cuenta registrada con:
              </p>
              <p className="text-sm font-bold text-gray-800 mb-6 break-all">{email}</p>

              <button
                onClick={() => navigate(`/registro?email=${encodeURIComponent(email)}`)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 mb-4"
              >
                <UserPlus className="w-5 h-5" />
                Crear cuenta nueva gratis
              </button>

              <button
                onClick={() => { setNotFound(false); setError(''); }}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 rounded-xl font-semibold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Intentar con otro correo
              </button>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="mb-6 bg-gradient-to-r from-red-50 to-sky-50 border-l-4 border-red-500 rounded-r-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-2.5 ml-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-all duration-300 ${
                      focusedInput === 'email' ? 'scale-110' : 'scale-100'
                    }`}>
                      <User className={`h-5 w-5 transition-colors duration-300 ${
                        focusedInput === 'email' ? 'text-blue-700' : 'text-gray-400'
                      }`} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:bg-white focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition-all duration-300 outline-none text-gray-900 placeholder-gray-400 font-medium"
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-2.5 ml-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-all duration-300 ${
                      focusedInput === 'password' ? 'scale-110' : 'scale-100'
                    }`}>
                      <Lock className={`h-5 w-5 transition-colors duration-300 ${
                        focusedInput === 'password' ? 'text-blue-700' : 'text-gray-400'
                      }`} />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:bg-white focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition-all duration-300 outline-none text-gray-900 placeholder-gray-400 font-medium"
                      placeholder="Ingrese su contraseña"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full mt-8 group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-r from-blue-700 to-blue-900 text-white py-4 px-6 rounded-xl font-bold shadow-xl hover:shadow-2xl transform transition-all duration-300 hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 border border-white/20">
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-lg">Iniciando sesión...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">Iniciar Sesión</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                </button>
              </form>
            </>
          )}

          {/* Footer */}
          <div className="mt-10 pt-8 border-t border-gray-200 text-center">
            {!notFound && (
              <p className="text-sm text-gray-600 font-medium mb-3">
                ¿Aún no tienes cuenta?{' '}
                <Link
                  to="/registro"
                  className="font-bold text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline transition-colors"
                >
                  Registra tu empresa gratis
                </Link>
              </p>
            )}
            <p className="text-sm text-gray-500 font-medium mb-1">Sistema de Facturación Electrónica</p>
            <p className="text-xs text-gray-400">© 2026 OF1 Solutions S.A.S. - Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
