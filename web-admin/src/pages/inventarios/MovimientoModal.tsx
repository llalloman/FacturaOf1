import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { inventariosService } from '../../services/inventariosService';
import { bodegasService } from '../../services/bodegasService';
import { productosService } from '../../services/productosService';
import type { MovimientoInventario } from '../../types';
import { FiX } from 'react-icons/fi';

interface MovimientoModalProps {
  onClose: () => void;
}

const MovimientoModal: React.FC<MovimientoModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    bodega: 0,
    producto: 0,
    tipo_movimiento: 'ENTRADA' as 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRANSFERENCIA',
    cantidad: 1,
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
  });

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas'],
    queryFn: bodegasService.getAll,
  });

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: productosService.getAll,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<MovimientoInventario>) => {
      return inventariosService.createMovimiento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      onClose();
    },
  });

  const bodegasArray = Array.isArray(bodegas) ? bodegas : [];
  const productosArray = Array.isArray(productos) ? productos : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-6 flex justify-between items-center rounded-t-xl">
          <h2 className="text-2xl font-bold">Nuevo Movimiento</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Movimiento *
              </label>
              <select
                value={formData.tipo_movimiento}
                onChange={(e) => setFormData({ ...formData, tipo_movimiento: e.target.value as 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRANSFERENCIA' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bodega *
            </label>
            <select
              value={formData.bodega}
              onChange={(e) => setFormData({ ...formData, bodega: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value={0}>Seleccione una bodega</option>
              {bodegasArray.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>
                  {bodega.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Producto *
            </label>
            <select
              value={formData.producto}
              onChange={(e) => setFormData({ ...formData, producto: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value={0}>Seleccione un producto</option>
              {productosArray.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre} (Stock: {producto.stock_actual})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad *
            </label>
            <input
              type="number"
              value={formData.cantidad}
              onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
              disabled={mutation.isPending}
              className="px-6 py-2 bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-lg hover:from-blue-800 hover:to-blue-950 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : 'Crear Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MovimientoModal;
