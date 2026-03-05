import { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { Cliente } from '../types';

interface ClientSelectorProps {
  onClose: () => void;
}

export default function ClientSelector({ onClose }: ClientSelectorProps) {
  const config = usePOSStore((state) => state.config);
  const setCliente = usePOSStore((state) => state.setCliente);
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      if (window.electron?.clientes?.listar) {
        const result = await window.electron.clientes.listar({
          empresaId: config?.empresa_id,
        });

        if (result.success) {
          setClientes(result.clientes || []);
        }
      } else {
        // Modo web - cliente de prueba
        setClientes([{
          id: 1,
          empresa_id: 1,
          identificacion: '9999999999999',
          razon_social: 'CONSUMIDOR FINAL',
          email: '',
          telefono: '',
          direccion: '',
        }]);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccionar = (cliente: Cliente) => {
    setCliente(cliente);
    onClose();
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.identificacion.includes(busqueda)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Seleccionar Cliente</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Búsqueda */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o identificación..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Lista de clientes */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No se encontraron clientes
            </div>
          ) : (
            <div className="space-y-2">
              {clientesFiltrados.map((cliente) => (
                <div
                  key={cliente.id}
                  onClick={() => handleSeleccionar(cliente)}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                >
                  <p className="font-semibold text-gray-800">{cliente.razon_social}</p>
                  <p className="text-sm text-gray-600">RUC/CI: {cliente.identificacion}</p>
                  {cliente.email && (
                    <p className="text-xs text-gray-500">Email: {cliente.email}</p>
                  )}
                  {cliente.telefono && (
                    <p className="text-xs text-gray-500">Tel: {cliente.telefono}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
