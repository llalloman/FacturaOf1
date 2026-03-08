import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { facturasService } from '../../services/facturasService';
import { clientesService } from '../../services/clientesService';
import { productosService } from '../../services/productosService';
import type { Factura, DetalleFactura } from '../../types';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';

interface FacturaModalProps {
  factura: Factura | null;
  onClose: () => void;
}

const FacturaModal: React.FC<FacturaModalProps> = ({ factura, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    cliente: factura?.cliente || 0,
    fecha_emision: factura?.fecha_emision || new Date().toISOString().split('T')[0],
    total_descuento: 0,
  });

  const [detalles, setDetalles] = useState<DetalleFactura[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(0);
  const [cantidad, setCantidad] = useState(1);

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: clientesService.getAll,
  });

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: productosService.getAll,
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (factura) {
        return facturasService.update(factura.id, data);
      }
      return facturasService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
  });

  const clientesArray = Array.isArray(clientes) ? clientes : [];
  const productosArray = Array.isArray(productos) ? productos : [];

  const agregarDetalle = () => {
    const producto = productosArray.find(p => p.id === productoSeleccionado);
    if (!producto || cantidad <= 0) return;

    const precio_unitario = producto.precio;
    const subtotal = precio_unitario * cantidad;
    // porcentaje_iva es el código SRI ('0'=0%, '2'=12%, '4'=15%) – no es el % real
    const IVA_PCT: Record<string, number> = { '0': 0, '2': 12, '3': 14, '4': 15, '6': 0, '7': 0 };
    const ivaRate = producto.aplica_iva ? (IVA_PCT[producto.porcentaje_iva] ?? 15) : 0;
    const impuestos = subtotal * (ivaRate / 100);
    const total = subtotal + impuestos;

    const nuevoDetalle: DetalleFactura = {
      producto: producto.id,
      producto_nombre: producto.nombre,
      cantidad,
      precio_unitario,
      descuento: 0,
      subtotal,
      impuestos,
      total,
    };

    setDetalles([...detalles, nuevoDetalle]);
    setProductoSeleccionado(0);
    setCantidad(1);
  };

  const eliminarDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    const subtotal = detalles.reduce((sum, d) => sum + d.subtotal, 0);
    const impuestos = detalles.reduce((sum, d) => sum + d.impuestos, 0);
    const total = subtotal + impuestos - formData.total_descuento;
    return { subtotal, impuestos, total };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      cliente: formData.cliente,
      fecha_emision_input: formData.fecha_emision,
      total_descuento: formData.total_descuento,
      detalles_input: detalles,
    });
  };

  const totales = calcularTotales();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-700 to-blue-900 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {factura ? 'Editar Factura' : 'Nueva Factura'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente *
              </label>
              <select
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value={0}>Seleccione un cliente</option>
                {clientesArray.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razon_social}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Emisión *
              </label>
              <input
                type="date"
                value={formData.fecha_emision}
                onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Agregar Productos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Producto
                </label>
                <select
                  value={productoSeleccionado}
                  onChange={(e) => setProductoSeleccionado(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>Seleccione un producto</option>
                  {productosArray.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre} - ${Number(producto.precio).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={agregarDetalle}
                  className="self-end px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FiPlus />
                </button>
              </div>
            </div>

            {detalles.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">Producto</th>
                      <th className="text-center p-3 text-sm font-semibold text-gray-700">Cantidad</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700">P. Unit</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700">Subtotal</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700">IVA</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700">Total</th>
                      <th className="text-center p-3 text-sm font-semibold text-gray-700">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((detalle, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3">{detalle.producto_nombre}</td>
                        <td className="p-3 text-center">{detalle.cantidad}</td>
                        <td className="p-3 text-right">${detalle.precio_unitario.toFixed(2)}</td>
                        <td className="p-3 text-right">${detalle.subtotal.toFixed(2)}</td>
                        <td className="p-3 text-right">${detalle.impuestos.toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold">${detalle.total.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarDetalle(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div></div>
              <div className="space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="font-medium">Subtotal:</span>
                  <span>${totales.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-medium">IVA:</span>
                  <span>${totales.impuestos.toFixed(2)}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descuento
                  </label>
                  <input
                    type="number"
                    value={formData.total_descuento}
                    onChange={(e) => setFormData({ ...formData, total_descuento: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-between text-2xl font-bold text-blue-600 pt-3 border-t-2">
                  <span>TOTAL:</span>
                  <span>${totales.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-end pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || detalles.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-lg hover:from-blue-800 hover:to-blue-950 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : factura ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FacturaModal;
