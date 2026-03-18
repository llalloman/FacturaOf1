import { Lock, ArrowUpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModulosAcceso } from '../hooks/useModulosAcceso';
import { MODULO_POR_CODIGO } from '../constants/modulos';

interface ModuloGuardProps {
  /** Código del módulo requerido (e.g. 'reportes', 'nomina') */
  modulo: string;
  children: React.ReactNode;
}

/**
 * Guard de módulo por suscripción.
 *
 * Si el usuario no tiene acceso al módulo según su plan activo,
 * muestra una pantalla de "Módulo bloqueado" con call-to-action para
 * actualizar el plan, en lugar de redirigir.
 *
 * Esto es diferente a ProtectedRoute (que verifica autenticación/suscripción
 * general); ModuloGuard verifica acceso granular por módulo.
 */
export default function ModuloGuard({ modulo, children }: ModuloGuardProps) {
  const { tieneAccesoModulo } = useModulosAcceso();

  if (tieneAccesoModulo(modulo)) {
    return <>{children}</>;
  }

  const info = MODULO_POR_CODIGO[modulo];
  const label = info?.label ?? modulo;

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center max-w-md">
        {/* Ícono candado */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Lock className="w-10 h-10 text-slate-400" />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Módulo bloqueado
        </h2>
        <p className="text-slate-500 mb-1">
          <span className="font-semibold text-slate-700">{label}</span> no está
          incluido en tu plan actual.
        </p>
        <p className="text-slate-400 text-sm mb-8">
          Actualiza tu suscripción para desbloquear este módulo y acceder a
          todas las funcionalidades.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/suscripcion"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700
                       text-white font-semibold rounded-lg transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Ver planes
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200
                       hover:bg-slate-50 text-slate-600 font-medium rounded-lg transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
