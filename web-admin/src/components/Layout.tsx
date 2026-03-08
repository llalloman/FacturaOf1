import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  ShoppingCart,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Warehouse,
  ShoppingBag,
  Bell,
  Search,
  Building2,
  Tablet,
  Receipt,
  Truck,
  FileMinus,
  CreditCard,
} from 'lucide-react';
import { useState } from 'react';

type MenuItem = { icon: React.ElementType; label: string; path: string };

// Todos los ítems disponibles para empresas
const ALL_ITEMS: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',      path: '/' },
  { icon: FileText,        label: 'Facturación',    path: '/facturacion' },
  { icon: Receipt,         label: 'Retenciones',    path: '/retenciones' },
  { icon: Truck,           label: 'Guías Remisión', path: '/guias-remision' },
  { icon: FileMinus,       label: 'Notas Débito',  path: '/notas-debito' },
  { icon: Warehouse,       label: 'Inventarios',    path: '/inventarios' },
  { icon: ShoppingBag,     label: 'Proveedores',    path: '/proveedores' },
  { icon: Package,         label: 'Productos',      path: '/productos' },
  { icon: Users,           label: 'Clientes',       path: '/clientes' },
  { icon: ShoppingCart,    label: 'Ventas',         path: '/ventas' },
  { icon: TrendingUp,      label: 'Reportes',       path: '/reportes' },
  { icon: Settings,        label: 'Configuración',  path: '/configuracion' },
  { icon: CreditCard,      label: 'Suscripción',    path: '/suscripcion' },
];

// Menú por rol (paths permitidos en el sidebar)
const ROL_PATHS: Record<string, string[]> = {
  ADMIN_EMPRESA: ['/', '/facturacion', '/retenciones', '/guias-remision', '/notas-debito', '/inventarios', '/proveedores', '/productos', '/clientes', '/ventas', '/reportes', '/configuracion', '/suscripcion'],
  CONTADOR:      ['/', '/facturacion', '/retenciones', '/guias-remision', '/notas-debito', '/clientes', '/reportes'],
  VENDEDOR:      ['/', '/ventas', '/clientes', '/productos'],
  CONSULTOR:     ['/', '/facturacion', '/retenciones', '/ventas', '/reportes'],
};

// Menú exclusivo del Super Admin (no está atado a ninguna empresa)
const menuItemsSuperAdmin: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',      path: '/' },
  { icon: Building2,       label: 'Empresas',        path: '/empresas' },
  { icon: CreditCard,      label: 'Suscripciones', path: '/suscripciones-admin' },
  { icon: Users,           label: 'Usuarios',        path: '/usuarios' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  // Menú filtrado por rol del usuario
  const rol = user?.rol ?? '';
  const allowedPaths = ROL_PATHS[rol] ?? ROL_PATHS['ADMIN_EMPRESA'];
  const menuItems = ALL_ITEMS.filter((item) => allowedPaths.includes(item.path));
  const showPOS = rol !== 'CONSULTOR';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-20'} flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/80">
          {sidebarOpen ? (
            <img
              src="/logo-of1-1.png"
              alt="OF1 Solutions"
              className="h-10 w-auto object-contain rounded-lg bg-white px-1.5 py-0.5 flex-shrink-0"
            />
          ) : (
            <img
              src="/logo-of1-1.png"
              alt="OF1 Solutions"
              className="h-8 w-8 object-contain rounded bg-white p-0.5 flex-shrink-0"
            />
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* SUPER_ADMIN: menú de administración de plataforma */}
          {user?.rol === 'SUPER_ADMIN' ? (
            <>
              {sidebarOpen && (
                <p className="px-4 pt-1 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Administración</p>
              )}
              {menuItemsSuperAdmin.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                      : 'hover:bg-gray-800 hover:translate-x-1'
                  }`}
                >
                  <item.icon size={22} className={isActive(item.path) ? 'text-white' : 'text-gray-400'} />
                  {sidebarOpen && <span className={`font-medium ${isActive(item.path) ? 'text-white' : 'text-gray-300'}`}>{item.label}</span>}
                </Link>
              ))}
            </>
          ) : (
            /* Usuarios con empresa: menú completo de operaciones */
            <>
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                      : 'hover:bg-gray-800 hover:translate-x-1'
                  }`}
                >
                  <item.icon size={22} className={isActive(item.path) ? 'text-white' : 'text-gray-400'} />
                  {sidebarOpen && <span className={`font-medium ${isActive(item.path) ? 'text-white' : 'text-gray-300'}`}>{item.label}</span>}
                </Link>
              ))}
              {/* Gestión de usuarios para ADMIN_EMPRESA */}
              {user?.rol === 'ADMIN_EMPRESA' && (
                <Link
                  to="/usuarios"
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    isActive('/usuarios')
                      ? 'bg-gradient-to-r from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                      : 'hover:bg-gray-800 hover:translate-x-1'
                  }`}
                >
                  <Users size={22} className={isActive('/usuarios') ? 'text-white' : 'text-gray-400'} />
                  {sidebarOpen && <span className={`font-medium ${isActive('/usuarios') ? 'text-white' : 'text-gray-300'}`}>Usuarios</span>}
                </Link>
              )}
              {/* Botón POS — solo roles que operan caja */}
              {showPOS && (
                <>
                  {sidebarOpen && (
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Punto de Venta</p>
                  )}
                  <a
                    href="/pos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 shadow-lg shadow-green-900/40 mt-1"
                  >
                    <Tablet size={22} className="text-white" />
                    {sidebarOpen && <span className="font-bold text-white">Abrir POS</span>}
                  </a>
                </>
              )}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700">
          <div className={`flex items-center gap-3 p-4 rounded-xl bg-gray-800 mb-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-slate-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {(user?.username || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{user?.username || user?.email}</p>
                <p className="text-xs text-gray-400">{user?.rol || 'Usuario'}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all ${!sidebarOpen && 'justify-center'}`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar productos, clientes, facturas..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-3 hover:bg-gray-100 rounded-xl transition-colors">
              <Bell size={22} className="text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
