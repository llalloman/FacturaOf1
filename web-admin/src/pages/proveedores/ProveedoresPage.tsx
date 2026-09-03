import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proveedoresService } from '../../services/proveedoresService';
import type { Proveedor } from '../../types';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiPackage } from 'react-icons/fi';
import ProveedorModal from './ProveedorModal';
import ProveedorProductosPanel from './ProveedorProductosPanel';
import RecepcionesPanel from './RecepcionesPanel';
import CuentasPorPagarPanel from './CuentasPorPagarPanel';
import { confirmDialog } from '../../store/confirmStore';

const ProveedoresPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [activeTab, setActiveTab] = useState<'proveedores' | 'catalogo' | 'recepciones' | 'cuentas'>('proveedores');
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

  const handleDelete = async (id: number) => {
    if (await confirmDialog('¿Está seguro de eliminar este proveedor?', undefined, 'danger')) {
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 bg-clip-text text-transparent">
            Proveedores
          </h1>
          <p className="text-gray-600 mt-1">Gestión de proveedores y compras</p>
        </div>
        {activeTab === 'proveedores' && <button
          onClick={() => {
            setSelectedProveedor(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 to-sky-500 text-white rounded-lg hover:from-blue-800 hover:to-sky-600 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FiPlus /> Nuevo Proveedor
        </button>}
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-6" role="tablist" aria-label="Administración de proveedores">
          <button type="button" role="tab" aria-selected={activeTab === 'proveedores'} onClick={() => setActiveTab('proveedores')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${activeTab === 'proveedores' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Proveedores
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'catalogo'} onClick={() => setActiveTab('catalogo')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${activeTab === 'catalogo' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Productos vinculados
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'recepciones'} onClick={() => setActiveTab('recepciones')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${activeTab === 'recepciones' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Recepciones
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'cuentas'} onClick={() => setActiveTab('cuentas')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${activeTab === 'cuentas' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Cuentas por pagar
          </button>
        </div>
      </div>

      {activeTab === 'proveedores' && <><div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-sky-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Proveedores</p>
              <p className="text-3xl font-bold text-gray-800">{totalProveedores}</p>
            </div>
            <FiPackage className="text-4xl text-sky-500" />
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-sky-50 to-sky-50">
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
      </div></>}

      {activeTab === 'catalogo' && <ProveedorProductosPanel proveedores={proveedoresArray} />}

      {activeTab === 'recepciones' && <RecepcionesPanel />}

      {activeTab === 'cuentas' && <CuentasPorPagarPanel />}

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
