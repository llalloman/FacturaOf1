import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

/**
 * Guard de ruta para el área protegida del sistema.
 *
 * Orden de verificación (no autenticado → verificación email → contraseña →
 * suscripción → roles):
 *  1. Sin sesión               → /login
 *  2. Email no verificado      → /verificar-email
 *  3. Cambio de contraseña     → /cambiar-password
 *  4. Cargando suscripción     → spinner (evita flash de redirect)
 *  5. Sin suscripción activa   → /bienvenida
 *  6. Rol no permitido         → /
 *
 * Nota: el onboarding ya NO es un bloqueo global. La configuración fiscal
 * se valida contextualmente solo al generar documentos electrónicos.
 */
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const { tieneAcceso, estaVencida, cargando, esSuperAdmin } = useSubscriptionStatus();

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ── 2. Email verificado (SUPER_ADMIN exento) ──────────────────────────────
  if (!esSuperAdmin && !user?.email_verificado) {
    return <Navigate to="/verificar-email" replace />;
  }

  // ── 3. Cambio de contraseña obligatorio ───────────────────────────────────
  if (user?.debe_cambiar_password) {
    return <Navigate to="/cambiar-password" replace />;
  }

  // ── 4. Esperando estado de suscripción ────────────────────────────────────
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500">Verificando acceso…</p>
        </div>
      </div>
    );
  }

  // ── 5. Suscripción activa (SUPER_ADMIN exento) ────────────────────────────
  // Bloquea cuando no hay suscripción activa, independientemente del onboarding.
  // El onboarding ya no es un requisito global; la validación fiscal es contextual.
  if (!esSuperAdmin && (!tieneAcceso || estaVencida)) {
    return <Navigate to="/bienvenida" replace />;
  }

  // ── 6. Roles permitidos ───────────────────────────────────────────────────
  if (allowedRoles && user?.rol && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
