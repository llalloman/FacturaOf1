import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  rol: string;
  empresa_id?: number;
  email_verificado: boolean;
  onboarding_completado: boolean;
  debe_cambiar_password?: boolean;
  /** Códigos de módulos accesibles según el plan de suscripción activo */
  modulos_activos?: string[];
  membresias?: EmpresaMembresia[];
  es_plataforma?: boolean;
  accesos_plataforma?: { rol: string; alcances: string[] }[];
}

export interface EmpresaMembresia {
  id: number | null;
  usuario?: number;
  empresa: number;
  empresa_nombre: string;
  empresa_activa: boolean;
  rol_empresa: string;
  modulos: string[];
  activa: boolean;
  predeterminada: boolean;
  metadatos?: Record<string, unknown>;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // shortcuts for components that need raw tokens
  token: string | null;
  activeEmpresaId: number | null;
  
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (partial: Partial<User>) => void;
  setActiveEmpresa: (empresaId: number | null) => void;
  logout: () => void;
}

const storedUser = (): User | null => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

export const isPlatformIdentity = (user: User | null | undefined): boolean =>
  Boolean(
    user?.es_plataforma ||
    user?.rol === 'SUPER_ADMIN' ||
    (user?.accesos_plataforma && user.accesos_plataforma.length > 0),
  );

export const defaultEmpresaId = (user: User | null | undefined): number | null => {
  if (!user) return null;
  const membershipEmpresa =
    user.membresias?.find((membership) => membership.predeterminada)?.empresa ??
    user.membresias?.[0]?.empresa ??
    null;
  // A platform identity must select a tenant explicitly. Its legacy
  // user.empresa is not an implicit active context.
  return isPlatformIdentity(user) ? membershipEmpresa : (user.empresa_id ?? membershipEmpresa);
};

const initialUser = storedUser();

export const restoreActiveEmpresaId = (user: User | null, storedValue: string | null): number | null => {
  const stored = Number(storedValue) || null;
  if (!stored || !isPlatformIdentity(user)) return stored;
  // A platform session may only restore a tenant explicitly present in its
  // memberships. This prevents a browser's previous tenant from leaking into
  // a newly hydrated platform session.
  return user?.membresias?.some((membership) => membership.empresa === stored && membership.activa)
    ? stored
    : null;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  token: localStorage.getItem('access_token'),
  activeEmpresaId: restoreActiveEmpresaId(initialUser, localStorage.getItem('active_empresa_id')) ?? defaultEmpresaId(initialUser),
  isAuthenticated: !!localStorage.getItem('access_token'),

  setAuth: (user, accessToken, refreshToken) => {
    const selectedEmpresaId = defaultEmpresaId(user);
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    if (selectedEmpresaId == null) localStorage.removeItem('active_empresa_id');
    else localStorage.setItem('active_empresa_id', String(selectedEmpresaId));
    set({ user, accessToken, refreshToken, token: accessToken, activeEmpresaId: selectedEmpresaId, isAuthenticated: true });
  },

  updateUser: (partial) => {
    set((state) => {
      const updated = state.user ? { ...state.user, ...partial } : state.user;
      if (updated) localStorage.setItem('user', JSON.stringify(updated));
      return { user: updated };
    });
  },

  setActiveEmpresa: (empresaId) => {
    if (empresaId == null) localStorage.removeItem('active_empresa_id');
    else localStorage.setItem('active_empresa_id', String(empresaId));
    set({ activeEmpresaId: empresaId });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('active_empresa_id');
    set({ user: null, accessToken: null, refreshToken: null, token: null, activeEmpresaId: null, isAuthenticated: false });
  },
}));
