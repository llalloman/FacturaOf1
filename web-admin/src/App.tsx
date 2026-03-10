import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegistroEmpresaPage from './pages/RegistroEmpresaPage';
import VerificacionEmailPage from './pages/VerificacionEmailPage';
import BienvenidaPage from './pages/BienvenidaPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import ProductosPage from './pages/productos/ProductosPage';
import ClientesPage from './pages/clientes/ClientesPage';
import FacturasPage from './pages/facturas/FacturasPage';
import InventariosPage from './pages/inventarios/InventariosPage';
import ProveedoresPage from './pages/proveedores/ProveedoresPage';
import VentasPage from './pages/ventas/VentasPage';
import ConfiguracionPage from './pages/configuracion/ConfiguracionPage';
import ReportesPage from './pages/reportes/ReportesPage';
import EmpresasPage from './pages/empresas/EmpresasPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';
import POSPage from './pages/pos/POSPage';
import RetencionesPage from './pages/retenciones/RetencionesPage';
import GuiasRemisionPage from './pages/guias/GuiasRemisionPage';
import NotasDebitoPage from './pages/notas-debito/NotasDebitoPage';
import NotasCreditoPage from './pages/notas-credito/NotasCreditoPage';
import CarteraPage from './pages/cartera/CarteraPage';
import DeclaracionesPage from './pages/declaraciones/DeclaracionesPage';
import CotizacionesPage from './pages/cotizaciones/CotizacionesPage';
import ContabilidadPage from './pages/contabilidad/ContabilidadPage';
import BancosPage from './pages/bancos/BancosPage';
import SuscripcionesPage from './pages/suscripciones/SuscripcionesPage';
import SuscripcionesAdminPage from './pages/empresas/SuscripcionesAdminPage';
import RecuperarPasswordPage from './pages/RecuperarPasswordPage';
import CambiarPasswordPage from './pages/CambiarPasswordPage';
import MesasPage from './pages/pedidos/MesasPage';
import PedidoDetallePage from './pages/pedidos/PedidoDetallePage';
import ToastContainer from './components/ToastContainer';
import ConfirmModal from './components/ConfirmModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Determine where an authenticated user should be redirected based on onboarding state
  const authenticatedHome = () => {
    if (user?.rol === 'SUPER_ADMIN') return '/';
    if (!user?.email_verificado) return '/verificar-email';
    if (user?.debe_cambiar_password) return '/cambiar-password';
    if (!user?.onboarding_completado) return '/onboarding';
    return '/';
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to={authenticatedHome()} /> : <LoginPage />}
          />
          <Route
            path="/registro"
            element={isAuthenticated ? <Navigate to={authenticatedHome()} /> : <RegistroEmpresaPage />}
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

          {/* Bienvenida — requires verified email; SUPER_ADMIN skips */}
          <Route
            path="/bienvenida"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" />
              ) : user?.rol === 'SUPER_ADMIN' || !user?.email_verificado ? (
                <Navigate to={authenticatedHome()} />
              ) : (
                <BienvenidaPage />
              )
            }
          />

          {/* Onboarding wizard — requires verified email, onboarding not done; SUPER_ADMIN skips */}
          <Route
            path="/onboarding"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" />
              ) : user?.rol === 'SUPER_ADMIN' || !user?.email_verificado ? (
                <Navigate to={authenticatedHome()} />
              ) : user?.onboarding_completado ? (
                <Navigate to="/" />
              ) : (
                <OnboardingPage />
              )
            }
          />

          {/* POS - pantalla completa, sin el Layout del admin */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <POSPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="facturacion" element={<FacturasPage />} />
            <Route path="inventarios" element={
              <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'VENDEDOR']}>
                <InventariosPage />
              </ProtectedRoute>
            } />
            <Route path="proveedores" element={
              <ProtectedRoute allowedRoles={['ADMIN_EMPRESA']}>
                <ProveedoresPage />
              </ProtectedRoute>
            } />
            <Route path="productos" element={<ProductosPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="ventas" element={<VentasPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="configuracion" element={
              <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'SUPER_ADMIN']}>
                <ConfiguracionPage />
              </ProtectedRoute>
            } />
            <Route path="retenciones" element={<RetencionesPage />} />
            <Route path="guias-remision" element={<GuiasRemisionPage />} />
            <Route path="notas-debito" element={<NotasDebitoPage />} />
            <Route path="notas-credito" element={<NotasCreditoPage />} />
            <Route path="cartera" element={<CarteraPage />} />
            <Route path="declaraciones" element={<DeclaracionesPage />} />
            <Route path="cotizaciones" element={<CotizacionesPage />} />
            <Route path="contabilidad" element={<ContabilidadPage />} />
            <Route path="bancos" element={<BancosPage />} />
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
            <Route path="usuarios" element={
              <ProtectedRoute allowedRoles={['ADMIN_EMPRESA', 'SUPER_ADMIN']}>
                <UsuariosPage />
              </ProtectedRoute>
            } />
            <Route path="pedidos" element={<MesasPage />} />
            <Route path="pedidos/:id" element={<PedidoDetallePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer />
      <ConfirmModal />
    </QueryClientProvider>
  );
}

export default App;
