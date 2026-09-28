import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { TODOS_LOS_CODIGOS } from '../constants/modulos';
import { suscripcionesService } from '../services/suscripcionesService';

/**
 * Hook para verificar el acceso a módulos según el plan de suscripción.
 *
 * Obtiene los módulos desde el servidor (React Query) para mantenerlos
 * actualizados durante la sesión. Si el admin cambia permisos en la matriz,
 * el cambio se reflejará en la próxima consulta (refetch on window focus o
 * cada 2 minutos). Mientras carga, usa el valor cacheado en el auth store.
 *
 * SUPER_ADMIN → acceso a todos los módulos siempre.
 * Empresa sin plan activo → lista vacía (el ProtectedRoute ya los redirige).
 */
export function useModulosAcceso() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeEmpresaId = useAuthStore((s) => s.activeEmpresaId);
  const esSuperAdmin = user?.rol === 'SUPER_ADMIN';
  const puedeAdministrarModulos = esSuperAdmin || Boolean(
    user?.accesos_plataforma?.some((access) =>
      access.rol === 'ADMIN_GLOBAL' || access.alcances?.includes('modules')
    )
  );
  const esFirmador = user?.rol === 'FIRMADOR';

  // React Query deduplica esta llamada aunque el hook se use en múltiples componentes
  const { data: modulosServidor } = useQuery({
    queryKey: ['mis-modulos', activeEmpresaId],
    queryFn: () => suscripcionesService.getMisModulos(),
    enabled: isAuthenticated && !puedeAdministrarModulos && !esFirmador,
    staleTime: 2 * 60 * 1000,   // refresca cada 2 min
    refetchOnWindowFocus: true,  // revalida al volver a la pestaña
    retry: 1,
  });

  // Sincronizar los módulos del servidor al auth store (actualiza localStorage también)
  useEffect(() => {
    if (modulosServidor !== undefined) {
      updateUser({ modulos_activos: modulosServidor });
    }
  }, [modulosServidor, updateUser]);

  const modulos: string[] = puedeAdministrarModulos
    ? TODOS_LOS_CODIGOS
    : esFirmador
      ? ['firmador_pdf']
    : (modulosServidor ?? user?.modulos_activos ?? []);

  const modulosSet = new Set(modulos);

  /**
   * Retorna true si el usuario tiene acceso al módulo indicado.
   * SUPER_ADMIN siempre retorna true.
   */
  const tieneAccesoModulo = (codigo: string): boolean => {
    if (puedeAdministrarModulos) return true;
    if (esFirmador) return codigo === 'firmador_pdf';
    return modulosSet.has(codigo);
  };

  return { modulos, tieneAccesoModulo, esSuperAdmin: puedeAdministrarModulos };
}
