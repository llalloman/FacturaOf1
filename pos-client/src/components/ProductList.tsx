import { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { Producto } from '../types';

export default function ProductList() {
  const config = usePOSStore((state) => state.config);
  const agregarItem = usePOSStore((state) => state.agregarItem);
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    loadProductos();
  }, []);

  const loadProductos = async () => {
    try {
      if (window.electron?.productos?.listar) {
        // Modo Electron
        const result = await window.electron.productos.listar({
          empresaId: config?.empresa_id,
          buscar: busqueda,
        });

        if (result.success) {
          setProductos(result.productos || []);
        }
      } else {
        // Modo web - cargar productos de prueba o API directa
        setProductos([
          {
            id: 1,
            empresa_id: 1,
            codigo: 'PROD001',
            nombre: 'Producto de Prueba 1',
            precio: 10.50,
            costo: 5.00,
            stock_actual: 100,
            aplica_iva: true,
            porcentaje_iva: '4',
            activo: true,
          },
          {
            id: 2,
            empresa_id: 1,
            codigo: 'PROD002',
            nombre: 'Producto de Prueba 2',
            precio: 25.00,
            costo: 15.00,
            stock_actual: 50,
            aplica_iva: true,
            porcentaje_iva: '4',
            activo: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    loadProductos();
  };

  const handleAgregar = (producto: Producto) => {
    agregarItem(producto, 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Buscador */}
      <div className="p-4 border-b border-gray-200">
        <form onSubmit={handleBuscar} className="flex gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Lista de productos */}
      <div className="flex-1 overflow-y-auto p-4">
        {productos.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No se encontraron productos
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {productos.map((producto) => (
              <div
                key={producto.id}
                onClick={() => handleAgregar(producto)}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
              >
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm mb-1">
                      {producto.nombre}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      Código: {producto.codigo}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Stock:</p>
                      <p className={`text-sm font-semibold ${
                        producto.stock_actual > 10
                          ? 'text-green-600'
                          : producto.stock_actual > 0
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {producto.stock_actual}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">Precio:</p>
                      <p className="text-lg font-bold text-blue-600">
                        ${producto.precio.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
