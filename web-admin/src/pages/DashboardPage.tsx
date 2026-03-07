import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  AlertCircle,
  DollarSign,
  FileText,
  Clock,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { facturasService } from '../services/facturasService';
import { productosService } from '../services/productosService';
import { clientesService } from '../services/clientesService';
import { ventasService } from '../services/ventasService';
import { empresasService } from '../services/empresasService';
import { usuariosService } from '../services/usuariosService';
import type { Producto, Cliente } from '../types';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.rol === 'SUPER_ADMIN';

  // ── Datos SUPER_ADMIN: todo el sistema ───────────────────────────────────────
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasService.getAll,
    enabled: isSuperAdmin,
  });

  const { data: todosUsuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
    enabled: isSuperAdmin,
  });

  // ── Datos tenant: empresa propia ─────────────────────────────────────────────
  const { data: facturas = [] } = useQuery({
    queryKey: ['facturas'],
    queryFn: facturasService.getAll,
    enabled: !isSuperAdmin,
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: productosService.getAll,
    enabled: !isSuperAdmin,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: clientesService.getAll,
    enabled: !isSuperAdmin,
  });

  const now = new Date();
  const { data: ventasMes } = useQuery({
    queryKey: ['ventas', 'mensual', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => ventasService.getReporteMensual(now.getMonth() + 1, now.getFullYear()),
    enabled: !isSuperAdmin,
  });

  // ── Dashboard SUPER_ADMIN ────────────────────────────────────────────────────
  if (isSuperAdmin) {
    const empresasArray = Array.isArray(empresas) ? empresas : [];
    const usuariosArray = Array.isArray(todosUsuarios) ? todosUsuarios : [];
    const empresasActivas = empresasArray.filter((e) => e.activa).length;
    const adminsEmpresa = usuariosArray.filter((u) => u.rol === 'ADMIN_EMPRESA').length;

    const statsSA = [
      { label: 'Empresas Registradas', value: String(empresasArray.length), icon: Building2, bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
      { label: 'Empresas Activas', value: String(empresasActivas), icon: ShieldCheck, bgColor: 'bg-green-50', iconColor: 'text-green-600' },
      { label: 'Usuarios Totales', value: String(usuariosArray.length), icon: Users, bgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
      { label: 'Administradores', value: String(adminsEmpresa), icon: ShieldCheck, bgColor: 'bg-orange-50', iconColor: 'text-orange-600' },
    ];

    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Panel de Administración</h1>
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <ShieldCheck size={16} className="text-purple-500" />
            Super Admin — Vista general del sistema. No estás vinculado a ninguna empresa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsSA.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bgColor} p-3 rounded-xl`}>
                  <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.label}</h3>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Lista de empresas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Empresas Suscritas
          </h3>
          {empresasArray.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin empresas registradas. Ve a <strong>Empresas</strong> para agregar la primera.</p>
          ) : (
            <div className="space-y-3">
              {empresasArray.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <div>
                    <p className="font-semibold text-gray-900">{emp.razon_social}</p>
                    <p className="text-xs text-gray-400">{emp.ruc} · {emp.email ?? '—'}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${emp.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {emp.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard Tenant (empresa propia) ────────────────────────────────────────
  const facturasArray = Array.isArray(facturas) ? facturas : [];
  const productosArray = Array.isArray(productos) ? productos : [];
  const clientesArray = Array.isArray(clientes) ? clientes : [];

  const ventasMesTotal: number = (ventasMes as Record<string, unknown>)?.total as number ?? 0;
  const facturasEmitidas = facturasArray.filter(f => f.estado !== 'ANULADO').length;
  const facturasEnviadas = facturasArray.filter(f => f.estado === 'ENVIADO').length;
  const productosActivos = (productosArray as Producto[]).filter((p) => p.activo !== false).length;
  const clientesActivos = (clientesArray as Cliente[]).filter((c) => c.activo !== false).length;
  const productosStockBajo = (productosArray as Producto[]).filter((p) => p.maneja_inventario && p.stock_actual <= p.stock_minimo);

  // ── Ventas por mes (últimos 6 meses aproximado con dato real del mes actual) ─
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const salesData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const esActual = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return {
      mes: meses[d.getMonth()],
      ventas: esActual ? ventasMesTotal : 0,
    };
  });

  // ── Top Productos (por stock vendido = stock_minimo - stock_actual como proxy) ─
  const topProductos = [...(productosArray as Producto[])]
    .filter((p) => p.maneja_inventario)
    .sort((a, b) => (b.precio * (b.stock_minimo || 1)) - (a.precio * (a.stock_minimo || 1)))
    .slice(0, 4)
    .map((p) => ({
      nombre: p.nombre,
      precio: p.precio,
      stock: p.stock_actual,
    }));

  // ── Facturas recientes ────────────────────────────────────────────────────────
  const facturasRecientes = facturasArray.slice(0, 5).map(f => ({
    desc: `Factura ${f.numero_factura ?? '—'} - ${f.cliente_nombre ?? 'Cliente'}`,
    estado: f.estado,
    total: f.total,
  }));

  const stats = [
    {
      label: 'Ventas del Mes',
      value: `$${ventasMesTotal.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      label: 'Facturas Emitidas',
      value: String(facturasEmitidas),
      icon: FileText,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Productos Activos',
      value: String(productosActivos),
      icon: Package,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Clientes Activos',
      value: String(clientesActivos),
      icon: Users,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 flex items-center gap-2">
          <span>Bienvenido,</span>
          <span className="font-semibold text-blue-600">{user?.email}</span>
        </p>
      </div>

      {/* Alerta: facturas pendientes de autorización SRI */}
      {facturasEnviadas > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-yellow-50 border border-yellow-300 rounded-xl px-5 py-4 shadow-sm">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-yellow-800 font-semibold text-sm">
              {facturasEnviadas} factura{facturasEnviadas > 1 ? 's' : ''} pendiente{facturasEnviadas > 1 ? 's' : ''} de autorización SRI
            </p>
            <p className="text-yellow-700 text-xs mt-0.5">
              Están en estado ENVIADO — usa el botón 🔄 en Facturación para consultar al SRI.
            </p>
          </div>
          <Link to="/facturacion" className="text-xs font-semibold text-yellow-700 underline hover:text-yellow-900">
            Ver facturas →
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bgColor} p-3 rounded-xl`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.label}</h3>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Tendencia de Ventas
          </h3>
          <p className="text-xs text-gray-400 mb-4">Total facturado por mes (meses anteriores en $0 cuando no hay historial)</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip formatter={(v: number | string | undefined) => [`$${Number(v ?? 0).toLocaleString()}`, 'Ventas']} />
              <Legend />
              <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} name="Ventas ($)" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Estado de Facturas
          </h3>
          <p className="text-xs text-gray-400 mb-4">Distribución por estado de los comprobantes</p>
          {facturasArray.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">Sin facturas aún</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Borrador', value: facturasArray.filter(f => f.estado === 'BORRADOR').length },
                    { name: 'Autorizado', value: facturasArray.filter(f => f.estado === 'AUTORIZADO').length },
                    { name: 'Anulado', value: facturasArray.filter(f => f.estado === 'ANULADO').length },
                    { name: 'Enviado', value: facturasArray.filter(f => f.estado === 'ENVIADO').length },
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Top Productos (por precio × stock mínimo)
          </h3>
          {topProductos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin productos con inventario registrados</p>
          ) : (
            <div className="space-y-3">
              {topProductos.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">{index + 1}</div>
                    <div>
                      <p className="font-semibold text-gray-900">{product.nombre}</p>
                      <p className="text-sm text-gray-500">Stock: {product.stock} uds.</p>
                    </div>
                  </div>
                  <span className="font-bold text-green-600">${Number(product.precio).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Facturas Recientes
          </h3>
          {facturasRecientes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin facturas registradas</p>
          ) : (
            <div className="space-y-4">
              {facturasRecientes.map((f, index) => (
                <div key={index} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{f.desc}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{f.estado}</span>
                      <span className="text-xs font-semibold text-green-600">${Number(f.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alert stock bajo */}
      {productosStockBajo.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div className="flex-1">
              <h4 className="font-bold text-yellow-900 mb-1">Stock Bajo</h4>
              <p className="text-yellow-800 text-sm mb-3">
                {productosStockBajo.length} producto(s) con stock igual o menor al mínimo. Se recomienda orden de compra.
              </p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {productosStockBajo.slice(0, 3).map((p) => (
                  <li key={p.id}>• {p.nombre}: {p.stock_actual} uds. (mín. {p.stock_minimo})</li>
                ))}
                {productosStockBajo.length > 3 && <li>• y {productosStockBajo.length - 3} más...</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
