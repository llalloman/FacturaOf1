import axios from 'axios';

const resolveApiUrl = () => {
  const rawUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  const fallback =
    typeof window !== 'undefined' && window.location.hostname.endsWith('of1solutions.com')
      ? 'https://facturaof1-back.of1solutions.com/api'
      : 'http://localhost:8000/api';
  const baseUrl = rawUrl || fallback;
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const API_URL = resolveApiUrl();

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Promise compartida para que múltiples requests 401 simultáneos usen UN solo refresh
// (evita la carrera con ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION)
let refreshPromise: Promise<string> | null = null;

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No interceptar 401 en endpoints de autenticación (login, registro, etc.)
    const url = originalRequest?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login/') ||
      url.includes('/auth/registro') ||
      url.includes('/auth/refresh/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        // Si ya hay un refresh en curso, reusar el mismo promise
        if (!refreshPromise) {
          const refreshToken = localStorage.getItem('refresh_token');
          refreshPromise = axios
            .post(`${API_URL}/auth/refresh/`, { refresh: refreshToken })
            .then((r) => {
              const { access, refresh } = r.data;
              localStorage.setItem('access_token', access);
              // Con ROTATE_REFRESH_TOKENS el servidor devuelve un nuevo refresh token
              if (refresh) localStorage.setItem('refresh_token', refresh);
              return access as string;
            })
            .catch((err) => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              window.location.href = '/login';
              throw err;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        
        const newAccess = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
