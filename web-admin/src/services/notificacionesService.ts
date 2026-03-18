import apiClient from './apiClient';

export interface Notificacion {
  id: number;
  tipo: 'ERROR' | 'ADVERTENCIA' | 'EXITO' | 'INFO';
  titulo: string;
  mensaje: string;
  url: string;
  leida: boolean;
  fecha_creacion: string;
}

export const notificacionesService = {
  getNotificaciones: async (): Promise<Notificacion[]> => {
    const { data } = await apiClient.get('/empresas/notificaciones/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  marcarLeida: async (id: number): Promise<void> => {
    await apiClient.post(`/empresas/notificaciones/${id}/marcar_leida/`);
  },

  marcarTodasLeidas: async (): Promise<void> => {
    await apiClient.post('/empresas/notificaciones/marcar_todas_leidas/');
  },
};
