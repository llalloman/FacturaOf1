import apiClient from '../lib/apiClient';

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    rol: string;
    empresa_id?: number;
  };
}

export interface RegistroEmpresaData {
  ruc: string;
  razon_social: string;
  email_empresa: string;
  telefono?: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  plan_id?: number;
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/login/', credentials);
    return data;
  },

  registroEmpresa: async (payload: RegistroEmpresaData): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/registro-empresa/', payload);
    return data;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout/');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  },

  getCurrentUser: async () => {
    const { data } = await apiClient.get('/auth/me/');
    return data;
  },
};
