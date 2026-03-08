import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productosService } from '../../services/productosService';
import type { Producto } from '../../types';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertCircle,
  Filter,
  Download,
  Upload,
} from 'lucide-react';
import ProductoModal from './ProductoModal';

export default function ProductosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['productos'],
    queryFn: productosService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: productosService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
    },
  });

  const handleCreate = () => {
    setSelectedProducto(null);
    setModalOpen(true);
  };

  const handleEdit = (producto: Producto) => {
    setSelectedProducto(producto);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar este producto?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  // Asegurar que productos sea un array
  const productosArray = Array.isArray(productos) ? productos : [];
  
  const filteredProductos = productosArray.filter((p: Producto) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.codigo_principal ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockProducts = productosArray.filter((p: Producto) => Number(p.stock_actual) < Number(p.stock_minimo));

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-blue-50 to-sky-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-blue-600 to-sky-600 bg-clip-text text-transparent mb-2">Productos</h1>
            <p className="text-gray-600">Gestión de inventario y catálogo</p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-blue-600 to-sky-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:via-blue-700 hover:to-sky-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            <Plus size={20} />
            <span className="font-semibold">Nuevo Producto</span>
          </button>
        </div>

        {/* Alerts */}
        {lowStockProducts.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-gradient-to-b from-yellow-500 to-orange-500 rounded-r-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <p className="text-gray-800 font-medium">
                {lowStockProducts.length} producto(s) con stock bajo del mínimo
              </p>
            </div>
          </div>
        )}


        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-blue-700">
                <Filter size={18} />
                <span className="font-medium">Filtros</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-blue-700">
                <Download size={18} />
              </button>
              <button className="flex items-center gap-2 px-4 py-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-blue-700">
                <Upload size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Productos</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">{productosArray.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-green-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Stock Total</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent truncate">
                {productosArray.reduce((sum: number, p: Producto) => sum + Number(p.stock_actual), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-orange-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-xl shadow-md">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Stock Bajo</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{lowStockProducts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-sky-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-sky-500 to-sky-600 p-3 rounded-xl shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Valor Inventario</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-sky-500 to-blue-700 bg-clip-text text-transparent truncate">
                ${productosArray.reduce((sum: number, p: Producto) => sum + Number(p.costo) * Number(p.stock_actual), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-sky-50 border-b border-blue-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Costo</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredProductos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                filteredProductos.map((producto: Producto) => (
                  <tr key={producto.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">{producto.codigo_principal}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{producto.nombre}</p>
                        {producto.descripcion && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{producto.descripcion}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                      ${Number(producto.precio).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                      ${Number(producto.costo).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        Number(producto.stock_actual) < Number(producto.stock_minimo)
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {producto.stock_actual}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        producto.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(producto)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors hover:shadow-md"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(producto.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors hover:shadow-md"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ProductoModal
          producto={selectedProducto}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['productos'] });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
