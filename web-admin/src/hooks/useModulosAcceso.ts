import { useAuthStore } from '../store/authStore';
import { TODOS_LOS_CODIGOS } from '../constants/modulos';

/**
 * Hook para verificar el acceso a módulos según el plan de suscripción.
 *
 * Lee `modulos_activos` directamente del usuario en el auth store
 * (viene del backend en cada login / refresh de current_user).
 *
 * SUPER_ADMIN → acceso a todos los módulos siempre.
 * Empresa sin plan activo → lista vacía (el ProtectedRoute ya los redirige,
 * pero lo manejamos de forma segura de todos modos).
 */
export function useModulosAcceso() {
  const user = useAuthStore((s) => s.user);
  const esSuperAdmin = user?.rol === 'SUPER_ADMIN';

  const modulos: string[] = esSuperAdmin
    ? TODOS_LOS_CODIGOS
    : (user?.modulos_activos ?? []);

  const modulosSet = new Set(modulos);

  /**
   * Retorna true si el usuario tiene acceso al módulo indicado.
   * SUPER_ADMIN siempre retorna true.
   */
  const tieneAccesoModulo = (codigo: string): boolean => {
    if (esSuperAdmin) return true;
    return modulosSet.has(codigo);
  };

  return { modulos, tieneAccesoModulo, esSuperAdmin };
}
