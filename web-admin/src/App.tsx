import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/ToastContainer';
import ConfirmModal from './components/ConfirmModal';
import ModuloGuard from './components/ModuloGuard';
import WhatsAppHelpWidget from './components/WhatsAppHelpWidget';
import { useSubscriptionStatus } from './hooks/useSubscriptionStatus';
import { Loader2 } from 'lucide-react';

// ─── Lazy-loaded pages ──────────────────────────────────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegistroEmpresaPage = lazy(() => import('./pages/RegistroEmpresaPage'));
const VerificacionEmailPage = lazy(() => import('./pages/VerificacionEmailPage'));
const BienvenidaPage = lazy(() => import('./pages/BienvenidaPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductosPage = lazy(() => import('./pages/productos/ProductosPage'));
const ClientesPage = lazy(() => import('./pages/clientes/ClientesPage'));
const FacturasPage = lazy(() => import('./pages/facturas/FacturasPage'));
const InventariosPage = lazy(() => import('./pages/inventarios/InventariosPage'));
const ProveedoresPage = lazy(() => import('./pages/proveedores/ProveedoresPage'));
const VentasPage = lazy(() => import('./pages/ventas/VentasPage'));
const ConfiguracionPage = lazy(() => import('./pages/configuracion/ConfiguracionPage'));
const ReportesPage = lazy(() => import('./pages/reportes/ReportesPage'));
const EmpresasPage = lazy(() => import('./pages/empresas/EmpresasPage'));
const UsuariosPage = lazy(() => import('./pages/usuarios/UsuariosPage'));
const POSPage = lazy(() => import('./pages/pos/POSPage'));
const RetencionesPage = lazy(() => import('./pages/retenciones/RetencionesPage'));
const GuiasRemisionPage = lazy(() => import('./pages/guias/GuiasRemisionPage'));
const NotasDebitoPage = lazy(() => import('./pages/notas-debito/NotasDebitoPage'));
const NotasCreditoPage = lazy(() => import('./pages/notas-credito/NotasCreditoPage'));
const CarteraPage = lazy(() => import('./pages/cartera/CarteraPage'));
const DeclaracionesPage = lazy(() => import('./pages/declaraciones/DeclaracionesPage'));
const CotizacionesPage = lazy(() => import('./pages/cotizaciones/CotizacionesPage'));
const ContabilidadPage = lazy(() => import('./pages/contabilidad/ContabilidadPage'));
const BancosPage = lazy(() => import('./pages/bancos/BancosPage'));
const NominaPage = lazy(() => import('./pages/nomina/NominaPage'));
const SuscripcionesPage = lazy(() => import('./pages/suscripciones/SuscripcionesPage'));
const SuscripcionesAdminPage = lazy(() => import('./pages/empresas/SuscripcionesAdminPage'));
const RecuperarPasswordPage = lazy(() => import('./pages/RecuperarPasswordPage'));
const CambiarPasswordPage = lazy(() => import('./pages/CambiarPasswordPage'));
const MesasPage = lazy(() => import('./pages/pedidos/MesasPage'));
const PedidoDetallePage = lazy(() => import('./pages/pedidos/PedidoDetallePage'));
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const TerminosPage = lazy(() => import('./pages/legal/TerminosPage'));
const PrivacidadPage = lazy(() => import('./pages/legal/PrivacidadPage'));
const MatrizPermisosPage = lazy(() => import('./pages/empresas/MatrizPermisosPage'));
const CatalogoModulosPage = lazy(() => import('./pages/empresas/CatalogoModulosPage'));
const SolicitudesFirmaPage = lazy(() => import('./pages/firmas/SolicitudesFirmaPage'));
const PreciosFirmaPage = lazy(() => import('./pages/firmas/PreciosFirmaPage'));
const AutomationLeadsPage = lazy(() => import('./pages/automation/AutomationLeadsPage'));
const PagosOnlinePage = lazy(() => import('./pages/pagos/PagosOnlinePage'));
const SolicitarDemoPage = lazy(() => import('./pages/public/SolicitarDemoPage'));
const SolicitarFirmaElectronicaPage = lazy(() => import('./pages/public/SolicitarFirmaElectronicaPage'));
const FirmaPagoResultadoPage = lazy(() => import('./pages/public/FirmaPagoResultadoPage'));
const FirmadorPage = lazy(() => import('./pages/firmador/FirmadorPage'));
const RegistroFirmadorPage = lazy(() => import('./pages/firmador/RegistroFirmadorPage'));

/** Spinner global usado mientras se verifica el estado de suscripción */
function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ─── Layout routes extracted to reduce cognitive complexity ─────────────────
const appLayoutRoutes = (
  <>
    <Route index element={<DashboardPage />} />
    <Route path="facturacion" element={
      <ModuloGuard modulo="facturacion"><FacturasPage /></ModuloGuard>
    } />
    <Route path="inventarios" element={
      <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'VENDEDOR']}>
        <ModuloGuard modulo="inventarios"><InventariosPage /></ModuloGuard>
      </ProtectedRoute>
    } />
    <Route path="proveedores" element={
      <ProtectedRoute allowedRoles={['ADMIN_EMPRESA']}>
        <ModuloGuard modulo="proveedores"><ProveedoresPage /></ModuloGuard>
      </ProtectedRoute>
    } />
    <Route path="productos" element={
      <ModuloGuard modulo="productos"><ProductosPage /></ModuloGuard>
    } />
    <Route path="clientes" element={
      <ModuloGuard modulo="clientes"><ClientesPage /></ModuloGuard>
    } />
    <Route path="ventas" element={
      <ModuloGuard modulo="ventas"><VentasPage /></ModuloGuard>
    } />
    <Route path="reportes" element={
      <ModuloGuard modulo="reportes"><ReportesPage /></ModuloGuard>
    } />
    <Route path="configuracion" element={
      <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'SUPER_ADMIN']}>
        <ConfiguracionPage />
      </ProtectedRoute>
    } />
    <Route path="retenciones" element={
      <ModuloGuard modulo="retenciones"><RetencionesPage /></ModuloGuard>
    } />
    <Route path="guias-remision" element={
      <ModuloGuard modulo="guias_remision"><GuiasRemisionPage /></ModuloGuard>
    } />
    <Route path="notas-debito" element={
      <ModuloGuard modulo="notas_debito"><NotasDebitoPage /></ModuloGuard>
    } />
    <Route path="notas-credito" element={
      <ModuloGuard modulo="notas_credito"><NotasCreditoPage /></ModuloGuard>
    } />
    <Route path="cartera" element={
      <ModuloGuard modulo="cartera"><CarteraPage /></ModuloGuard>
    } />
    <Route path="declaraciones" element={
      <ModuloGuard modulo="declaraciones"><DeclaracionesPage /></ModuloGuard>
    } />
    <Route path="cotizaciones" element={
      <ModuloGuard modulo="cotizaciones"><CotizacionesPage /></ModuloGuard>
    } />
    <Route path="contabilidad" element={
      <ModuloGuard modulo="contabilidad"><ContabilidadPage /></ModuloGuard>
    } />
    <Route path="bancos" element={
      <ModuloGuard modulo="bancos"><BancosPage /></ModuloGuard>
    } />
    <Route path="nomina" element={
      <ModuloGuard modulo="nomina"><NominaPage /></ModuloGuard>
    } />
    <Route path="firmas-electronicas" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <SolicitudesFirmaPage />
      </ProtectedRoute>
    } />
    <Route path="firmas-electronicas/precios" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <PreciosFirmaPage />
      </ProtectedRoute>
    } />
    <Route path="automation/leads" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <AutomationLeadsPage />
      </ProtectedRoute>
    } />
    <Route path="pagos-online" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN_EMPRESA']}>
        <PagosOnlinePage />
      </ProtectedRoute>
    } />
    <Route path="suscripcion" element={
      <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'SUPER_ADMIN']}>
        <SuscripcionesPage />
      </ProtectedRoute>
    } />
    <Route path="empresas" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <EmpresasPage />
      </ProtectedRoute>
    } />
    <Route path="suscripciones-admin" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <SuscripcionesAdminPage />
      </ProtectedRoute>
    } />
    <Route path="matriz-permisos" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <MatrizPermisosPage />
      </ProtectedRoute>
    } />
    <Route path="catalogo-modulos" element={
      <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
        <CatalogoModulosPage />
      </ProtectedRoute>
    } />
    <Route path="usuarios" element={
      <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'SUPER_ADMIN']}>
        <ModuloGuard modulo="usuarios"><UsuariosPage /></ModuloGuard>
      </ProtectedRoute>
    } />
    <Route path="pedidos" element={
      <ModuloGuard modulo="pedidos"><MesasPage /></ModuloGuard>
    } />
    <Route path="pedidos/:id" element={
      <ModuloGuard modulo="pedidos"><PedidoDetallePage /></ModuloGuard>
    } />
    <Route path="firmador" element={
      <ModuloGuard modulo="firmador_pdf"><FirmadorPage /></ModuloGuard>
    } />
  </>
);

function AppRoutes() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const { tieneAcceso, cargando: cargandoSuscripcion, esSuperAdmin } = useSubscriptionStatus();
  const isFirmadorHost = typeof window !== 'undefined' && window.location.hostname.startsWith('firmador.');

  // Handle token expiry signalled by apiClient (avoids hard window.location redirect)
  useEffect(() => {
    const handler = () => {
      logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [logout, navigate]);

  /**
   * Determina la ruta de destino para un usuario autenticado.
   * Orden: cuenta → email → password → suscripción → onboarding → app
   */
  const authenticatedHome = (): string => {
    if (esSuperAdmin) return '/';
    if (!user?.email_verificado) return '/verificar-email';
    if (user?.debe_cambiar_password) return '/cambiar-password';
    if (user?.rol === 'FIRMADOR') return '/firmador';
    // Mientras cargamos la suscripción, mandamos a /bienvenida (página segura)
    if (cargandoSuscripcion) return '/bienvenida';
    if (!tieneAcceso) return '/bienvenida';
    return '/';
  };

  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to={authenticatedHome()} /> : <LoginPage />}
          />
          <Route
            path="/registro"
            element={isAuthenticated ? <Navigate to={authenticatedHome()} /> : <RegistroEmpresaPage />}
          />
          <Route
            path="/firmador/registro"
            element={isAuthenticated ? <Navigate to={authenticatedHome()} /> : <RegistroFirmadorPage />}
          />

          {/* Password recovery — public */}
          <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />

          {/* Forced password change — requires auth */}
          <Route
            path="/cambiar-password"
            element={isAuthenticated ? <CambiarPasswordPage /> : <Navigate to="/login" />}
          />

          {/* Email verification — requires auth, no email verified yet; SUPER_ADMIN skips */}
          <Route
            path="/verificar-email"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" />
              ) : user?.rol === 'SUPER_ADMIN' || user?.email_verificado ? (
                <Navigate to={authenticatedHome()} />
              ) : (
                <VerificacionEmailPage />
              )
            }
          />

          {/*
           * Bienvenida / elige plan
           * Visible para usuarios sin suscripción activa O sin onboarding completado.
           * Solo redirige a / cuando el usuario ya tiene suscripción activa Y completó el onboarding.
           * Esto evita loop: bienvenida → onboarding requiere suscripción → vuelve a bienvenida.
           */}
          <Route
            path="/bienvenida"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" state={{ from: '/bienvenida' }} replace />
              ) : !esSuperAdmin && !user?.email_verificado ? (
                <Navigate to="/verificar-email" replace />
              ) : user?.debe_cambiar_password ? (
                <Navigate to="/cambiar-password" replace />
              ) : cargandoSuscripcion ? (
                <AppLoader />
              ) : tieneAcceso ? (
                // Con suscripción activa → ir al dashboard
                <Navigate to="/" replace />
              ) : (
                // Sin suscripción O sin onboarding → mostrar planes
                <BienvenidaPage />
              )
            }
          />

          {/*
           * Onboarding — configuración inicial de empresa
           * No requiere suscripción activa (puede estar en prueba o aun sin plan).
           * Si ya completó onboarding → redirige al dashboard.
           */}
          <Route
            path="/onboarding"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : !esSuperAdmin && !user?.email_verificado ? (
                <Navigate to="/verificar-email" replace />
              ) : user?.debe_cambiar_password ? (
                <Navigate to="/cambiar-password" replace />
              ) : esSuperAdmin || user?.onboarding_completado ? (
                <Navigate to="/" replace />
              ) : (
                <OnboardingPage />
              )
            }
          />

          {/* Legal pages — public */}
          <Route path="/terminos" element={<TerminosPage />} />
          <Route path="/privacidad" element={<PrivacidadPage />} />
          <Route path="/terminos-y-condiciones" element={<TerminosPage />} />
          <Route path="/politica-privacidad" element={<PrivacidadPage />} />
          <Route path="/solicitar-demo" element={<SolicitarDemoPage />} />
          <Route path="/solicitar-firma-electronica" element={<SolicitarFirmaElectronicaPage />} />
          <Route path="/solicitar-firma-electronica/pago-confirmado" element={<FirmaPagoResultadoPage status="success" />} />
          <Route path="/solicitar-firma-electronica/pago-cancelado" element={<FirmaPagoResultadoPage status="cancelled" />} />
          <Route path="/solicitar-firma-electronica/pago-error" element={<FirmaPagoResultadoPage status="error" />} />

          {/* POS - pantalla completa, sin el Layout del admin */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <ModuloGuard modulo="pos" fullscreen>
                  <POSPage />
                </ModuloGuard>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/"
            element={
              !isAuthenticated ? (
                isFirmadorHost ? <Navigate to="/login" replace /> : <LandingPage />
              ) : (
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              )
            }
          >
            {appLayoutRoutes}
          </Route>
        </Routes>
      </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
        <ConfirmModal />
        <WhatsAppHelpWidget />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
