import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usuariosService } from '../../services/usuariosService';
import { empresasService } from '../../services/empresasService';
import { useAuthStore } from '../../store/authStore';
import type { Usuario, Empresa } from '../../types';
import {
  UserPlus, Pencil, Search, CheckCircle, XCircle, X, KeyRound,
  ShieldCheck, Building2, UserCircle,
} from 'lucide-react';

const ROL_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_EMPRESA: 'Admin Empresa',
  CONTADOR: 'Contador',
  VENDEDOR: 'Vendedor',
  CONSULTOR: 'Consultor',
};

const ROL_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-sky-100 text-sky-800',
  ADMIN_EMPRESA: 'bg-blue-100 text-blue-800',
  CONTADOR: 'bg-blue-100 text-blue-800',
  VENDEDOR: 'bg-green-100 text-green-800',
  CONSULTOR: 'bg-gray-100 text-gray-700',
};

type RolOption = 'SUPER_ADMIN' | 'ADMIN_EMPRESA' | 'CONTADOR' | 'VENDEDOR' | 'CONSULTOR';

interface FormState {
  email: string;
  first_name: string;
  last_name: string;
  cedula: string;
  telefono: string;
  rol: RolOption;
  empresa: string;
  password: string;
  password_confirm: string;
}

const EMPTY_FORM: FormState = {
  email: '', first_name: '', last_name: '', cedula: '',
  telefono: '', rol: 'VENDEDOR', empresa: '', password: '', password_confirm: '',
};

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.rol === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || me?.rol === 'ADMIN_EMPRESA';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pwdModal, setPwdModal] = useState<Usuario | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasService.getAll,
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usuariosService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); closeModal(); },
    onError: (e: unknown) => setError(extractError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Usuario> }) =>
      usuariosService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); closeModal(); },
    onError: (e: unknown) => setError(extractError(e)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active ? usuariosService.activar(id) : usuariosService.desactivar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
    onError: (e: unknown) => setError(extractError(e)),
  });

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usuariosService.resetPassword(id, password),
    onSuccess: () => { setPwdModal(null); setNewPassword(''); },
    onError: (e: unknown) => setError(extractError(e)),
  });

  function extractError(e: unknown): string {
    const err = e as { response?: { data?: unknown } };
    if (err.response?.data) return JSON.stringify(err.response.data);
    return 'Error inesperado';
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, empresa: isSuperAdmin ? '' : String(me?.empresa_id ?? '') });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(u: Usuario) {
    setEditing(u);
    setForm({
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      cedula: u.cedula ?? '',
      telefono: u.telefono ?? '',
      rol: u.rol as RolOption,
      empresa: String(u.empresa ?? ''),
      password: '',
      password_confirm: '',
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!editing && form.password !== form.password_confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    const payload: Record<string, unknown> = {
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      cedula: form.cedula || null,
      telefono: form.telefono || '',
      rol: form.rol,
    };

    if (isSuperAdmin && form.empresa) {
      payload.empresa = Number(form.empresa);
    }

    if (!editing) {
      payload.password = form.password;
      payload.password_confirm = form.password_confirm;
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: editing.id, data: payload as Partial<Usuario> });
    }
  }

  // Roles disponibles según el rol del usuario actual
  const rolesDisponibles: RolOption[] = isSuperAdmin
    ? ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CONTADOR', 'VENDEDOR', 'CONSULTOR']
    : ['CONTADOR', 'VENDEDOR', 'CONSULTOR'];

  const filtered = usuarios.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.nombre_completo ?? `${u.first_name} ${u.last_name}`).toLowerCase().includes(q) ||
      (u.empresa_nombre ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isSuperAdmin
              ? 'Gestiona todos los usuarios del sistema. Crea administradores para cada empresa.'
              : 'Gestiona los usuarios de tu empresa.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow"
          >
            <UserPlus size={18} />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Rol architecture info for super admin */}
      {isSuperAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <ShieldCheck size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Flujo de onboarding de empresas</p>
            <p>1. Crea la empresa en <strong>Empresas</strong>. 2. Aquí crea un usuario con rol <strong>Admin Empresa</strong> asignado a esa empresa. 3. Entrega el email y contraseña al cliente. 4. El Admin Empresa puede crear sus propios Contadores, Vendedores y Consultores.</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o empresa..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">Cargando usuarios...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <UserCircle size={40} />
            <p>No hay usuarios{search ? ' que coincidan con la búsqueda' : ''}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Usuario</th>
                <th className="px-6 py-3 text-left">Rol</th>
                {isSuperAdmin && <th className="px-6 py-3 text-left">Empresa</th>}
                <th className="px-6 py-3 text-left">Estado</th>
                {isAdmin && <th className="px-6 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(u.first_name?.[0] ?? u.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.nombre_completo ?? `${u.first_name} ${u.last_name}`}</p>
                        <p className="text-gray-400 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROL_COLORS[u.rol] ?? 'bg-gray-100 text-gray-700'}`}>
                      {ROL_LABELS[u.rol] ?? u.rol}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-gray-400" />
                        {u.empresa_nombre ?? '—'}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium">
                        <CheckCircle size={12} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded-full text-xs font-medium">
                        <XCircle size={12} /> Inactivo
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setPwdModal(u); setNewPassword(''); setError(null); }}
                          className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Resetear contraseña"
                        >
                          <KeyRound size={15} />
                        </button>
                        {u.rol !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: u.id, active: !u.is_active })}
                            className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}
                            title={u.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {u.is_active ? <XCircle size={15} /> : <CheckCircle size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
                  <input
                    value={form.cedula}
                    onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as RolOption })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {rolesDisponibles.map((r) => (
                    <option key={r} value={r}>{ROL_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <select
                    value={form.empresa}
                    onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">— Sin empresa (solo SUPER_ADMIN) —</option>
                    {(empresas as Empresa[]).map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
                    ))}
                  </select>
                </div>
              )}

              {!editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={form.password_confirm}
                      onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Resetear Contraseña</h2>
              <button onClick={() => { setPwdModal(null); setNewPassword(''); setError(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Nueva contraseña para <strong>{pwdModal.email}</strong>
              </p>
              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{error}</div>
              )}
              <input
                type="password"
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setPwdModal(null); setNewPassword(''); setError(null); }} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  disabled={newPassword.length < 8 || resetPwdMutation.isPending}
                  onClick={() => resetPwdMutation.mutate({ id: pwdModal.id, password: newPassword })}
                  className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {resetPwdMutation.isPending ? 'Guardando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
