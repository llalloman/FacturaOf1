import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useModulosAcceso } from '../hooks/useModulosAcceso';
import { MODULOS, RUTA_A_MODULO, type ModuloInfo } from '../constants/modulos';
import { suscripcionesService, type ModuloSistema } from '../services/suscripcionesService';
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
  Star,
  Layers3,
  FileSignature,
  BadgeDollarSign,
  Bot,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNotificaciones } from '../hooks/useNotificaciones';

type MenuItem = { icon: React.ElementType; label: string; path: string; external?: boolean };
type MenuGroup = { label: string; items: MenuItem[] };

const MODULO_ICONOS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  pos: Tablet,
  cotizaciones: ClipboardList,
  pedidos: LayoutGrid,
  ventas: ShoppingCart,
  clientes: Users,
  facturacion: FileText,
  notas_credito: FileCheck2,
  notas_debito: FileMinus,
  retenciones: Receipt,
  guias_remision: Truck,
  productos: Package,
  inventarios: Warehouse,
  proveedores: ShoppingBag,
  cartera: Landmark,
  bancos: Banknote,
  contabilidad: BookOpen,
  declaraciones: FileBarChart2,
  nomina: UsersRound,
  reportes: TrendingUp,
  usuarios: Users,
  configuracion: Settings,
  firmas_electronicas: FileSignature,
  firmador_pdf: FileSignature,
};

const ICONOS_POR_NOMBRE: Record<string, React.ElementType> = {
  LayoutDashboard,
  Tablet,
  ClipboardList,
  LayoutGrid,
  ShoppingCart,
  Users,
  FileText,
  FileCheck2,
  FileMinus,
  Receipt,
  Truck,
  Package,
  Warehouse,
  ShoppingBag,
  Landmark,
  Banknote,
  BookOpen,
  FileBarChart2,
  UsersRound,
  TrendingUp,
  Settings,
  CreditCard,
  FileSignature,
};

const EXTRA_MENU_ITEMS: Array<MenuItem & { grupo: string; roles?: string[] }> = [
  { icon: Users, label: 'Usuarios', path: '/usuarios', grupo: 'Administración', roles: ['ADMIN_EMPRESA'] },
  { icon: Settings, label: 'Configuración', path: '/configuracion', grupo: 'Administración', roles: ['ADMIN_EMPRESA'] },
  { icon: CreditCard, label: 'Suscripción', path: '/suscripcion', grupo: 'Administración' },
  { icon: CreditCard, label: 'Pagos Online', path: '/pagos-online', grupo: 'Administración', roles: ['ADMIN_EMPRESA'] },
];

const SUPER_ADMIN_ONLY_MODULE_CODES = new Set(['firmas_electronicas']);

const moduloToMenuItem = (modulo: ModuloInfo | ModuloSistema): MenuItem => ({
  icon: ('icono' in modulo && modulo.icono ? ICONOS_POR_NOMBRE[modulo.icono] : undefined)
    ?? MODULO_ICONOS[modulo.codigo]
    ?? FileText,
  label: modulo.label,
  path: modulo.ruta,
  external: 'external' in modulo ? Boolean(modulo.external) : modulo.codigo === 'pos',
});

const buildMenuGroups = (modulos: Array<ModuloInfo | ModuloSistema>, rol: string): MenuGroup[] => Array.from(
  [
    ...modulos.map((m) => m.grupo),
    ...EXTRA_MENU_ITEMS
      .filter((m) => !m.roles || m.roles.includes(rol))
      .map((m) => m.grupo),
  ]
    .reduce((set, grupo) => set.add(grupo), new Set<string>())
).map((grupo) => ({
  label: grupo,
  items: Array.from(
    [
      ...modulos.filter((m) => m.grupo === grupo).map(moduloToMenuItem),
      ...EXTRA_MENU_ITEMS.filter((m) => m.grupo === grupo && (!m.roles || m.roles.includes(rol))),
    ]
      .reduce((map, item) => map.set(item.path, item), new Map<string, MenuItem>())
      .values()
  ),
}));

// Menú por rol (paths permitidos en el sidebar)
const ROL_PATHS: Record<string, string[]> = {
  ADMIN_EMPRESA: ['/', '/pos', '/facturacion', '/retenciones', '/guias-remision', '/notas-debito', '/notas-credito', '/cartera', '/declaraciones', '/cotizaciones', '/contabilidad', '/bancos', '/nomina', '/inventarios', '/proveedores', '/productos', '/clientes', '/ventas', '/pedidos', '/reportes', '/configuracion', '/suscripcion', '/pagos-online', '/usuarios'],
  CONTADOR:      ['/', '/facturacion', '/retenciones', '/guias-remision', '/notas-debito', '/notas-credito', '/cartera', '/declaraciones', '/contabilidad', '/bancos', '/nomina', '/clientes', '/reportes'],
  VENDEDOR:      ['/', '/pos', '/ventas', '/pedidos', '/cotizaciones', '/clientes', '/productos'],
  CONSULTOR:     ['/', '/facturacion', '/retenciones', '/ventas', '/reportes'],
  FIRMADOR:      ['/firmador'],
};

// Menú exclusivo del Super Admin (no está atado a ninguna empresa)
const menuItemsSuperAdmin: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',       path: '/' },
  { icon: Building2,       label: 'Empresas',         path: '/empresas' },
  { icon: CreditCard,      label: 'Suscripciones',   path: '/suscripciones-admin' },
  { icon: Shield,          label: 'Matriz de Acceso', path: '/matriz-permisos' },
  { icon: Layers3,         label: 'Catálogo de Menús', path: '/catalogo-modulos' },
  { icon: FileSignature,   label: 'Solicitudes de Firma', path: '/firmas-electronicas' },
  { icon: BadgeDollarSign,  label: 'Precios de Firma', path: '/firmas-electronicas/precios' },
  { icon: FileSignature,   label: 'Admin Firmador', path: '/firmador-admin' },
  { icon: Bot,              label: 'Leads WhatsApp', path: '/automation/leads' },
  { icon: CreditCard,       label: 'Pagos Online', path: '/pagos-online' },
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
  const [favoritePaths, setFavoritePaths] = useState<string[]>([]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Menú filtrado por rol del usuario
  const rol = user?.rol ?? '';
  const rolePaths = ROL_PATHS[rol] ?? ROL_PATHS['ADMIN_EMPRESA'];
  const { tieneAccesoModulo } = useModulosAcceso();
  const { data: catalogoModulos = [] } = useQuery({
    queryKey: ['modulos-catalogo'],
    queryFn: () => suscripcionesService.getCatalogModulos(),
    enabled: !!user && user.rol !== 'SUPER_ADMIN' && user.rol !== 'FIRMADOR',
    staleTime: 5 * 60 * 1000,
  });
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotificaciones();
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const favoritesKey = user?.id ? `menu:favorites:${user.id}` : 'menu:favorites:anonymous';

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(favoritesKey);
      setFavoritePaths(raw ? JSON.parse(raw) as string[] : []);
    } catch {
      setFavoritePaths([]);
    }
  }, [favoritesKey]);

  const modulosMenu = (catalogoModulos.length > 0 ? catalogoModulos : MODULOS)
    .filter((modulo) => rol === 'SUPER_ADMIN' || !SUPER_ADMIN_ONLY_MODULE_CODES.has(modulo.codigo));
  const allowedPaths = rol === 'ADMIN_EMPRESA'
    ? Array.from(new Set([...rolePaths, ...modulosMenu.map((m) => m.ruta)]))
    : rolePaths;
  const rutaAModulo = {
    ...RUTA_A_MODULO,
    ...Object.fromEntries(modulosMenu.map((m) => [m.ruta, m.codigo])),
  };

  const adminBasePaths = new Set(['/usuarios', '/configuracion', '/suscripcion']);

  const isBlockedPath = (path: string) => {
    if (rol === 'ADMIN_EMPRESA' && adminBasePaths.has(path)) return false;
    const codigoModulo = rutaAModulo[path];
    return codigoModulo ? !tieneAccesoModulo(codigoModulo) : false;
  };

  const menuGroups = buildMenuGroups(modulosMenu, rol)
    .map((g) => ({ ...g, items: g.items.filter((i) => allowedPaths.includes(i.path)) }))
    .filter((g) => g.items.length > 0);
  const availableItems = menuGroups.flatMap((g) => g.items).filter((item) => !isBlockedPath(item.path));
  const favoriteItems = favoritePaths
    .map((path) => availableItems.find((item) => item.path === path))
    .filter((item): item is MenuItem => Boolean(item));
  const displayGroups = favoriteItems.length > 0
    ? [{ label: 'Favoritos', items: favoriteItems }, ...menuGroups]
    : menuGroups;

  const toggleFavorite = (path: string) => {
    setFavoritePaths((prev) => {
      const wasFavorite = prev.includes(path);
      const next = wasFavorite
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      localStorage.setItem(favoritesKey, JSON.stringify(next));
      if (!wasFavorite) {
        setOpenGroups((groups) => ({ ...groups, Favoritos: true }));
      }
      return next;
    });
  };

  // Abrir automáticamente el grupo que contiene la ruta activa
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    displayGroups.forEach((g) => {
      if (g.items.some((i) => isActive(i.path))) initial[g.label] = true;
    });
    if (favoriteItems.length > 0) initial.Favoritos = true;
    setOpenGroups(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isFirmador = rol === 'FIRMADOR';
  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const displayName = fullName || user?.username || user?.email || 'Usuario';
  const userInitial = displayName.charAt(0).toUpperCase();
  const searchPlaceholder = isFirmador ? 'Buscar documentos firmados...' : 'Buscar en el sistema...';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
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
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 h-full md:h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 flex flex-col ${
        sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-16'
      }`}>
        {/* Logo */}
        <div className="border-b border-slate-800">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="h-12 flex-1 overflow-hidden rounded-lg bg-white">
                <img
                  src="/logo-of1-1.png"
                  alt="OF1 Solutions"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-2 py-3">
              <div className="h-10 w-10 overflow-hidden rounded-lg bg-white">
                <img
                  src="/logo-of1-1.png"
                  alt="OF1 Solutions"
                  className="h-full w-full object-contain p-0.5"
                />
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                <Menu size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Menú principal" className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {/* SUPER_ADMIN: menú de administración de plataforma */}
          {user?.rol === 'SUPER_ADMIN' ? (
            <>
              {sidebarOpen && (
                <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase text-slate-500">Administración</p>
              )}
              {menuItemsSuperAdmin.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <item.icon size={19} className={isActive(item.path) ? 'text-white' : 'text-slate-400'} />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              ))}
            </>
          ) : (
            /* Usuarios con empresa: menú agrupado desplegable */
            <>
              {displayGroups.map((group) => {
                const isOpen = !!openGroups[group.label];
                const hasActive = group.items.some((i) => isActive(i.path));
                return (
                  <div key={group.label} className="mb-0.5">
                    {sidebarOpen ? (
                      /* Cabecera del grupo — clickable */
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                          hasActive ? 'text-blue-300' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-[11px] font-semibold uppercase">{group.label}</span>
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    ) : (
                      <div className="my-1 border-t border-slate-800" />
                    )}

                    {/* Ítems del grupo */}
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        !sidebarOpen || isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      {group.items.map((item) => {
                        const codigoModulo = rutaAModulo[item.path];
                        const bloqueado = codigoModulo ? !tieneAccesoModulo(codigoModulo) : false;
                        const isFavorite = favoritePaths.includes(item.path);
                        const itemClassName = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          isActive(item.path)
                            ? 'bg-blue-700 text-white'
                            : bloqueado
                            ? 'cursor-pointer opacity-50 hover:bg-slate-900/70'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`;
                        const itemContent = (
                          <>
                            <item.icon size={18} className={isActive(item.path) ? 'text-white' : 'text-slate-400'} />
                            {sidebarOpen && (
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {item.label}
                              </span>
                            )}
                            {sidebarOpen && bloqueado && (
                              <Lock size={12} className="flex-shrink-0 text-slate-500" />
                            )}
                          </>
                        );
                        return (
                          <div key={`${group.label}-${item.path}`} className="group/item flex items-center gap-1">
                            {item.external ? (
                              <a
                                href={item.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={bloqueado ? 'Módulo no incluido en tu plan. Haz clic para ver detalles.' : undefined}
                                className={`${itemClassName} flex-1 min-w-0`}
                              >
                                {itemContent}
                              </a>
                            ) : (
                              <Link
                                to={item.path}
                                title={bloqueado ? 'Módulo no incluido en tu plan. Haz clic para ver detalles.' : undefined}
                                className={`${itemClassName} flex-1 min-w-0`}
                              >
                                {itemContent}
                              </Link>
                            )}
                            {sidebarOpen && !bloqueado && (
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.path)}
                                className={`shrink-0 p-2 rounded-lg transition-colors ${
                                  isFavorite
                                    ? 'text-amber-300 hover:bg-slate-900'
                                    : 'text-slate-600 opacity-0 hover:bg-slate-900 hover:text-amber-300 focus:opacity-100 group-hover/item:opacity-100'
                                }`}
                                aria-label={isFavorite ? `Quitar ${item.label} de favoritos` : `Agregar ${item.label} a favoritos`}
                                title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                              >
                                <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {/* Aviso fiscal — solo cuando onboarding incompleto y no es SUPER_ADMIN */}
        {user?.rol !== 'SUPER_ADMIN' && user?.rol !== 'FIRMADOR' && !user?.onboarding_completado && (
          <div className="px-3 pb-2">
            <Link
              to="/onboarding"
              className={`flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300 transition-colors hover:bg-amber-500/15 ${!sidebarOpen && 'justify-center'}`}
              title="Completar configuración fiscal"
            >
              <AlertTriangle size={16} className="flex-shrink-0" />
              {sidebarOpen && (
                <span className="text-xs font-medium leading-tight">
                  Configuración fiscal pendiente
                </span>
              )}
            </Link>
          </div>
        )}

        {/* User Section */}
        <div className="border-t border-slate-800 p-3">
          <div className={`mb-2 flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 ${!sidebarOpen && 'justify-center'}`}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">
              {userInitial}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white" title={displayName}>{displayName}</p>
                <p className="truncate text-xs text-slate-400">{user?.rol || 'Usuario'}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-600 hover:text-white ${!sidebarOpen && 'justify-center'}`}
          >
            <LogOut size={18} />
            {sidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          {/* Botón hamburguesa para móvil */}
          <button
            className="mr-2 flex-shrink-0 rounded-lg p-2 hover:bg-slate-100 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} className="text-gray-600" />
          </button>
          <div className="max-w-xl flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                name="erp-global-search"
                autoComplete="off"
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                aria-label={searchPlaceholder}
              />
            </div>
          </div>
          <div className="ml-4 flex items-center gap-2">
            {/* Campanita de notificaciones */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative rounded-lg p-2.5 transition-colors hover:bg-slate-100"
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
                <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
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
          <footer className="border-t border-gray-200 bg-white px-6 py-4 text-xs text-gray-500">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span>© {new Date().getFullYear()} OF1 Solutions S.A.S.</span>
              <div className="flex flex-wrap gap-4">
                <Link to="/politica-privacidad" className="font-semibold hover:text-blue-700">Política de Privacidad</Link>
                <Link to="/terminos-y-condiciones" className="font-semibold hover:text-blue-700">Términos y Condiciones</Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
