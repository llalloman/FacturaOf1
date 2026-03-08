import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
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
import SuscripcionesPage from './pages/suscripciones/SuscripcionesPage';
import SuscripcionesAdminPage from './pages/empresas/SuscripcionesAdminPage';

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

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />}
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
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
