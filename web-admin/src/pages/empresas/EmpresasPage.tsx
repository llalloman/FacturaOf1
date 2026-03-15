import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { empresasService } from '../../services/empresasService';
import { secuencialesService } from '../../services/secuencialesService';
import type { Empresa, Secuencial } from '../../types';
import {
  Building2, Plus, Pencil, Trash2, Search, CheckCircle, XCircle,
  AlertCircle, X, Hash, ChevronDown, ChevronRight, Lock,
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

// ─── Panel Secuenciales (SUPER_ADMIN override) ────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  '01': 'Factura',
  '04': 'Nota de Crédito',
  '05': 'Nota de Débito',
  '06': 'Guía de Remisión',
  '07': 'Comp. Retención',
};

function SecuencialesPanel({ empresaId, empresaNombre }: { empresaId: number; empresaNombre: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [patchError, setPatchError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const { data: secuenciales = [], isLoading } = useQuery({
    queryKey: ['secuenciales', empresaId],
    queryFn: () => secuencialesService.getAll(empresaId),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, val }: { id: number; val: number }) =>
      secuencialesService.patch(id, { secuencial_actual: val }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['secuenciales', empresaId] });
      setEditingId(null);
      setSaved(id);
      setPatchError(null);
      setTimeout(() => setSaved(null), 3000);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string; secuencial_actual?: string[] } } };
      setPatchError(
        err.response?.data?.detail ||
        err.response?.data?.secuencial_actual?.[0] ||
        'Error al guardar'
      );
    },
  });

  const inicializarMutation = useMutation({
    mutationFn: () => secuencialesService.inicializar(empresaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['secuenciales', empresaId] });
    },
  });

  const handleSave = (id: number) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) { setPatchError('Número inválido'); return; }
    patchMutation.mutate({ id, val });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-blue-600" />
        <span className="font-semibold text-sm text-gray-700">
          Secuenciales de {empresaNombre}
        </span>
        <span className="text-xs text-gray-400">(override SUPER_ADMIN)</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : secuenciales.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Hash size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500 mb-3">Aún no hay secuenciales configurados</p>
          <button
            onClick={() => inicializarMutation.mutate()}
            disabled={inicializarMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            {inicializarMutation.isPending ? 'Inicializando...' : 'Inicializar secuenciales'}
          </button>
        </div>
      ) : (
        <table className="w-full text-sm bg-white rounded-lg border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Tipo</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Estab.</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Pto. Emis.</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Secuencial</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {secuenciales.map((s: Secuencial) => (
              <tr key={s.id}>
                <td className="px-3 py-2 text-gray-700">
                  {TIPO_LABELS[s.tipo_comprobante] || s.tipo_comprobante}
                </td>
                <td className="px-3 py-2 font-mono text-gray-600">{s.establecimiento}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{s.punto_emision}</td>
                <td className="px-3 py-2">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-28 px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      {patchError && <span className="text-xs text-red-600">{patchError}</span>}
                    </div>
                  ) : (
                    <span className="font-mono font-semibold text-blue-700">
                      {String(s.secuencial_actual).padStart(9, '0')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {s.configurado ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      <Lock size={10} /> Bloq.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                      Pendiente
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editingId === s.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleSave(s.id)}
                        disabled={patchMutation.isPending}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
                      >
                        {patchMutation.isPending ? '...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setPatchError(null); }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(s.id); setEditValue(String(s.secuencial_actual)); setPatchError(null); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      ⚡ Override
                    </button>
                  )}
                  {saved === s.id && <span className="text-xs text-green-600 ml-1">✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EmpresasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Partial<Empresa>>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmpresa, setExpandedEmpresa] = useState<number | null>(null);

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
                <>
                  <tr key={`row-${emp.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setExpandedEmpresa(expandedEmpresa === emp.id ? null : emp.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        {expandedEmpresa === emp.id
                          ? <ChevronDown size={16} className="text-blue-600 flex-shrink-0" />
                          : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                        }
                        <div>
                          <div className="font-semibold text-gray-900">{emp.razon_social}</div>
                          {emp.nombre_comercial && (
                            <div className="text-xs text-gray-400">{emp.nombre_comercial}</div>
                          )}
                        </div>
                      </button>
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
                  {expandedEmpresa === emp.id && (
                    <tr key={`secuenciales-${emp.id}`}>
                      <td colSpan={6} className="px-6 py-4 bg-blue-50/50 border-t border-blue-100">
                        <SecuencialesPanel empresaId={emp.id} empresaNombre={emp.razon_social} />
                      </td>
                    </tr>
                  )}
                </>
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
