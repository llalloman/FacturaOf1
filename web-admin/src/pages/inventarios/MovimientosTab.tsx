import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventariosService } from '../../services/inventariosService';
import { FiPlus, FiTrendingUp, FiTrendingDown, FiRefreshCw } from 'react-icons/fi';
import MovimientoModal from './MovimientoModal';

const MovimientosTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: movimientos, isLoading } = useQuery({
    queryKey: ['movimientos-inventario'],
    queryFn: inventariosService.getMovimientos,
  });

  const movimientosArray = Array.isArray(movimientos) ? movimientos : [];

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA': return <FiTrendingUp className="text-green-600" />;
      case 'SALIDA': return <FiTrendingDown className="text-red-600" />;
      case 'AJUSTE': return <FiRefreshCw className="text-yellow-600" />;
      default: return <FiRefreshCw className="text-blue-600" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA': return 'text-green-600 bg-green-50';
      case 'SALIDA': return 'text-red-600 bg-red-50';
      case 'AJUSTE': return 'text-yellow-600 bg-yellow-50';
      case 'TRANSFERENCIA': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FiPlus /> Nuevo Movimiento
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                <th className="text-left p-4 font-semibold text-gray-700">Tipo</th>
                <th className="text-left p-4 font-semibold text-gray-700">Bodega</th>
                <th className="text-left p-4 font-semibold text-gray-700">Producto</th>
                <th className="text-right p-4 font-semibold text-gray-700">Cantidad</th>
                <th className="text-left p-4 font-semibold text-gray-700">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {movimientosArray.map((movimiento) => (
                <tr key={movimiento.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-700">
                    {new Date(movimiento.fecha).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getTipoIcon(movimiento.tipo_movimiento)}
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTipoColor(movimiento.tipo_movimiento)}`}>
                        {movimiento.tipo_movimiento}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-700">
                    {movimiento.bodega_nombre || `Bodega #${movimiento.bodega}`}
                  </td>
                  <td className="p-4 text-gray-700">
                    {movimiento.producto_nombre || `Producto #${movimiento.producto}`}
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-900">
                    {movimiento.cantidad}
                  </td>
                  <td className="p-4 text-gray-600 text-sm">
                    {movimiento.observaciones || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {movimientosArray.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay movimientos registrados
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <MovimientoModal
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default MovimientosTab;
