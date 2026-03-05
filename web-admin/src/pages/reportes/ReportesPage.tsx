import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ventasService } from '../../services/ventasService';
import type { Venta } from '../../types';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Calendar } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function ReportesPage() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(
    format(subDays(today, 30), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(format(today, 'yyyy-MM-dd'));

  const { data: ventas = [], isLoading } = useQuery({
    queryKey: ['ventas'],
    queryFn: ventasService.getAll,
  });

  const ventasArray: Venta[] = Array.isArray(ventas) ? ventas : [];

  // Filtrar por rango de fechas
  // Django devuelve '2026-03-02 03:41:29' (espacio) o ISO '2026-03-02T03:41:29'
  const ventasFiltradas = ventasArray.filter((v) => {
    if (!v.fecha_venta) return false;
    const fecha = v.fecha_venta.split('T')[0].split(' ')[0];
    return fecha >= dateFrom && fecha <= dateTo;
  });

  // Ventas por día (últimos 30 días)
  const ventasPorDia = (() => {
    const map: Record<string, number> = {};
    ventasFiltradas.forEach((v) => {
      const dia = v.fecha_venta?.split('T')[0].split(' ')[0] || '';
      map[dia] = (map[dia] || 0) + Number(v.total || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-15)
      .map(([fecha, total]) => ({
        fecha: format(parseISO(fecha), 'd MMM', { locale: es }),
        total: Number(total.toFixed(2)),
      }));
  })();

  // Ventas por método de pago
  const METODO_LABELS: Record<string, string> = {
    EFECTIVO: 'Efectivo', TARJETA_CREDITO: 'T. Crédito', TARJETA_DEBITO: 'T. Débito',
    TRANSFERENCIA: 'Transferencia', CHEQUE: 'Cheque',
  };
  const ventasPorMetodo = (() => {
    const map: Record<string, number> = {};
    ventasFiltradas.forEach((v) => {
      (v.pagos ?? []).forEach((p) => {
        const metodo = p.forma_pago || 'OTRO';
        map[metodo] = (map[metodo] || 0) + Number(p.monto || 0);
      });
      // fallback si no hay pagos
      if (!v.pagos || v.pagos.length === 0) {
        map['OTRO'] = (map['OTRO'] || 0) + Number(v.total || 0);
      }
    });
    return Object.entries(map).map(([name, value]) => ({
      name: METODO_LABELS[name] || name,
      value: Number(value.toFixed(2)),
    }));
  })();

  const totalVentas = ventasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
  const promedioVenta = ventasFiltradas.length > 0 ? totalVentas / ventasFiltradas.length : 0;
  const cantidadVentas = ventasFiltradas.length;
  const ventasHoy = ventasArray.filter((v) => {
    const fecha = v.fecha_venta?.split('T')[0].split(' ')[0];
    return fecha === format(today, 'yyyy-MM-dd');
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Reportes
          </h1>
          <p className="text-gray-600 mt-1">Análisis de ventas y estadísticas del negocio</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <Calendar size={18} className="text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border-none outline-none text-gray-700"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border-none outline-none text-gray-700"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Ventas (Período)', value: `$${totalVentas.toFixed(2)}`, icon: DollarSign, color: 'border-green-500', iconColor: 'text-green-500' },
          { label: 'Cantidad Ventas', value: cantidadVentas.toString(), icon: ShoppingCart, color: 'border-blue-500', iconColor: 'text-blue-500' },
          { label: 'Promedio por Venta', value: `$${promedioVenta.toFixed(2)}`, icon: TrendingUp, color: 'border-purple-500', iconColor: 'text-purple-500' },
          { label: 'Ventas Hoy', value: ventasHoy.toString(), icon: Calendar, color: 'border-orange-500', iconColor: 'text-orange-500' },
        ].map(({ label, value, icon: Icon, color, iconColor }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
              </div>
              <Icon className={iconColor} size={30} />
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
        </div>
      ) : ventasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-20 text-center text-gray-400">
          <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Sin datos para el período seleccionado</p>
          <p className="text-sm mt-1">Ajusta el rango de fechas ou realiza ventas desde el POS</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ventas por día */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Ventas por Día</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ventasPorDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Método de pago */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Por Método de Pago</h2>
            {ventasPorMetodo.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={ventasPorMetodo}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {ventasPorMetodo.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {ventasPorMetodo.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <span className="font-semibold">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-gray-400 py-10 text-sm">Sin datos</p>
            )}
          </div>

          {/* Evolución ventas */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Evolución de Ventas</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ventasPorDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : v)} />
                <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="Total $" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
