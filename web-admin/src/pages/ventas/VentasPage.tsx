import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ventasService } from '../../services/ventasService';
import type { Venta } from '../../types';
import {
  ShoppingCart,
  Search,
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  Eye,
  ReceiptText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ExportButtons from '../../components/ui/ExportButtons';
import { toast } from '../../store/toastStore';

export default function VentasPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);

  const { data: ventas = [], isLoading } = useQuery({
    queryKey: ['ventas'],
    queryFn: ventasService.getAll,
  });

  const facturarMutation = useMutation({
    mutationFn: ventasService.generarFactura,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const sri = data?.sri;
      if (sri?.success) {
        toast.success(sri?.mensaje || 'Factura generada y enviada al SRI');
        return;
      }
      if (sri?.mensaje) {
        toast.error(sri.mensaje);
        return;
      }
      toast.success('Factura generada');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'No se pudo generar la factura');
    },
  });

  const ventasArray = Array.isArray(ventas) ? ventas : [];

  const filteredVentas = ventasArray.filter(
    (v: Venta) =>
      v.numero_venta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.cliente_detalle?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalHoy = ventasArray
    .filter((v: Venta) => {
      const hoy = new Date().toLocaleDateString('sv-SE');
      return v.fecha_venta?.startsWith(hoy);
    })
    .reduce((sum: number, v: Venta) => sum + Number(v.total || 0), 0);

  const totalMes = ventasArray.reduce(
    (sum: number, v: Venta) => sum + Number(v.total || 0),
    0
  );

  const metodoPagoMap: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    TRANSFERENCIA: 'Transferencia',
    CHEQUE: 'Cheque',
  };

  const metodoPagoColor: Record<string, string> = {
    EFECTIVO: 'bg-green-100 text-green-800',
    TARJETA: 'bg-blue-100 text-blue-800',
    TRANSFERENCIA: 'bg-sky-100 text-sky-800',
    CHEQUE: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
            Ventas
          </h1>
          <p className="text-gray-600 mt-1">Historial y reporte de ventas del POS</p>
        </div>
        <ExportButtons basePath="/ventas/ventas" filename="ventas" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Ventas</p>
              <p className="text-2xl font-bold text-gray-800">{ventasArray.length}</p>
            </div>
            <ShoppingCart className="text-blue-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ventas Hoy</p>
              <p className="text-2xl font-bold text-gray-800">
                ${totalHoy.toFixed(2)}
              </p>
            </div>
            <Calendar className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Mes</p>
              <p className="text-2xl font-bold text-gray-800">
                ${totalMes.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-sky-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Promedio por Venta</p>
              <p className="text-2xl font-bold text-gray-800">
                ${ventasArray.length > 0 ? (totalMes / ventasArray.length).toFixed(2) : '0.00'}
              </p>
            </div>
            <DollarSign className="text-sky-500" size={32} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por número de venta o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
          </div>
        ) : filteredVentas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ShoppingCart size={48} className="mb-4 text-gray-300" />
            <p className="text-lg font-medium">No hay ventas registradas</p>
            <p className="text-sm mt-1">Las ventas del POS aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Venta</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Método de Pago</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IVA</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVentas.map((venta: Venta) => (
                  <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-blue-700">
                        {venta.numero_venta}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {venta.cliente_detalle?.razon_social || 'Consumidor Final'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {venta.fecha_venta
                        ? format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm', { locale: es })
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {(venta.pagos ?? []).map((p, i) => (
                        <span key={i} className={`px-2 py-1 rounded-full text-xs font-semibold mr-1 ${metodoPagoColor[p.forma_pago] || 'bg-gray-100 text-gray-700'}`}>
                          <CreditCard size={10} className="inline mr-1" />
                          {metodoPagoMap[p.forma_pago] || p.forma_pago}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {venta.factura_detalle ? (
                        <div>
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            Factura SRI
                          </span>
                          <p className="mt-1 font-mono text-xs text-gray-500">{venta.factura_detalle.numero_factura}</p>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          Nota de venta / ticket
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">
                      ${Number(venta.subtotal || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">
                      ${Number(venta.iva || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-gray-900">
                        ${Number(venta.total || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedVenta(venta)}
                        className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalle"
                      >
                        <Eye size={18} />
                      </button>
                      {!venta.factura_detalle && venta.estado === 'COMPLETADA' && (
                        <button
                          onClick={() => facturarMutation.mutate(venta.id)}
                          disabled={facturarMutation.isPending}
                          className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Generar factura desde esta venta"
                        >
                          <ReceiptText size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      {selectedVenta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                Venta {selectedVenta.numero_venta}
              </h2>
              <button
                onClick={() => setSelectedVenta(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium">{selectedVenta.cliente_detalle?.razon_social || 'Consumidor Final'}</p>
                  {selectedVenta.cliente_detalle?.identificacion && (
                    <p className="text-xs text-gray-400">{selectedVenta.cliente_detalle.identificacion}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Fecha</p>
                  <p className="font-medium">
                    {selectedVenta.fecha_venta
                      ? format(new Date(selectedVenta.fecha_venta), 'dd/MM/yyyy HH:mm', { locale: es })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Método de Pago</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(selectedVenta.pagos ?? []).map((p, i) => (
                      <span key={i} className="text-xs font-medium">
                        {metodoPagoMap[p.forma_pago] || p.forma_pago}: ${Number(p.monto).toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-500">Estado</p>
                  <p className="font-medium capitalize">{selectedVenta.estado}</p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div>
                  <p className="text-gray-500 text-sm mb-2">Productos vendidos</p>
                  <div className="space-y-2">
                    {(selectedVenta.detalles ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400">Sin detalle disponible</p>
                    ) : (
                      selectedVenta.detalles?.map((detalle, index) => (
                        <div key={`${detalle.producto}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-gray-800">{detalle.producto_detalle?.nombre || 'Producto'}</p>
                            <p className="text-xs text-gray-500">
                              {detalle.cantidad} x ${Number(detalle.precio_unitario).toFixed(2)}
                            </p>
                          </div>
                          <span className="font-semibold text-gray-800">${Number(detalle.total).toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>${Number(selectedVenta.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Descuento</span>
                  <span>-${Number(selectedVenta.descuento || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA</span>
                  <span>${Number(selectedVenta.iva || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="text-blue-700">${Number(selectedVenta.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={() => setSelectedVenta(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
