import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { empresasService } from '../../services/empresasService';
import type { Empresa } from '../../types';
import {
  Building2, Plus, Pencil, Trash2, Search, CheckCircle, XCircle,
  AlertCircle, X,
} from 'lucide-react';

const EMPTY_FORM: Partial<Empresa> = {
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  tipo_contribuyente: 'NATURAL',
  obligado_contabilidad: false,
  contribuyente_especial: '',
  direccion_matriz: '',
  telefono: '',
  email: '',
  ambiente: '1',
  establecimiento_codigo: '001',
  punto_emision_codigo: '001',
  activa: true,
};

export default function EmpresasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Partial<Empresa>>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: empresasService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empresas'] }); closeModal(); },
    onError: (e: unknown) => setError((e as {response?: {data?: unknown}}).response?.data ? JSON.stringify((e as {response?: {data?: unknown}}).response?.data) : 'Error al crear empresa'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Empresa> }) =>
      empresasService.update(id, data as Parameters<typeof empresasService.update>[1]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empresas'] }); closeModal(); },
    onError: (e: unknown) => setError((e as {response?: {data?: unknown}}).response?.data ? JSON.stringify((e as {response?: {data?: unknown}}).response?.data) : 'Error al actualizar empresa'),
  });

  const deleteMutation = useMutation({
    mutationFn: empresasService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empresas'] }); setDeleteConfirm(null); },
  });

  const filtered = empresas.filter((e) =>
    e.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    e.ruc.includes(search) ||
    (e.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (emp: Empresa) => {
    setEditing(emp);
    setForm({ ...emp });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
            <p className="text-sm text-gray-500">Gestión de empresas (tenants)</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Nueva Empresa
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por nombre, RUC o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3" />
            Cargando empresas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Building2 size={48} className="mb-3 opacity-30" />
            <p className="text-lg font-medium">No hay empresas registradas</p>
            <p className="text-sm">Haz clic en "Nueva Empresa" para crear una</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Empresa</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">RUC</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Ambiente</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{emp.razon_social}</div>
                    {emp.nombre_comercial && (
                      <div className="text-xs text-gray-400">{emp.nombre_comercial}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-700">{emp.ruc}</td>
                  <td className="px-6 py-4 text-gray-600">{emp.email ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.ambiente === '2'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {emp.ambiente === '2' ? 'Producción' : 'Pruebas'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {emp.activa ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={14} /> Activa
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <XCircle size={14} /> Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(emp.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Editar Empresa' : 'Nueva Empresa'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* RUC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUC *</label>
                  <input
                    required
                    maxLength={13}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.ruc ?? ''}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                    placeholder="1791234560001"
                  />
                </div>

                {/* Razón Social */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
                  <input
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.razon_social ?? ''}
                    onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                  />
                </div>

                {/* Nombre Comercial */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.nombre_comercial ?? ''}
                    onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
                  />
                </div>

                {/* Tipo Contribuyente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Contribuyente *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.tipo_contribuyente ?? 'NATURAL'}
                    onChange={(e) => setForm({ ...form, tipo_contribuyente: e.target.value })}
                  >
                    <option value="NATURAL">Persona Natural</option>
                    <option value="SOCIEDAD">Sociedad</option>
                    <option value="PUBLICA">Institución Pública</option>
                  </select>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.email ?? ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.telefono ?? ''}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>

                {/* Dirección Matriz */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Matriz *</label>
                  <input
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.direccion_matriz ?? ''}
                    onChange={(e) => setForm({ ...form, direccion_matriz: e.target.value })}
                  />
                </div>

                {/* Ambiente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente SRI *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.ambiente ?? '1'}
                    onChange={(e) => setForm({ ...form, ambiente: e.target.value as '1' | '2' })}
                  >
                    <option value="1">Pruebas</option>
                    <option value="2">Producción</option>
                  </select>
                </div>

                {/* Establecimiento / Punto Emisión */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Establecimiento</label>
                    <input
                      maxLength={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.establecimiento_codigo ?? '001'}
                      onChange={(e) => setForm({ ...form, establecimiento_codigo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pto. Emisión</label>
                    <input
                      maxLength={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.punto_emision_codigo ?? '001'}
                      onChange={(e) => setForm({ ...form, punto_emision_codigo: e.target.value })}
                    />
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="col-span-2 flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.obligado_contabilidad ?? false}
                      onChange={(e) => setForm({ ...form, obligado_contabilidad: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    Obligado a llevar contabilidad
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.activa ?? true}
                      onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    Empresa activa
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isBusy ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Eliminar empresa</h3>
            </div>
            <p className="text-gray-600 text-sm mb-5">
              ¿Estás seguro? Esta acción no se puede deshacer y eliminará todos los datos asociados.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
