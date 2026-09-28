import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CircleDollarSign,
  FileSignature,
  Gauge,
  Layers3,
  LogOut,
  Menu,
  Network,
  PanelLeft,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
  X,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuthStore, isPlatformIdentity } from '../store/authStore';
import { empresasService } from '../services/empresasService';
import { empresaContextService } from '../services/empresaContextService';
import { PRODUCT_LINKS } from '../config/productLinks';

type AdminNavItem = { label: string; path: string; icon: React.ElementType };
type AdminNavGroup = { label: string; items: AdminNavItem[] };

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Visión general',
    items: [{ label: 'Centro de control', path: '/', icon: Gauge }],
  },
  {
    label: 'Organización',
    items: [
      { label: 'Empresas', path: '/empresas', icon: Building2 },
      { label: 'Usuarios y accesos', path: '/usuarios', icon: Users },
      { label: 'Matriz de permisos', path: '/matriz-permisos', icon: ShieldCheck },
      { label: 'Catálogo de módulos', path: '/catalogo-modulos', icon: Layers3 },
    ],
  },
  {
    label: 'Finanzas corporativas',
    items: [
      { label: 'Facturación', path: '/facturacion', icon: CircleDollarSign },
      { label: 'Ventas', path: '/ventas', icon: BarChart3 },
      { label: 'Cartera', path: '/cartera', icon: WalletCards },
      { label: 'Bancos', path: '/bancos', icon: WalletCards },
      { label: 'Contabilidad', path: '/contabilidad', icon: Network },
      { label: 'Nómina', path: '/nomina', icon: Users },
    ],
  },
  {
    label: 'Operación de empresas',
    items: [
      { label: 'Inventario', path: '/inventarios', icon: Store },
      { label: 'Configuración fiscal', path: '/configuracion', icon: Settings2 },
      { label: 'Reportes', path: '/reportes', icon: BarChart3 },
    ],
  },
  {
    label: 'Servicios OF1',
    items: [
      { label: 'Firmas electrónicas', path: '/firmas-electronicas', icon: FileSignature },
      { label: 'Precios de firmas', path: '/firmas-electronicas/precios', icon: CircleDollarSign },
      { label: 'Promociones', path: '/firmas-electronicas/promociones', icon: Sparkles },
      { label: 'Cupones', path: '/firmas-electronicas/cupones', icon: Ticket },
      { label: 'Administrar Firmador', path: '/firmador-admin', icon: FileSignature },
      { label: 'Automation', path: '/automation/leads', icon: Activity },
      { label: 'Suscripciones', path: '/suscripciones-admin', icon: CircleDollarSign },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, activeEmpresaId, setActiveEmpresa } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: empresas = [] } = useQuery({
    queryKey: ['admin-console-empresas'],
    queryFn: empresasService.getAll,
    enabled: isPlatformIdentity(user),
    staleTime: 5 * 60 * 1000,
  });
  const activeEmpresa = useMemo(
    () => empresas.find((empresa) => empresa.id === activeEmpresaId),
    [activeEmpresaId, empresas],
  );

  const selectEmpresa = async (empresaId: number) => {
    if (empresaId === activeEmpresaId) return;
    await empresaContextService.seleccionar(empresaId);
    setActiveEmpresa(empresaId);
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const displayName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email || 'Administrador';

  return (
    <div className="flex min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all md:relative ${sidebarOpen ? 'w-72' : 'w-20'}`}>
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-4">
          {sidebarOpen ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700">OF1 Solutions</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Console empresarial</p>
            </div>
          ) : <PanelLeft className="mx-auto text-blue-700" size={22} />}
          <button type="button" onClick={() => setSidebarOpen((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-6">
              {sidebarOpen && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>}
              {group.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={!sidebarOpen ? item.label : undefined}
                    className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-blue-700 text-white shadow-sm shadow-blue-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'} ${!sidebarOpen ? 'justify-center' : ''}`}
                  >
                    <Icon size={18} />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button type="button" onClick={handleLogout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <LogOut size={18} />
            {sidebarOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 backdrop-blur md:px-8">
          <div>
            <p className="text-xs font-medium text-slate-400">Administración corporativa</p>
            <h1 className="text-lg font-bold text-slate-950">OF1 Solutions Console</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:flex">
              <Building2 size={16} className="text-blue-700" />
              <span className="sr-only">Empresa activa</span>
              <select value={activeEmpresaId ?? ''} onChange={(event) => selectEmpresa(Number(event.target.value))} className="max-w-[220px] bg-transparent font-semibold text-slate-700 outline-none" aria-label="Empresa activa">
                <option value="">Vista global de OF1 Solutions</option>
                {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.razon_social}</option>)}
              </select>
            </label>
            <button type="button" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Notificaciones"><Bell size={18} /></button>
            <div className="hidden border-l border-slate-200 pl-3 text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{displayName}</p>
              <p className="text-xs text-slate-400">Administrador global</p>
            </div>
          </div>
        </header>

        {activeEmpresa && (
          <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-5 py-2.5 text-xs text-blue-900 md:px-8">
            <span><strong>Contexto activo:</strong> {activeEmpresa.razon_social} · RUC {activeEmpresa.ruc}</span>
            <Link to="/configuracion" className="hidden items-center gap-1 font-semibold hover:underline sm:flex">Abrir configuración <ArrowRight size={14} /></Link>
          </div>
        )}

        <main className="flex-1 overflow-auto px-5 py-6 md:px-8 md:py-8"><Outlet /></main>
        <footer className="border-t border-slate-200 bg-white px-5 py-4 text-xs text-slate-400 md:px-8">
          <div className="flex flex-col justify-between gap-2 md:flex-row"><span>OF1 Solutions S.A.S. · Consola empresarial</span><a href={PRODUCT_LINKS.facturaof1} className="font-semibold text-blue-700 hover:underline">Abrir FacturaOF1 ERP</a></div>
        </footer>
      </div>
    </div>
  );
}
