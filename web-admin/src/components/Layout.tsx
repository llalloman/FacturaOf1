import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useModulosAcceso } from '../hooks/useModulosAcceso';
import { RUTA_A_MODULO } from '../constants/modulos';
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
  FileCheck2,
  CreditCard,
  LayoutGrid,
  Landmark,
  FileBarChart2,
  ClipboardList,
  BookOpen,
  Banknote,
  UsersRound,
  ChevronDown,
  Lock,
  Shield,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNotificaciones } from '../hooks/useNotificaciones';

type MenuItem = { icon: React.ElementType; label: string; path: string };
type MenuGroup = { label: string; items: MenuItem[] };

// Menú agrupado por sección para empresas
const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'General',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ],
  },
  {
    label: 'Facturación SRI',
    items: [
      { icon: FileText,   label: 'Facturación',    path: '/facturacion' },
      { icon: Receipt,    label: 'Retenciones',    path: '/retenciones' },
      { icon: Truck,      label: 'Guías Remisión', path: '/guias-remision' },
      { icon: FileMinus,  label: 'Notas Débito',   path: '/notas-debito' },
      { icon: FileCheck2, label: 'Notas Crédito',  path: '/notas-credito' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { icon: Landmark,      label: 'Cartera',       path: '/cartera' },
      { icon: FileBarChart2, label: 'Declaraciones', path: '/declaraciones' },
      { icon: BookOpen,      label: 'Contabilidad',  path: '/contabilidad' },
      { icon: Banknote,      label: 'Bancos',        path: '/bancos' },
      { icon: UsersRound,    label: 'Nómina',        path: '/nomina' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { icon: ClipboardList, label: 'Cotizaciones',    path: '/cotizaciones' },
      { icon: ShoppingCart,  label: 'Ventas',          path: '/ventas' },
      { icon: LayoutGrid,    label: 'Mesas / Pedidos', path: '/pedidos' },
      { icon: Users,         label: 'Clientes',        path: '/clientes' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { icon: Package,     label: 'Productos',   path: '/productos' },
      { icon: ShoppingBag, label: 'Proveedores', path: '/proveedores' },
      { icon: Warehouse,   label: 'Inventarios', path: '/inventarios' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { icon: TrendingUp, label: 'Reportes',      path: '/reportes' },
      { icon: Settings,   label: 'Configuración', path: '/configuracion' },
      { icon: CreditCard, label: 'Suscripción',   path: '/suscripcion' },
    ],
  },
];

// Menú por rol (paths permitidos en el sidebar)
const ROL_PATHS: Record<string, string[]> = {
  ADMIN_EMPRESA: ['/', '/facturacion', '/retenciones', '/guias-remision', '/notas-debito', '/notas-credito', '/cartera', '/declaraciones', '/cotizaciones', '/contabilidad', '/bancos', '/nomina', '/inventarios', '/proveedores', '/productos', '/clientes', '/ventas', '/pedidos', '/reportes', '/configuracion', '/suscripcion'],
  CONTADOR:      ['/', '/facturacion', '/retenciones', '/guias-remision', '/notas-debito', '/notas-credito', '/cartera', '/declaraciones', '/contabilidad', '/bancos', '/nomina', '/clientes', '/reportes'],
  VENDEDOR:      ['/', '/ventas', '/pedidos', '/cotizaciones', '/clientes', '/productos'],
  CONSULTOR:     ['/', '/facturacion', '/retenciones', '/ventas', '/reportes'],
};

// Menú exclusivo del Super Admin (no está atado a ninguna empresa)
const menuItemsSuperAdmin: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',       path: '/' },
  { icon: Building2,       label: 'Empresas',         path: '/empresas' },
  { icon: CreditCard,      label: 'Suscripciones',   path: '/suscripciones-admin' },
  { icon: Shield,          label: 'Matriz de Acceso', path: '/matriz-permisos' },
  { icon: Users,           label: 'Usuarios',         path: '/usuarios' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Menú filtrado por rol del usuario
  const rol = user?.rol ?? '';
  const allowedPaths = ROL_PATHS[rol] ?? ROL_PATHS['ADMIN_EMPRESA'];
  const { tieneAccesoModulo } = useModulosAcceso();
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotificaciones();
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const iconoTipo = (tipo: string) => {
    switch (tipo) {
      case 'ERROR':       return <AlertCircle size={16} className="text-red-500 flex-shrink-0" />;
      case 'ADVERTENCIA': return <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />;
      case 'EXITO':       return <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />;
      default:            return <Info size={16} className="text-blue-500 flex-shrink-0" />;
    }
  };

  const menuGroups = MENU_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => allowedPaths.includes(i.path)) }))
    .filter((g) => g.items.length > 0);
  const showPOS = rol !== 'CONSULTOR';

  // Abrir automáticamente el grupo que contiene la ruta activa
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach((g) => {
      if (g.items.some((i) => isActive(i.path))) initial[g.label] = true;
    });
    setOpenGroups(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Skip to main content link — visible only on focus (keyboard nav) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-blue-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Ir al contenido principal
      </a>

      {/* Backdrop para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 h-full md:h-screen flex-shrink-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-300 flex flex-col ${
        sidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full md:translate-x-0 md:w-20'
      }`}>
        {/* Logo */}
        <div className="border-b border-gray-700/80">
          {sidebarOpen ? (
            <div className="px-4 pt-5 pb-3 flex items-center justify-between gap-2">
              <div className="bg-white rounded-2xl shadow-xl flex-1 h-20 overflow-hidden">
                <img
                  src="/logo-of1-1.png"
                  alt="OF1 Solutions"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white flex-shrink-0">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-3 px-2">
              <div className="bg-white rounded-xl shadow-lg w-full h-14 overflow-hidden">
                <img
                  src="/logo-of1-1.png"
                  alt="OF1 Solutions"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white">
                <Menu size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Menú principal" className="flex-1 p-4 space-y-1 overflow-y-auto">
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
            /* Usuarios con empresa: menú agrupado desplegable */
            <>
              {menuGroups.map((group) => {
                const isOpen = !!openGroups[group.label];
                const hasActive = group.items.some((i) => isActive(i.path));
                return (
                  <div key={group.label} className="mb-0.5">
                    {sidebarOpen ? (
                      /* Cabecera del grupo — clickable */
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                          hasActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    ) : (
                      <div className="my-1 border-t border-gray-700/60" />
                    )}

                    {/* Ítems del grupo */}
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        !sidebarOpen || isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      {group.items.map((item) => {
                        const codigoModulo = RUTA_A_MODULO[item.path];
                        const bloqueado = codigoModulo ? !tieneAccesoModulo(codigoModulo) : false;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            title={bloqueado ? 'Módulo no incluido en tu plan. Haz clic para ver detalles.' : undefined}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                              isActive(item.path)
                                ? 'bg-gradient-to-r from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                                : bloqueado
                                ? 'opacity-50 hover:bg-gray-800/50 cursor-pointer'
                                : 'hover:bg-gray-800 hover:translate-x-1'
                            }`}
                          >
                            <item.icon size={20} className={isActive(item.path) ? 'text-white' : 'text-gray-400'} />
                            {sidebarOpen && (
                              <span className={`flex-1 text-sm font-medium ${
                                isActive(item.path) ? 'text-white' : 'text-gray-300'
                              }`}>
                                {item.label}
                              </span>
                            )}
                            {sidebarOpen && bloqueado && (
                              <Lock size={12} className="text-gray-500 flex-shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Gestión de usuarios para ADMIN_EMPRESA */}
              {user?.rol === 'ADMIN_EMPRESA' && (
                <>
                  {sidebarOpen && <div className="my-1 border-t border-gray-700/60" />}
                  <Link
                    to="/usuarios"
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive('/usuarios')
                        ? 'bg-gradient-to-r from-blue-700 to-blue-900 shadow-lg shadow-blue-900/50'
                        : 'hover:bg-gray-800 hover:translate-x-1'
                    }`}
                  >
                    <Users size={20} className={isActive('/usuarios') ? 'text-white' : 'text-gray-400'} />
                    {sidebarOpen && (
                      <span className={`text-sm font-medium ${isActive('/usuarios') ? 'text-white' : 'text-gray-300'}`}>
                        Usuarios
                      </span>
                    )}
                  </Link>
                </>
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
          {/* Botón hamburguesa para móvil */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 mr-2 flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} className="text-gray-600" />
          </button>
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar productos, clientes, facturas..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Buscar productos, clientes, facturas"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-6">
            {/* Campanita de notificaciones */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative p-3 hover:bg-gray-100 rounded-xl transition-colors"
                aria-label="Notificaciones"
              >
                <Bell size={22} className="text-gray-600" />
                {noLeidas > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {noLeidas > 9 ? '9+' : noLeidas}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-gray-500" />
                      <span className="font-semibold text-gray-800 text-sm">Notificaciones</span>
                      {noLeidas > 0 && (
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                          {noLeidas} nueva{noLeidas !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {noLeidas > 0 && (
                      <button
                        onClick={() => marcarTodasLeidas()}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        <CheckCheck size={13} />
                        Marcar todas
                      </button>
                    )}
                  </div>

                  {/* Lista */}
                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                    {notificaciones.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <Bell size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">Sin notificaciones</p>
                      </div>
                    ) : (
                      notificaciones.map((n) => (
                        <div
                          key={n.id}
                          className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            n.leida ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/60 hover:bg-blue-50'
                          }`}
                          onClick={() => {
                            if (!n.leida) marcarLeida(n.id);
                            if (n.url) {
                              setBellOpen(false);
                              navigate(n.url);
                            }
                          }}
                        >
                          <div className="pt-0.5">{iconoTipo(n.tipo)}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${n.leida ? 'text-gray-600' : 'text-gray-900'}`}>
                              {n.titulo}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.mensaje}</p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {new Date(n.fecha_creacion).toLocaleString('es-EC', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {!n.leida && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
