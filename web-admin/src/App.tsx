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
            <Route path="inventarios" element={<InventariosPage />} />
            <Route path="proveedores" element={<ProveedoresPage />} />
            <Route path="productos" element={<ProductosPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="ventas" element={<VentasPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="configuracion" element={<ConfiguracionPage />} />
            <Route path="empresas" element={<EmpresasPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
