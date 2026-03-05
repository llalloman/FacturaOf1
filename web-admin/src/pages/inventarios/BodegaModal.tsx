import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bodegasService } from '../../services/bodegasService';
import type { Bodega } from '../../types';
import { FiX } from 'react-icons/fi';

interface BodegaModalProps {
  bodega: Bodega | null;
  onClose: () => void;
}

const BodegaModal: React.FC<BodegaModalProps> = ({ bodega, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nombre: bodega?.nombre || '',
    codigo: bodega?.codigo || '',
    direccion: bodega?.direccion || '',
    es_principal: bodega?.es_principal ?? false,
    activa: bodega?.activa ?? true,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Bodega>) => {
      if (bodega) {
        return bodegasService.update(bodega.id, data);
      }
      return bodegasService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6 flex justify-between items-center rounded-t-xl">
          <h2 className="text-2xl font-bold">
            {bodega ? 'Editar Bodega' : 'Nueva Bodega'}
          </h2>
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
                Nombre *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código *
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <input
              type="text"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="es_principal"
                checked={formData.es_principal}
                onChange={(e) => setFormData({ ...formData, es_principal: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="es_principal" className="text-sm font-medium text-gray-700">
                Bodega principal
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="activa"
                checked={formData.activa}
                onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="activa" className="text-sm font-medium text-gray-700">
                Activa
              </label>
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
              disabled={mutation.isPending}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : bodega ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BodegaModal;
