import { useQuery } from '@tanstack/react-query';
import { suscripcionesService } from '../services/suscripcionesService';
import { useAuthStore } from '../store/authStore';
import type { Suscripcion } from '../types';

/** Estados que otorgan acceso completo al sistema */
const ESTADOS_CON_ACCESO: Suscripcion['estado'][] = ['ACTIVA', 'PRUEBA'];

export interface SubscriptionStatus {
  /** true si la suscripción está activa o en periodo de prueba */
  tieneAcceso: boolean;
  /** true si la suscripción existe pero está vencida */
  estaVencida: boolean;
  /** true mientras se carga (solo para usuarios normales autenticados) */
  cargando: boolean;
  /** true si SUPER_ADMIN (siempre tiene acceso, sin suscripción) */
  esSuperAdmin: boolean;
  /** objeto completo de suscripción (null si no existe o error) */
  suscripcion: Suscripcion | null;
  /** fuerza un re-fetch (ej. después de suscribirse) */
  refetch: () => void;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const esSuperAdmin = user?.rol === 'SUPER_ADMIN';

  const {
    data: suscripcion,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['suscripcion-activa-guard'],
    queryFn: () => suscripcionesService.getSuscripcionActiva(),
    enabled: isAuthenticated && !esSuperAdmin,
    staleTime: 3 * 60 * 1000, // 3 min — evita fetch en cada navegación
    retry: 1,
    retryDelay: 1000,
    // 404 = sin suscripción → no es un error crítico
    throwOnError: false,
  });

  const tieneAcceso =
    esSuperAdmin ||
    (!!suscripcion && ESTADOS_CON_ACCESO.includes(suscripcion.estado));

  const estaVencida = !esSuperAdmin && !!suscripcion && suscripcion.estado === 'VENCIDA';

  // Solo mostrar "cargando" cuando el usuario normal está autenticado y no hemos resuelto aún
  const cargando = isAuthenticated && !esSuperAdmin && isLoading;

  return {
    tieneAcceso,
    estaVencida,
    cargando,
    esSuperAdmin,
    suscripcion: suscripcion ?? null,
    refetch,
  };
}
