import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Banner ámbar que avisa cuando la configuración fiscal no está completa.
 * Solo se muestra en páginas donde se pueden generar documentos electrónicos.
 * No aparece para SUPER_ADMIN ni cuando onboarding_completado = true.
 */
export default function FiscalReadinessBanner() {
  const user = useAuthStore((s) => s.user);

  if (!user || user.rol === 'SUPER_ADMIN' || user.onboarding_completado) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-900">Configuración fiscal incompleta</p>
        <p className="mt-0.5 text-amber-700">
          Para emitir documentos electrónicos (facturas, retenciones, guías) debes completar
          la configuración de tu empresa.{' '}
          <Link
            to="/onboarding"
            className="font-medium text-amber-900 underline hover:text-amber-700"
          >
            Completar ahora →
          </Link>
        </p>
      </div>
    </div>
  );
}
