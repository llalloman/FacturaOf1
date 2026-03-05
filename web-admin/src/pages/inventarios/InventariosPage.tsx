import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventariosService } from '../../services/inventariosService';
import { bodegasService } from '../../services/bodegasService';
import { FiPackage, FiAlertTriangle, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import BodegasTab from './BodegasTab';
import MovimientosTab from './MovimientosTab';

const InventariosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bodegas' | 'movimientos'>('bodegas');

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas'],
    queryFn: bodegasService.getAll,
  });

  const { data: productosBajoStock } = useQuery({
    queryKey: ['productos-bajo-stock'],
    queryFn: inventariosService.getProductosBajoStock,
  });

  const bodegasArray = Array.isArray(bodegas) ? bodegas : [];
  const bajoStockArray = Array.isArray(productosBajoStock) ? productosBajoStock : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
          Inventarios
        </h1>
        <p className="text-gray-600 mt-1">Gestión de bodegas y movimientos de inventario</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Bodegas</p>
              <p className="text-3xl font-bold text-gray-800">{bodegasArray.length}</p>
            </div>
            <FiPackage className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Productos Bajo Stock</p>
              <p className="text-3xl font-bold text-gray-800">{bajoStockArray.length}</p>
            </div>
            <FiAlertTriangle className="text-4xl text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Entradas Hoy</p>
              <p className="text-3xl font-bold text-gray-800">0</p>
            </div>
            <FiTrendingUp className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Salidas Hoy</p>
              <p className="text-3xl font-bold text-gray-800">0</p>
            </div>
            <FiTrendingDown className="text-4xl text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* Tabs */}
        <div className="flex space-x-1 rounded-xl bg-gradient-to-r from-green-100 to-blue-100 p-1 mb-6">
          {(['bodegas', 'movimientos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {tab === 'bodegas' ? 'Bodegas' : 'Movimientos'}
            </button>
          ))}
        </div>

        {activeTab === 'bodegas' && <BodegasTab />}
        {activeTab === 'movimientos' && <MovimientosTab />}
      </div>
    </div>
  );
};

export default InventariosPage;
