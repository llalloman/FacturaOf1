import { useState } from 'react';
import { usePOSStore } from '../store/posStore';
import { ConfigPOS } from '../types';

export default function ConfigScreen() {
  const setConfig = usePOSStore((state) => state.setConfig);
  
  const [formData, setFormData] = useState<ConfigPOS>({
    empresa_id: 1,
    caja_id: 1,
    usuario_id: 1,
    bodega_id: 1,
    servidor_url: 'http://localhost:8000',
    modo_offline: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guardar configuración
    if (window.electron?.config?.set) {
      await window.electron.config.set('pos_config', formData);
    } else {
      // En desarrollo web, guardar en localStorage
      localStorage.setItem('pos_config', JSON.stringify(formData));
    }
    setConfig(formData);
    alert('Configuración guardada correctamente');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Configuración del POS
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Empresa
            </label>
            <input
              type="number"
              name="empresa_id"
              value={formData.empresa_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Caja
            </label>
            <input
              type="number"
              name="caja_id"
              value={formData.caja_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Usuario
            </label>
            <input
              type="number"
              name="usuario_id"
              value={formData.usuario_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Bodega
            </label>
            <input
              type="number"
              name="bodega_id"
              value={formData.bodega_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL del Servidor
            </label>
            <input
              type="url"
              name="servidor_url"
              value={formData.servidor_url}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://localhost:8000"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="modo_offline"
              checked={formData.modo_offline}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Iniciar en modo offline
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Guardar Configuración
          </button>
        </form>
      </div>
    </div>
  );
}
