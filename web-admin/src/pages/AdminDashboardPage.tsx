import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, Building2, CircleDollarSign, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardService, type DashboardData, type DashboardSuperAdmin, type DashboardTenant } from '../services/dashboardService';

const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon size={18} /></span></div>
      <p className="mt-5 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function GlobalDashboard({ data }: { data: DashboardSuperAdmin }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-sm font-semibold text-blue-700">Centro de control</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">La operación completa, en una sola vista.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Administra empresas, accesos, servicios y salud financiera de OF1 Solutions sin mezclarlo con la operación diaria de cada ERP.</p></div>
        <Link to="/empresas" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Gestionar empresas <ArrowUpRight size={16} /></Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Empresas" value={String(data.empresas_total)} hint={`${data.empresas_activas} activas`} icon={Building2} />
        <Metric label="Usuarios" value={String(data.usuarios_total)} hint={`${data.admins_empresa} administradores de empresa`} icon={Users} />
        <Metric label="Suscripciones" value={String(data.suscripciones_activas)} hint="Suscripciones activas" icon={CircleDollarSign} />
        <Metric label="Estado de plataforma" value="Operativa" hint="Servicios principales disponibles" icon={Activity} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-950">Empresas administradas</h3><p className="mt-1 text-sm text-slate-500">Selecciona una empresa para operar su contexto ERP.</p></div><Building2 className="text-blue-700" size={22} /></div><div className="mt-5 divide-y divide-slate-100">{data.empresas.slice(0, 8).map((empresa) => <Link to={`/empresas`} key={empresa.id} className="flex items-center justify-between py-3 hover:bg-slate-50"><div><p className="text-sm font-semibold text-slate-800">{empresa.razon_social}</p><p className="text-xs text-slate-400">{empresa.ruc} · {empresa.email || 'Sin correo registrado'}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${empresa.activa ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{empresa.activa ? 'Activa' : 'Inactiva'}</span></Link>)}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><ShieldCheck className="text-blue-300" size={24} /><h3 className="mt-6 text-xl font-bold">Gobierno de plataforma</h3><p className="mt-2 text-sm leading-6 text-slate-300">Controla permisos, servicios y trazabilidad desde una consola diseñada para administración corporativa.</p><div className="mt-6 space-y-3 text-sm"><Link to="/matriz-permisos" className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15"><span>Matriz de accesos</span><ArrowUpRight size={16} /></Link><Link to="/catalogo-modulos" className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15"><span>Catálogo de módulos</span><ArrowUpRight size={16} /></Link></div></section>
      </div>
    </div>
  );
}

function TenantDashboard({ data }: { data: DashboardTenant }) {
  return <div className="space-y-8"><div><p className="text-sm font-semibold text-blue-700">Empresa activa</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Resumen operativo y financiero</h2><p className="mt-2 text-sm text-slate-500">La consola mantiene el gobierno arriba y la operación de la empresa en un contexto separado.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="Ventas del período" value={money(data.ventas_periodo)} hint={`${data.ventas_periodo_cantidad} ventas cerradas`} icon={CircleDollarSign} /><Metric label="Facturado neto" value={money(data.facturado_neto_periodo)} hint={`${data.facturado_periodo_cantidad} documentos del rango`} icon={Activity} /><Metric label="Por cobrar" value={money(data.total_por_cobrar)} hint={`${data.cuentas_vencidas} cuentas vencidas`} icon={Users} /><Metric label="Productos activos" value={String(data.productos_activos)} hint={`${data.stock_bajo_count} con stock bajo`} icon={Building2} /></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-sm text-blue-950">Para volver a la vista corporativa, selecciona <strong>Vista global de OF1 Solutions</strong> en el selector superior.</div></div>;
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ['admin-console-dashboard'], queryFn: () => dashboardService.get(), staleTime: 60_000 });
  if (isLoading || !data) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-700" /></div>;
  return data.tipo === 'super_admin' ? <GlobalDashboard data={data} /> : <TenantDashboard data={data} />;
}
