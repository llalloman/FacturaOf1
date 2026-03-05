import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proveedoresService } from '../../services/proveedoresService';
import type { Proveedor } from '../../types';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiPackage } from 'react-icons/fi';
import ProveedorModal from './ProveedorModal';

const ProveedoresPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const queryClient = useQueryClient();

  const { data: proveedores, isLoading } = useQuery({
    queryKey: ['proveedores'],
    queryFn: proveedoresService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: proveedoresService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });

  const proveedoresArray = Array.isArray(proveedores) ? proveedores : [];

  const filteredProveedores = proveedoresArray.filter((proveedor) =>
    proveedor.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.identificacion.includes(searchTerm)
  );

  const handleEdit = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Está seguro de eliminar este proveedor?')) {
      deleteMutation.mutate(id);
    }
  };

  const totalProveedores = proveedoresArray.length;
  const proveedoresActivos = proveedoresArray.filter(p => p.activo).length;
  const conEmail = proveedoresArray.filter(p => p.email).length;
  const conTelefono = proveedoresArray.filter(p => p.telefono).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
            Proveedores
          </h1>
          <p className="text-gray-600 mt-1">Gestión de proveedores y compras</p>
        </div>
        <button
          onClick={() => {
            setSelectedProveedor(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FiPlus /> Nuevo Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Proveedores</p>
              <p className="text-3xl font-bold text-gray-800">{totalProveedores}</p>
            </div>
            <FiPackage className="text-4xl text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Activos</p>
              <p className="text-3xl font-bold text-gray-800">{proveedoresActivos}</p>
            </div>
            <FiPackage className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Con Email</p>
              <p className="text-3xl font-bold text-gray-800">{conEmail}</p>
            </div>
            <FiPackage className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Con Teléfono</p>
              <p className="text-3xl font-bold text-gray-800">{conTelefono}</p>
            </div>
            <FiPackage className="text-4xl text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o identificación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-pink-50">
                  <th className="text-left p-4 font-semibold text-gray-700">Identificación</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Razón Social</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Contacto</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Dirección</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProveedores.map((proveedor) => (
                  <tr key={proveedor.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{proveedor.identificacion}</div>
                        <div className="text-sm text-gray-500">{proveedor.tipo_identificacion}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{proveedor.razon_social}</div>
                        {proveedor.nombre_comercial && (
                          <div className="text-sm text-gray-500">{proveedor.nombre_comercial}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-700">
                      <div>{proveedor.email || '-'}</div>
                      <div className="text-sm">{proveedor.telefono || '-'}</div>
                    </td>
                    <td className="p-4 text-gray-700">{proveedor.direccion || '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        proveedor.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {proveedor.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEdit(proveedor)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Editar"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDelete(proveedor.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Eliminar"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProveedores.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No se encontraron proveedores
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProveedorModal
          proveedor={selectedProveedor}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProveedor(null);
          }}
        />
      )}
    </div>
  );
};

export default ProveedoresPage;
