import apiClient from '../lib/apiClient';

interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  rol: string;
  empresa_id?: number;
  email_verificado: boolean;
  onboarding_completado: boolean;
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: UserInfo;
}

export interface RegistroData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  cedula?: string;
  telefono?: string;
  ciudad?: string;
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/login/', credentials);
    return data;
  },

  registroEmpresa: async (payload: RegistroData): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/registro-empresa/', payload);
    return data;
  },

  verificarEmail: async (codigo: string): Promise<{ detail: string; user: UserInfo }> => {
    const { data } = await apiClient.post('/auth/verificar-email/', { codigo });
    return data;
  },

  reenviarCodigo: async (): Promise<{ detail: string; reenvios_restantes: number }> => {
    const { data } = await apiClient.post('/auth/reenviar-codigo/');
    return data;
  },

  consultarRuc: async (ruc: string) => {
    const { data } = await apiClient.get(`/auth/consultar-ruc/${ruc}/`);
    return data;
  },

  validarCertificado: async (formData: FormData) => {
    const { data } = await apiClient.post('/auth/validar-certificado/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  completarOnboarding: async (formData: FormData) => {
    const { data } = await apiClient.post('/auth/completar-onboarding/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
