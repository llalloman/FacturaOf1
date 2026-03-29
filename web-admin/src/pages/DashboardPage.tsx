import { useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
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

import { useAuthStore } from '../store/authStore';
import { dashboardService } from '../services/dashboardService';
import type { DashboardSuperAdmin, DashboardTenant } from '../services/dashboardService';

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#059669'];
const metodoPagoLabel: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'T. Crédito',
  TARJETA_DEBITO: 'T. Débito',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  CREDITO: 'Crédito',
};

const money = (value: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
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
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
}) {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
        </div>
        <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Empresas recientes"
            subtitle="Últimas empresas registradas en la plataforma."
          />
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Lectura rápida"
            subtitle="Qué mirar primero al abrir el panel."
          />
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

function DashboardTenantView({ data }: { data: DashboardTenant }) {
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

  const kpis = [
    {
      label: 'Ventas cerradas',
      value: money(data.ventas_periodo),
      helper: `${data.ventas_periodo_cantidad} ventas del rango seleccionado`,
      icon: Banknote,
      tone: 'emerald' as const,
    },
    {
      label: 'Cobrado del período',
      value: money(data.cobrado_periodo),
      helper: 'Cobros asociados solo a ventas cerradas',
      icon: Wallet,
      tone: 'blue' as const,
    },
    {
      label: 'Ticket promedio',
      value: money(data.ticket_promedio_periodo),
      helper: 'Promedio de ventas cerradas del rango',
      icon: BadgeDollarSign,
      tone: 'amber' as const,
    },
    {
      label: 'Facturas autorizadas',
      value: String(data.facturas_autorizadas),
      helper: `${data.facturas_enviadas} pendientes SRI`,
      icon: ReceiptText,
      tone: 'slate' as const,
    },
    {
      label: 'Ventas anuladas',
      value: String(data.ventas_anuladas_periodo_cantidad),
      helper: `${money(data.ventas_anuladas_periodo)} anulados/cancelados en el rango`,
      icon: AlertTriangle,
      tone: 'rose' as const,
    },
    {
      label: 'Facturas anuladas',
      value: String(data.facturas_anuladas),
      helper: 'Comprobantes SRI anulados',
      icon: ReceiptText,
      tone: 'rose' as const,
    },
    {
      label: 'Por cobrar',
      value: money(data.total_por_cobrar),
      helper: `${data.cuentas_vencidas} cuentas vencidas por ${money(data.total_vencido)}`,
      icon: CreditCard,
      tone: 'rose' as const,
    },
    {
      label: 'Facturas pendientes SRI',
      value: String(data.facturas_enviadas),
      helper: `${data.facturas_rechazadas} con error o no autorizadas`,
      icon: ReceiptText,
      tone: 'slate' as const,
    },
    {
      label: 'Operación activa',
      value: `${data.cajas_abiertas} caja(s)`,
      helper: `${data.pedidos_abiertos} pedido(s) abiertos`,
      icon: ShoppingBag,
      tone: 'blue' as const,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Aviso de configuración fiscal pendiente */}
      {!user?.onboarding_completado && (
        <Link
          to="/onboarding"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-900">Configura tu empresa para emitir documentos electrónicos</p>
            <p className="mt-0.5 text-sm text-amber-700">
              Ingresa tus datos fiscales, firma electrónica y ambiente SRI. Sin esto, no podrás generar
              facturas ni retenciones autorizadas. Haz clic para completar la configuración.
            </p>
          </div>
        </Link>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Panel operativo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ventas cerradas, facturación SRI, cartera, stock y actividad comercial del rango elegido.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="font-medium text-slate-900">{data.clientes_activos}</span> clientes activos ·{' '}
            <span className="font-medium text-slate-900">{data.productos_activos}</span> productos activos
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            Rango: <span className="font-medium text-slate-900">{data.fecha_desde}</span> a{' '}
            <span className="font-medium text-slate-900">{data.fecha_hasta}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => (
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Alertas y pendientes"
            subtitle="Todo lo que requiere seguimiento operativo inmediato."
          />
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
                    <p className="text-xs text-slate-500">
                      {alerta.valor > 0 ? 'Requiere revisión' : 'Sin novedad'}
                    </p>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Tendencia comercial"
            subtitle="Evolución mensual de ventas y número de tickets."
          />
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Estado SRI" subtitle="Distribución de comprobantes por estado." />
          {estadoFacturas.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">Sin comprobantes registrados</div>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Métodos de pago" subtitle="Composición del rango seleccionado." />
          {ventasMetodo.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">Sin pagos registrados</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ventasMetodo} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 text-xs text-slate-500">
                Útil para detectar concentración de caja, crédito o transferencias.
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Stock bajo" subtitle="Productos que ya requieren reposición." />
          {data.stock_bajo.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">Sin alertas de stock</div>
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Top productos" subtitle="Ordenados por ingreso generado en el rango." />
          <div className="space-y-3">
            {data.top_productos.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Sin ventas registradas este mes</div>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Actividad reciente SRI" subtitle="Últimas facturas emitidas y su estado actual." />
          <div className="space-y-3">
            {data.facturas_recientes.map((factura) => (
              <div key={factura.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{factura.numero_factura}</p>
                  <p className="text-xs text-slate-500">{factura.cliente_nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{money(factura.total)}</p>
                  <p className="text-xs text-slate-500">{factura.estado}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Próximas obligaciones" subtitle="Recordatorio rápido para evitar vencimientos." />
          {data.proximas_declaraciones.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Sin obligaciones próximas registradas</div>
          ) : (
            <div className="space-y-3">
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
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(today, 'yyyy-MM-dd'));

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
        <div className="mb-6 flex justify-end">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm text-slate-700 outline-none"
            />
            <span className="text-slate-300">—</span>
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
        <DashboardTenantView data={data as DashboardTenant} />
      )}
      {user?.rol !== 'SUPER_ADMIN' ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
          Recomendación: usa este panel para detectar pendientes y ve a <Link to="/reportes" className="font-medium text-blue-700 hover:text-blue-900">Reportes</Link> cuando necesites análisis más profundo.
        </div>
      ) : null}
    </div>
  );
}
