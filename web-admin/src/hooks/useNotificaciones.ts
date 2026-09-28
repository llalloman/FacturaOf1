import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { notificacionesService } from '../services/notificacionesService';

export function useNotificaciones() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const activeEmpresaId = useAuthStore((s) => s.activeEmpresaId);
  // SUPER_ADMIN no tiene empresa → no tiene notificaciones de facturación
  const enabled = isAuthenticated && !!user && user.rol !== 'FIRMADOR' &&
    (user.es_plataforma !== true || activeEmpresaId != null);

  const queryClient = useQueryClient();

  const { data: notificaciones = [] } = useQuery({
    queryKey: ['notificaciones', activeEmpresaId],
    queryFn: notificacionesService.getNotificaciones,
    enabled,
    refetchInterval: 30_000,       // refresca cada 30 s
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const { mutate: marcarLeida } = useMutation({
    mutationFn: notificacionesService.marcarLeida,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones', activeEmpresaId] }),
  });

  const { mutate: marcarTodasLeidas } = useMutation({
    mutationFn: notificacionesService.marcarTodasLeidas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones', activeEmpresaId] }),
  });

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas };
}
