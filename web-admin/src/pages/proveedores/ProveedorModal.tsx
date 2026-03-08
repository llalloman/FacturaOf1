import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proveedoresService } from '../../services/proveedoresService';
import type { Proveedor } from '../../types';
import { FiX } from 'react-icons/fi';

interface ProveedorModalProps {
  proveedor: Proveedor | null;
  onClose: () => void;
}

const ProveedorModal: React.FC<ProveedorModalProps> = ({ proveedor, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    tipo_identificacion: proveedor?.tipo_identificacion || 'RUC',
    identificacion: proveedor?.identificacion || '',
    razon_social: proveedor?.razon_social || '',
    nombre_comercial: proveedor?.nombre_comercial || '',
    email: proveedor?.email || '',
    telefono: proveedor?.telefono || '',
    direccion: proveedor?.direccion || '',
    activo: proveedor?.activo ?? true,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Proveedor>) => {
      if (proveedor) {
        return proveedoresService.update(proveedor.id, data);
      }
      return proveedoresService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-700 to-sky-500 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
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
                Tipo Identificación *
              </label>
              <select
                value={formData.tipo_identificacion}
                onChange={(e) => setFormData({ ...formData, tipo_identificacion: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                required
              >
                <option value="RUC">RUC</option>
                <option value="CEDULA">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Identificación *
              </label>
              <input
                type="text"
                value={formData.identificacion}
                onChange={(e) => setFormData({ ...formData, identificacion: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Razón Social *
            </label>
            <input
              type="text"
              value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Comercial
            </label>
            <input
              type="text"
              value={formData.nombre_comercial}
              onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="text"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <textarea
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Activo
            </label>
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
              className="px-6 py-2 bg-gradient-to-r from-blue-700 to-sky-500 text-white rounded-lg hover:from-blue-800 hover:to-sky-600 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : proveedor ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProveedorModal;
