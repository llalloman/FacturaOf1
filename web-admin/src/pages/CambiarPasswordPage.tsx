import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { Lock, Eye, EyeOff, CheckCircle, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function CambiarPasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNuevo, setShowNuevo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passwordNuevo.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordNuevo !== passwordConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.cambiarPassword(passwordActual, passwordNuevo);
      // Actualizar el store con el usuario actualizado (debe_cambiar_password=false)
      if (res.user && token && refreshToken) {
        setAuth(res.user, token, refreshToken);
      }
      setDone(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-slate-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/20">
          <div className="text-center mb-8">
            <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-36 mx-auto mb-4 object-contain drop-shadow-md" />
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Cambia tu contraseña</h1>
            <p className="text-gray-500 text-sm mt-1">
              {user?.debe_cambiar_password
                ? 'Estás usando una contraseña temporal. Crea una nueva para continuar.'
                : 'Actualiza tu contraseña de acceso.'}
            </p>
          </div>

          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">¡Contraseña actualizada!</h2>
              <p className="text-sm text-gray-500">Redirigiendo al dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-3 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Contraseña actual (temporal) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {user?.debe_cambiar_password ? 'Contraseña temporal' : 'Contraseña actual'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showActual ? 'text' : 'password'}
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900"
                  />
                  <button type="button" onClick={() => setShowActual(!showActual)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showActual ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Nueva contraseña */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNuevo ? 'text' : 'password'}
                    value={passwordNuevo}
                    onChange={(e) => setPasswordNuevo(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900"
                  />
                  <button type="button" onClick={() => setShowNuevo(!showNuevo)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNuevo ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordNuevo.length > 0 && passwordNuevo.length < 8 && (
                  <p className="text-xs text-red-500 mt-1">Mínimo 8 caracteres ({passwordNuevo.length}/8)</p>
                )}
              </div>

              {/* Confirmar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl focus:outline-none text-gray-900 ${
                      passwordConfirm && passwordNuevo !== passwordConfirm
                        ? 'border-red-400 focus:border-red-500'
                        : passwordConfirm && passwordNuevo === passwordConfirm
                          ? 'border-green-400 focus:border-green-500'
                          : 'border-gray-200 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !passwordActual || !passwordNuevo || passwordNuevo !== passwordConfirm}
                className="w-full py-4 bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Cambiando...</>
                ) : (
                  <><ShieldCheck className="w-5 h-5" /> Guardar nueva contraseña</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
