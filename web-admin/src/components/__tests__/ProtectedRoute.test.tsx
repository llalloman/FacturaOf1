import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../ProtectedRoute';

const authState = {
  isAuthenticated: false,
  user: null as Record<string, unknown> | null,
};

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
  isPlatformIdentity: (user: Record<string, unknown> | null) => Boolean(
    user?.es_plataforma || user?.rol === 'SUPER_ADMIN' || user?.accesos_plataforma,
  ),
}));

vi.mock('../../hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    tieneAcceso: true,
    estaVencida: false,
    cargando: false,
    esSuperAdmin: false,
  }),
}));

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/privado']}>
      <Routes>
        <Route
          path="/privado"
          element={(
            <ProtectedRoute allowedRoles={['ADMIN_EMPRESA']}>
              <div>contenido privado</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<div>login</div>} />
        <Route path="/verificar-email" element={<div>verificar email</div>} />
        <Route path="/" element={<div>inicio</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.user = null;
  });

  it('redirige una sesión no autenticada a login', () => {
    renderRoute();
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('redirige un usuario sin correo verificado', () => {
    authState.isAuthenticated = true;
    authState.user = { email_verificado: false, rol: 'VENDEDOR' };

    renderRoute();
    expect(screen.getByText('verificar email')).toBeInTheDocument();
  });

  it('redirige un rol que no tiene acceso a la ruta', () => {
    authState.isAuthenticated = true;
    authState.user = { email_verificado: true, rol: 'VENDEDOR' };

    renderRoute();
    expect(screen.getByText('inicio')).toBeInTheDocument();
  });

  it('renderiza el contenido para el rol autorizado', () => {
    authState.isAuthenticated = true;
    authState.user = { email_verificado: true, rol: 'ADMIN_EMPRESA' };

    renderRoute();
    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });

  it('permite capacidad de plataforma aunque el rol no sea SUPER_ADMIN', () => {
    authState.isAuthenticated = true;
    authState.user = {
      email_verificado: true,
      rol: 'AUDITOR',
      accesos_plataforma: [{ rol: 'AUDITOR', alcances: ['reportes'] }],
    };

    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={(
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']} platformCapability="reportes">
                <div>contenido plataforma</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/" element={<div>inicio</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('contenido plataforma')).toBeInTheDocument();
  });
});
