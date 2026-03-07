import { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { Cliente } from '../types';
import { apiService } from '../services/apiService';

interface ClientSelectorProps {
  onClose: () => void;
}

const TIPOS_ID = [
  { value: '05', label: 'Cédula' },
  { value: '04', label: 'RUC' },
  { value: '06', label: 'Pasaporte' },
  { value: '07', label: 'Consumidor Final' },
  { value: '08', label: 'Identificación Exterior' },
];

export default function ClientSelector({ onClose }: ClientSelectorProps) {
  const config = usePOSStore((state) => state.config);
  const setCliente = usePOSStore((state) => state.setCliente);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Formulario nuevo cliente
  const [form, setForm] = useState({
    tipo_identificacion: '05',
    identificacion: '',
    razon_social: '',
    email: '',
    telefono: '',
    direccion: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      if (window.electron?.clientes?.listar) {
        const result = await window.electron.clientes.listar({ empresaId: config?.empresa_id });
        if (result.success) setClientes(result.clientes || []);
      } else {
        setClientes([{
          id: 1, empresa_id: 1, identificacion: '9999999999999', razon_social: 'CONSUMIDOR FINAL',
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

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.identificacion.trim()) { setFormError('La identificación es obligatoria'); return; }
    if (!form.razon_social.trim()) { setFormError('La razón social es obligatoria'); return; }

    setSaving(true);
    try {
      const nuevo = await apiService.crearCliente({
        tipo_identificacion: form.tipo_identificacion,
        identificacion: form.identificacion.trim(),
        razon_social: form.razon_social.trim().toUpperCase(),
        email: form.email.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
      });
      // Actualizar cache local
      if (window.electron?.sync?.actualizarCacheClientes) {
        await window.electron.sync.actualizarCacheClientes([nuevo]);
      }
      // Seleccionar y cerrar
      setCliente(nuevo);
      onClose();
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (apiErr) {
        const msgs = Object.entries(apiErr).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
        setFormError(msgs);
      } else {
        setFormError('Error al crear el cliente. Verifique la conexión.');
      }
    } finally {
      setSaving(false);
    }
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.identificacion.includes(busqueda)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {showForm ? 'Nuevo Cliente' : 'Seleccionar Cliente'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {showForm ? (
          /* ── Formulario nuevo cliente ── */
          <form onSubmit={handleCrearCliente} className="flex-1 overflow-y-auto p-5 space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-3 text-sm">{formError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de identificación *</label>
              <select
                value={form.tipo_identificacion}
                onChange={(e) => setForm({ ...form, tipo_identificacion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {TIPOS_ID.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identificación *</label>
              <input
                type="text"
                value={form.identificacion}
                onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                placeholder={form.tipo_identificacion === '04' ? '0000000000001' : form.tipo_identificacion === '05' ? '0000000000' : ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón social *</label>
              <input
                type="text"
                value={form.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                placeholder="Nombre completo o razón social"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="0999999999"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección del cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
              >
                {saving ? 'Guardando…' : 'Guardar y Seleccionar'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Lista de clientes ── */
          <>
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

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No se encontraron clientes</div>
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
                      {cliente.email && <p className="text-xs text-gray-500">Email: {cliente.email}</p>}
                      {cliente.telefono && <p className="text-xs text-gray-500">Tel: {cliente.telefono}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón Nuevo Cliente */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => { setShowForm(true); setFormError(''); setForm({ tipo_identificacion: '05', identificacion: '', razon_social: '', email: '', telefono: '', direccion: '' }); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Cliente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

