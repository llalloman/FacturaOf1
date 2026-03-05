import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bodegasService } from '../../services/bodegasService';
import type { Bodega } from '../../types';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import BodegaModal from './BodegaModal';

const BodegasTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBodega, setSelectedBodega] = useState<Bodega | null>(null);
  const queryClient = useQueryClient();

  const { data: bodegas, isLoading } = useQuery({
    queryKey: ['bodegas'],
    queryFn: bodegasService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: bodegasService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
    },
  });

  const bodegasArray = Array.isArray(bodegas) ? bodegas : [];

  const handleEdit = (bodega: Bodega) => {
    setSelectedBodega(bodega);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Está seguro de eliminar esta bodega?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setSelectedBodega(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FiPlus /> Nueva Bodega
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bodegasArray.map((bodega) => (
            <div key={bodega.id} className="bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-xl shadow-lg border border-green-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{bodega.nombre}</h3>
                  <p className="text-sm text-gray-600">Código: {bodega.codigo}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  bodega.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {bodega.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="space-y-2 mb-4">
                {bodega.direccion && (
                  <p className="text-sm text-gray-700">📍 {bodega.direccion}</p>
                )}
                {bodega.responsable && (
                  <p className="text-sm text-gray-700">👤 {bodega.responsable}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(bodega)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiEdit2 /> Editar
                </button>
                <button
                  onClick={() => handleDelete(bodega.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <FiTrash2 /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {bodegasArray.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          No hay bodegas registradas
        </div>
      )}

      {isModalOpen && (
        <BodegaModal
          bodega={selectedBodega}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedBodega(null);
          }}
        />
      )}
    </div>
  );
};

export default BodegasTab;
