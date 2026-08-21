import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { notificacionesService } from '../services/notificacionesService';

export function useNotificaciones() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  // SUPER_ADMIN no tiene empresa → no tiene notificaciones de facturación
  const enabled = isAuthenticated && !!user && user.rol !== 'SUPER_ADMIN' && user.rol !== 'FIRMADOR';

  const queryClient = useQueryClient();

  const { data: notificaciones = [] } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: notificacionesService.getNotificaciones,
    enabled,
    refetchInterval: 30_000,       // refresca cada 30 s
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const { mutate: marcarLeida } = useMutation({
    mutationFn: notificacionesService.marcarLeida,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const { mutate: marcarTodasLeidas } = useMutation({
    mutationFn: notificacionesService.marcarTodasLeidas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas };
}
