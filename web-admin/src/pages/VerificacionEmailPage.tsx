import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import {
  Mail,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Clock,
} from 'lucide-react';

const CODE_LENGTH = 6;
const COOLDOWN_SECONDS = 120;
const MAX_RESENDS = 3;

export default function VerificacionEmailPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [reenviosRestantes, setReenviosRestantes] = useState(MAX_RESENDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already verified
  useEffect(() => {
    if (user?.email_verificado) {
      navigate(user.onboarding_completado ? '/' : '/bienvenida');
    }
  }, [user, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    // Allow paste of full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      const next = Array(CODE_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setDigits(next);
      const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const char = value.replace(/\D/g, '');
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const codigo = digits.join('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.length < CODE_LENGTH) {
      setError('Ingresa los 6 dígitos del código.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authService.verificarEmail(codigo);
      updateUser(res.user);
      setSuccess('¡Email verificado correctamente!');
      setTimeout(() => navigate('/bienvenida'), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Código incorrecto. Intenta de nuevo.');
      // Clear digits on error
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || reenviosRestantes <= 0) return;
    setError('');
    setResending(true);
    try {
      const res = await authService.reenviarCodigo();
      setReenviosRestantes(res.reenvios_restantes);
      setCooldown(COOLDOWN_SECONDS);
      setSuccess('Código reenviado. Revisa tu bandeja de entrada.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const respErr = err?.response?.data;
      if (respErr?.segundos_restantes) {
        setCooldown(respErr.segundos_restantes);
      }
      setError(respErr?.error || 'No se pudo reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-700" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Verifica tu email</h1>
            <p className="text-sm text-gray-500">
              Enviamos un código de 6 dígitos a{' '}
              <span className="font-semibold text-gray-700">{user?.email}</span>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 bg-red-50 border-l-4 border-red-500 rounded-r-xl p-3.5">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-5 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl p-3.5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-800 font-medium">{success}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify}>
            {/* OTP Inputs */}
            <div className="flex justify-center gap-3 mb-6">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={CODE_LENGTH}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className={`w-12 h-14 text-center text-xl font-black border-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    d ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || codigo.length < CODE_LENGTH}
              className="w-full py-3.5 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Verificar código
                </>
              )}
            </button>
          </form>

          {/* Resend section */}
          <div className="mt-6 text-center">
            {reenviosRestantes === 0 ? (
              <p className="text-sm text-red-600 font-medium">
                Has alcanzado el máximo de reenvíos.{' '}
                <a href="/registro" className="font-bold underline">
                  Regístrate de nuevo
                </a>
              </p>
            ) : cooldown > 0 ? (
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Puedes reenviar en{' '}
                <span className="font-bold text-blue-700 font-mono">{formatTime(cooldown)}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-2 mx-auto transition-colors"
              >
                {resending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {resending ? 'Reenviando…' : `Reenviar código (${reenviosRestantes} restantes)`}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">© 2026 OF1 Solutions S.A.S.</p>
        </div>
      </div>
    </div>
  );
}
