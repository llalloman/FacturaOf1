import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Landmark,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuthStore, type User } from '../store/authStore';
import { dashboardService } from '../services/dashboardService';
import type { DashboardSuperAdmin, DashboardTenant } from '../services/dashboardService';

type Tone = 'emerald' | 'blue' | 'amber' | 'rose' | 'slate' | 'indigo';
type DashboardView = 'comerciante' | 'contador' | 'operativo' | 'gerencia';

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#059669'];

const metodoPagoLabel: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'T. Crédito',
  TARJETA_DEBITO: 'T. Débito',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  CREDITO: 'Crédito',
};

const viewConfig: Record<
  DashboardView,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  comerciante: {
    label: 'Comerciante',
    shortLabel: 'Comercio',
    description: 'Ventas, cobros, stock y pendientes de operación.',
    icon: Store,
  },
  contador: {
    label: 'Contador',
    shortLabel: 'Contador',
    description: 'SRI, declaraciones, notas de crédito y cumplimiento.',
    icon: Calculator,
  },
  operativo: {
    label: 'Operativo',
    shortLabel: 'Operación',
    description: 'Caja, pedidos abiertos y acciones del día.',
    icon: ClipboardCheck,
  },
  gerencia: {
    label: 'Gerencia',
    shortLabel: 'Gerencia',
    description: 'Tendencia, clientes, productos y salud del negocio.',
    icon: BarChart3,
  },
};

const money = (value: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

const viewStorageKey = (user?: User | null) => `facturaof1-dashboard-view-${user?.id ?? 'anon'}`;

function getDefaultView(user?: User | null): DashboardView {
  switch (user?.rol) {
    case 'CONTADOR':
    case 'CONSULTOR':
      return 'contador';
    case 'VENDEDOR':
      return 'operativo';
    case 'ADMIN_EMPRESA':
      return 'comerciante';
    default:
      return 'comerciante';
  }
}

function getAvailableViews(user?: User | null): DashboardView[] {
  switch (user?.rol) {
    case 'CONTADOR':
      return ['contador'];
    case 'CONSULTOR':
      return ['gerencia'];
    case 'VENDEDOR':
      return ['operativo'];
    case 'ADMIN_EMPRESA':
      return ['comerciante', 'gerencia'];
    default:
      return ['comerciante'];
  }
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'slate',
}: {
  label: string;
  value: string;
  helper?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  } as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
        </div>
        <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ActionLink({
  to,
  label,
  helper,
  icon: Icon,
}: {
  to: string;
  label: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{label}</span>
          <span className="block truncate text-xs text-slate-500">{helper}</span>
        </span>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
    </Link>
  );
}

function DashboardViewSelector({
  activeView,
  onChange,
  availableViews,
}: {
  activeView: DashboardView;
  onChange: (view: DashboardView) => void;
  availableViews: DashboardView[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {availableViews.map((view) => {
        const item = viewConfig[view];
        const Icon = item.icon;
        const active = activeView === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => onChange(view)}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
              active
                ? 'border-blue-300 bg-blue-50 text-blue-950 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className={`rounded-lg p-2 ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="flex h-48 items-center justify-center text-sm text-slate-400">{children}</div>;
}

function DashboardSuperAdminView({ data }: { data: DashboardSuperAdmin }) {
  const stats = [
    { label: 'Empresas', value: String(data.empresas_total), icon: Building2, tone: 'blue' as const },
    { label: 'Empresas activas', value: String(data.empresas_activas), icon: ShieldCheck, tone: 'emerald' as const },
    { label: 'Usuarios', value: String(data.usuarios_total), icon: Users, tone: 'slate' as const },
    { label: 'Suscripciones activas', value: String(data.suscripciones_activas), icon: ReceiptText, tone: 'amber' as const },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">Control del sistema</h1>
        <p className="mt-2 text-sm text-slate-500">Vista global de empresas, usuarios y actividad administrativa.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} icon={item.icon} tone={item.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Empresas recientes" subtitle="Últimas empresas registradas en la plataforma." />
          <div className="space-y-3">
            {data.empresas.map((empresa) => (
              <div key={empresa.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{empresa.razon_social}</p>
                  <p className="text-xs text-slate-500">{empresa.ruc} · {empresa.email || 'Sin email'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${empresa.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {empresa.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Lectura rápida" subtitle="Qué mirar primero al abrir el panel." />
          <div className="space-y-4 text-sm text-slate-600">
            <div className="rounded-xl bg-blue-50 px-4 py-3">
              <p className="font-medium text-blue-900">Empresas activas</p>
              <p className="mt-1">Controla cuántas empresas están operando realmente frente al total registrado.</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="font-medium text-amber-900">Suscripciones activas</p>
              <p className="mt-1">Úsalo como termómetro comercial y de continuidad del servicio.</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="font-medium text-slate-900">Usuarios administradores</p>
              <p className="mt-1">Ayuda a detectar cuentas listas para operar sin entrar todavía al detalle de cada empresa.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardTenantView({
  data,
  activeView,
  setActiveView,
  availableViews,
}: {
  data: DashboardTenant;
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  availableViews: DashboardView[];
}) {
  const { user } = useAuthStore();

  const estadoFacturas = Object.entries(data.facturas_por_estado)
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0);

  const ventasMetodo = data.ventas_por_metodo.map((item) => ({
    name: metodoPagoLabel[item.forma_pago] || item.forma_pago,
    value: item.total,
  }));

  const tendenciaVentas = data.ultimos_meses.map((item) => ({
    label: item.label,
    ventas: item.total_ventas,
    tickets: item.cantidad_ventas,
  }));

  const facturadoSriHelper =
    data.facturado_anulado_cantidad > 0
      ? `${data.facturado_periodo_cantidad} facturas del rango; incluye ${data.facturado_anulado_cantidad} anulada(s) con NC por ${money(data.facturado_anulado_periodo)}`
      : `${data.facturado_periodo_cantidad} facturas emitidas/autorizadas del rango`;

  const kpiCatalog = {
    ventasHoy: {
      label: 'Ventas de hoy',
      value: money(data.ventas_hoy),
      helper: `${data.ventas_hoy_cantidad} venta(s) registradas hoy`,
      icon: Banknote,
      tone: 'emerald' as const,
    },
    ventasPeriodo: {
      label: 'Ventas cerradas',
      value: money(data.ventas_periodo),
      helper: `${data.ventas_periodo_cantidad} ventas operativas en el rango`,
      icon: Banknote,
      tone: 'emerald' as const,
    },
    cobradoHoy: {
      label: 'Cobrado hoy',
      value: money(data.cobrado_hoy),
      helper: 'Pagos registrados durante el día',
      icon: Wallet,
      tone: 'blue' as const,
    },
    cobradoPeriodo: {
      label: 'Cobrado del período',
      value: money(data.cobrado_periodo),
      helper: 'Cobros asociados a ventas cerradas',
      icon: Wallet,
      tone: 'blue' as const,
    },
    ticketPromedio: {
      label: 'Ticket promedio',
      value: money(data.ticket_promedio_periodo),
      helper: 'Promedio de ventas cerradas del rango',
      icon: BadgeDollarSign,
      tone: 'amber' as const,
    },
    facturadoSri: {
      label: 'Facturado SRI',
      value: money(data.facturado_periodo),
      helper: facturadoSriHelper,
      icon: ReceiptText,
      tone: 'blue' as const,
    },
    facturadoNeto: {
      label: 'Neto facturado',
      value: money(data.facturado_neto_periodo),
      helper: `Bruto SRI menos ${money(data.notas_credito_periodo)} en notas de crédito`,
      icon: ShieldCheck,
      tone: 'slate' as const,
    },
    facturacionDirecta: {
      label: 'Facturación directa',
      value: money(data.facturado_directo_periodo),
      helper: `${data.facturado_directo_cantidad} factura(s) de servicios o emisión directa`,
      icon: BadgeDollarSign,
      tone: 'amber' as const,
    },
    pendientesSri: {
      label: 'Pendientes SRI',
      value: String(data.facturas_enviadas),
      helper: `${data.facturas_rechazadas} con error o no autorizadas`,
      icon: ReceiptText,
      tone: data.facturas_enviadas || data.facturas_rechazadas ? ('rose' as const) : ('emerald' as const),
    },
    notasCredito: {
      label: 'Notas de crédito',
      value: String(data.notas_credito_periodo_cantidad),
      helper: `${money(data.notas_credito_periodo)} autorizadas en el rango`,
      icon: ReceiptText,
      tone: 'indigo' as const,
    },
    cartera: {
      label: 'Por cobrar',
      value: money(data.total_por_cobrar),
      helper: `${data.cuentas_vencidas} cuenta(s) vencida(s) por ${money(data.total_vencido)}`,
      icon: CreditCard,
      tone: data.cuentas_vencidas > 0 ? ('rose' as const) : ('slate' as const),
    },
    stockBajo: {
      label: 'Stock bajo',
      value: String(data.stock_bajo_count),
      helper: `${data.productos_activos} producto(s) activos`,
      icon: Package,
      tone: data.stock_bajo_count > 0 ? ('amber' as const) : ('emerald' as const),
    },
    operacionActiva: {
      label: 'Operación activa',
      value: `${data.cajas_abiertas} caja(s)`,
      helper: `${data.pedidos_abiertos} pedido(s) abiertos`,
      icon: ShoppingBag,
      tone: 'blue' as const,
    },
    anuladas: {
      label: 'Ventas anuladas',
      value: String(data.ventas_anuladas_periodo_cantidad),
      helper: `${money(data.ventas_anuladas_periodo)} anulados/cancelados en el rango`,
      icon: AlertTriangle,
      tone: 'rose' as const,
    },
  };

  const viewKpis: Record<DashboardView, Array<keyof typeof kpiCatalog>> = {
    comerciante: ['ventasHoy', 'cobradoHoy', 'ventasPeriodo', 'cartera', 'stockBajo', 'operacionActiva'],
    contador: ['facturadoSri', 'facturadoNeto', 'pendientesSri', 'notasCredito', 'facturacionDirecta', 'anuladas'],
    operativo: ['ventasHoy', 'cobradoHoy', 'operacionActiva', 'stockBajo', 'pendientesSri', 'cartera'],
    gerencia: ['ventasPeriodo', 'facturadoNeto', 'cobradoPeriodo', 'ticketPromedio', 'cartera', 'stockBajo'],
  };

  const selectedKpis = viewKpis[activeView].map((key) => kpiCatalog[key]);
  const currentView = viewConfig[activeView];
  const primaryAlertCount = data.alertas_operativas.reduce((total, alerta) => total + Number(alerta.valor > 0), 0);
  const healthTone =
    primaryAlertCount === 0
      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
      : primaryAlertCount <= 2
        ? 'bg-amber-50 text-amber-800 border-amber-100'
        : 'bg-rose-50 text-rose-800 border-rose-100';

  return (
    <div className="space-y-7">
      {!user?.onboarding_completado && (
        <Link
          to="/onboarding"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-900">Configura tu empresa para emitir documentos electrónicos</p>
            <p className="mt-0.5 text-sm text-amber-700">
              Ingresa tus datos fiscales, firma electrónica y ambiente SRI. Sin esto, no podrás generar facturas ni retenciones autorizadas.
            </p>
          </div>
        </Link>
      )}

      {data.configuracion_incompleta && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-blue-950">Completa tu configuración y empieza a facturar electrónicamente.</h2>
              <p className="mt-1 text-sm text-blue-700">
                Revisa datos fiscales, firma electrónica, secuenciales y certificado para dejar la empresa lista.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {(data.progreso_configuracion ?? []).map((step) => (
                  <div key={step.key} className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm">
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className={step.completed ? 'text-slate-700' : 'font-medium text-slate-900'}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/configuracion" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Configurar empresa
              </Link>
              <a href="https://api.whatsapp.com/send/?phone=593991840854&text=Hola%2C+necesito+soporte+con+FacturaOF1&type=phone_number&app_absent=0" target="_blank" rel="noreferrer" className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                Agendar soporte
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Vista {currentView.shortLabel}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">Panel de control</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              El dashboard se adapta al rol y al enfoque de trabajo: operación diaria, control contable, ventas o gerencia.
            </p>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-sm ${healthTone}`}>
            <p className="font-semibold">{primaryAlertCount === 0 ? 'Todo en orden' : `${primaryAlertCount} alerta(s) por revisar`}</p>
            <p className="mt-1 text-xs opacity-80">Rango: {data.fecha_desde} a {data.fecha_hasta}</p>
          </div>
        </div>

        {availableViews.length > 1 ? (
          <div className="mt-5">
            <DashboardViewSelector activeView={activeView} onChange={setActiveView} availableViews={availableViews} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {selectedKpis.map((item) => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Acciones rápidas" subtitle="Atajos según lo que normalmente se resuelve desde este panel." />
          <div className="grid gap-3 sm:grid-cols-2">
            {activeView === 'contador' ? (
              <>
                <ActionLink to="/facturacion" label="Revisar SRI" helper="Autorizados, enviados y rechazados" icon={ReceiptText} />
                <ActionLink to="/notas-credito" label="Notas de crédito" helper="Pendientes y autorizadas" icon={ShieldCheck} />
                <ActionLink to="/declaraciones" label="Declaraciones" helper="Obligaciones y períodos" icon={Landmark} />
                <ActionLink to="/configuracion" label="Configuración fiscal" helper="Firma, secuenciales y ambiente SRI" icon={Settings} />
              </>
            ) : activeView === 'operativo' ? (
              <>
                <ActionLink to="/pos" label="Ir al POS" helper="Registrar venta rápida" icon={ShoppingBag} />
                <ActionLink to="/pedidos" label="Pedidos" helper="Mesas y pedidos abiertos" icon={ClipboardCheck} />
                <ActionLink to="/ventas" label="Ventas" helper="Revisar y regularizar ventas" icon={Banknote} />
                <ActionLink to="/inventarios" label="Inventario" helper="Stock bajo y movimientos" icon={Package} />
              </>
            ) : (
              <>
                <ActionLink to="/ventas" label="Ventas" helper="Ventas, notas y coherencia" icon={Banknote} />
                <ActionLink to="/cartera" label="Cartera" helper="Cuentas vencidas y cobros" icon={CreditCard} />
                <ActionLink to="/inventarios" label="Inventario" helper="Stock y reposición" icon={Package} />
                <ActionLink to="/reportes" label="Reportes" helper="Análisis ampliado" icon={TrendingUp} />
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Alertas y pendientes" subtitle="Lo que requiere atención antes de seguir operando." />
          <div className="space-y-3">
            {data.alertas_operativas.map((alerta) => (
              <Link
                key={alerta.key}
                to={alerta.ruta}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2 ${alerta.valor > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {alerta.valor > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{alerta.label}</p>
                    <p className="text-xs text-slate-500">{alerta.valor > 0 ? 'Requiere revisión' : 'Sin novedad'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alerta.valor > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {alerta.valor}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {(activeView === 'comerciante' || activeView === 'operativo') && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <SectionTitle title="Tendencia comercial" subtitle="Evolución mensual de ventas operativas y número de tickets." />
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tendenciaVentas}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="ventas" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="tickets" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle title="Métodos de pago" subtitle="Composición del rango seleccionado." />
            {ventasMetodo.length === 0 ? (
              <EmptyState>Sin pagos registrados</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ventasMetodo} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {(activeView === 'contador' || activeView === 'gerencia') && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle title="Estado SRI" subtitle="Distribución de comprobantes por estado." />
            {estadoFacturas.length === 0 ? (
              <EmptyState>Sin comprobantes registrados</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={estadoFacturas} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {estadoFacturas.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-4 space-y-2">
              {estadoFacturas.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <SectionTitle title="Ventas vs SRI" subtitle="Compara lo vendido en operación contra lo emitido tributariamente." />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase text-emerald-700">Vendido</p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">{money(data.ventas_periodo)}</p>
                <p className="mt-1 text-xs text-emerald-700">{data.ventas_periodo_cantidad} venta(s)</p>
              </div>
              <div className="rounded-xl bg-blue-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase text-blue-700">Facturado SRI</p>
                <p className="mt-2 text-2xl font-bold text-blue-950">{money(data.facturado_periodo)}</p>
                <p className="mt-1 text-xs text-blue-700">{data.facturado_periodo_cantidad} comprobante(s)</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase text-slate-600">Neto tributario</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{money(data.facturado_neto_periodo)}</p>
                <p className="mt-1 text-xs text-slate-500">Luego de notas de crédito</p>
              </div>
            </div>

            <div className="mt-5">
              <SectionTitle title="Próximas obligaciones" subtitle="Recordatorio rápido para evitar vencimientos." />
              {data.proximas_declaraciones.length === 0 ? (
                <EmptyState>Sin obligaciones próximas registradas</EmptyState>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.proximas_declaraciones.map((item) => (
                    <div key={`${item.tipo}-${item.periodo}`} className="rounded-xl bg-blue-50 px-4 py-3">
                      <p className="font-medium text-blue-950">{item.tipo}</p>
                      <p className="text-sm text-blue-800">{item.periodo}</p>
                      <p className="mt-1 text-xs text-blue-700">
                        Fecha límite: {item.fecha_limite} · faltan {item.dias_restantes} días
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(activeView === 'comerciante' || activeView === 'operativo' || activeView === 'gerencia') && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {(activeView === 'comerciante' || activeView === 'operativo') && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle title="Stock bajo" subtitle="Productos que ya requieren reposición." />
              {data.stock_bajo.length === 0 ? (
                <EmptyState>Sin alertas de stock</EmptyState>
              ) : (
                <div className="space-y-3">
                  {data.stock_bajo.map((producto) => (
                    <div key={producto.id} className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">{producto.nombre}</p>
                          <p className="text-xs text-slate-500">Mínimo esperado: {Number(producto.stock_minimo).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-amber-800">{Number(producto.stock_actual).toFixed(2)}</p>
                          <p className="text-xs text-amber-700">stock actual</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Link to="/inventarios" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
                    Ver inventario <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {(activeView === 'comerciante' || activeView === 'gerencia') && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle title="Top productos" subtitle="Ordenados por ingreso generado en el rango." />
              <div className="space-y-3">
                {data.top_productos.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Sin ventas registradas en el período</div>
                ) : (
                  data.top_productos.map((producto, index) => (
                    <div key={producto.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{producto.nombre}</p>
                          <p className="text-xs text-slate-500">{producto.cantidad_vendida.toFixed(2)} unidades vendidas</p>
                        </div>
                      </div>
                      <span className="font-semibold text-emerald-700">{money(producto.ingreso)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {(activeView === 'comerciante' || activeView === 'gerencia') && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle title="Top clientes" subtitle="Clientes con mayor volumen de compra en el rango." />
              <div className="space-y-3">
                {data.top_clientes.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Sin ventas por cliente en el período</div>
                ) : (
                  data.top_clientes.map((cliente) => (
                    <div key={cliente.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{cliente.nombre}</p>
                        <p className="text-xs text-slate-500">{cliente.cantidad} documento(s)</p>
                      </div>
                      <span className="font-semibold text-slate-900">{money(cliente.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(activeView === 'contador' || activeView === 'gerencia') && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Actividad reciente SRI" subtitle="Últimas facturas emitidas y su estado actual." />
          {data.facturas_recientes.length === 0 ? (
            <EmptyState>Sin facturas recientes</EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {data.facturas_recientes.map((factura) => (
                <div key={factura.id} className="rounded-xl border border-slate-100 px-4 py-3">
                  <p className="font-medium text-slate-900">{factura.numero_factura}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{factura.cliente_nombre}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{money(factura.total)}</p>
                    <p className="text-xs text-slate-500">{factura.estado}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(today, 'yyyy-MM-dd'));
  const availableViews = useMemo(() => getAvailableViews(user), [user]);
  const [activeView, setActiveViewState] = useState<DashboardView>(() => {
    const defaultView = getDefaultView(user);
    const stored = localStorage.getItem(viewStorageKey(user)) as DashboardView | null;
    return stored && getAvailableViews(user).includes(stored) ? stored : defaultView;
  });

  useEffect(() => {
    const stored = localStorage.getItem(viewStorageKey(user)) as DashboardView | null;
    const nextView = stored && availableViews.includes(stored) ? stored : getDefaultView(user);
    setActiveViewState(nextView);
  }, [availableViews, user]);

  const setActiveView = (view: DashboardView) => {
    setActiveViewState(view);
    localStorage.setItem(viewStorageKey(user), view);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', dateFrom, dateTo],
    queryFn: () => dashboardService.get({ fecha_desde: dateFrom, fecha_hasta: dateTo }),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      {user?.rol !== 'SUPER_ADMIN' ? (
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Dashboard adaptado al rol</p>
            <p className="text-xs text-slate-400">Puedes cambiar la vista sin modificar permisos de usuario.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm text-slate-700 outline-none"
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm text-slate-700 outline-none"
            />
          </div>
        </div>
      ) : null}

      {data.tipo === 'super_admin' ? (
        <DashboardSuperAdminView data={data as DashboardSuperAdmin} />
      ) : (
        <DashboardTenantView
          data={data as DashboardTenant}
          activeView={activeView}
          setActiveView={setActiveView}
          availableViews={availableViews}
        />
      )}
    </div>
  );
}
