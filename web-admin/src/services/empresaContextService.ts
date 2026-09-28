import apiClient from './apiClient';
import type { EmpresaMembresia } from '../store/authStore';

export const empresaContextService = {
  async listar(): Promise<EmpresaMembresia[]> {
    const { data } = await apiClient.get<EmpresaMembresia[]>('/usuarios/contextos/');
    return data;
  },

  async seleccionar(empresaId: number): Promise<EmpresaMembresia> {
    const { data } = await apiClient.post<EmpresaMembresia>('/usuarios/contextos/', {
      empresa_id: empresaId,
    });
    localStorage.setItem('active_empresa_id', String(empresaId));
    return data;
  },
};
