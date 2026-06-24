import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { confirmDialog } from '../../store/confirmStore';
import { empresasService } from '../../services/empresasService';
import { usuariosService } from '../../services/usuariosService';
import { cajasService } from '../../services/cajasService';
import { bodegasService } from '../../services/bodegasService';
import { secuencialesService } from '../../services/secuencialesService';
import { getCuentas } from '../../services/bancosService';
import { productosService } from '../../services/productosService';
import { pagosService, defaultPagoConfiguracion, type PagoConfiguracion } from '../../services/pagosService';
import type { Empresa, Usuario, Caja, Bodega, Secuencial } from '../../types';
import {
  Building2,
  Users,
  Monitor,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Hash,
  Lock,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';

type Tab = 'empresa' | 'usuarios' | 'cajas' | 'facturacion' | 'pagos';

// ─── Tab Empresa ───────────────────────────────────────────────────────────────
function EmpresaTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.rol === 'SUPER_ADMIN';

  // SUPER_ADMIN usa getAll (puede haber varias), ADMIN_EMPRESA usa mi_empresa
  const { data: empresaData, isLoading } = useQuery({
    queryKey: ['mi-empresa'],
    enabled: !!user,
    queryFn: async () => {
      if (isSuperAdmin) {
        const all = await empresasService.getAll();
        return Array.isArray(all) ? all[0] : all;
      }
      return empresasService.getMiEmpresa();
    },
  });

  const empresa: Partial<Empresa> = empresaData ?? {};
  const [form, setForm] = useState<Partial<Empresa>>({});
  const [saved, setSaved] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Get current value: form overrides empresa
  const v = (key: keyof Empresa) =>
    (form as Record<string, unknown>)[key as string] !== undefined
      ? (form as Record<string, unknown>)[key as string]
      : (empresa as Record<string, unknown>)[key as string] ?? '';
  const vb = (key: keyof Empresa): boolean =>
    (form as Record<string, unknown>)[key as string] !== undefined
      ? Boolean((form as Record<string, unknown>)[key as string])
      : Boolean((empresa as Record<string, unknown>)[key as string]);
  const set = (key: keyof Empresa, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateMutation = useMutation({
    mutationFn: () => {
      const merged = { ...empresa, ...form };
      const payload: Record<string, unknown> = {};
      Object.entries(merged).forEach(([k, val]) => {
        // Skip file URL strings — files handled separately below
        if (k !== 'logo' && k !== 'certificado_digital' && val !== undefined) {
          payload[k] = val;
        }
      });
      if (certFile) payload.certificado_digital = certFile;
      if (logoFile) payload.logo = logoFile;
      return empresasService.update(empresa.id!, payload as Parameters<typeof empresasService.update>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-empresa'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );

  if (!empresa.id) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium">No hay empresa configurada</p>
        <p className="text-sm mt-1">Crea una empresa desde el módulo Empresas</p>
      </div>
    );
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="max-w-3xl space-y-5">
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 rounded-lg p-4">
          <CheckCircle size={20} />
          <span className="font-medium">Configuración guardada correctamente</span>
        </div>
      )}
      {updateMutation.isError && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">
          <XCircle size={20} />
          <span className="font-medium">Error al guardar. Revisa los datos e intenta nuevamente.</span>
        </div>
      )}

      {/* ── 1. Datos de la Empresa ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Building2 size={18} className="text-blue-600" /> Datos de la Empresa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RUC *</label>
            <input type="text" value={String(v('ruc'))} onChange={(e) => set('ruc', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input type="text" value={String(v('ciudad'))} onChange={(e) => set('ciudad', e.target.value)} placeholder="Ej: Quito" className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
            <input type="text" value={String(v('razon_social'))} onChange={(e) => set('razon_social', e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
            <input type="text" value={String(v('nombre_comercial'))} onChange={(e) => set('nombre_comercial', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="text" value={String(v('telefono'))} onChange={(e) => set('telefono', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={String(v('email'))} onChange={(e) => set('email', e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Matriz</label>
            <textarea rows={2} value={String(v('direccion_matriz'))} onChange={(e) => set('direccion_matriz', e.target.value)} className={inp} />
          </div>
        </div>
      </div>

      {/* ── 2. Tipo de Contribuyente ───────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">🏷️ Tipo de Contribuyente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: 'obligado_contabilidad' as const, label: 'Obligado a llevar contabilidad' },
            { key: 'gran_contribuyente' as const, label: 'Gran Contribuyente' },
            { key: 'agente_retencion' as const, label: 'Agente de Retención' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={vb(key)}
                onChange={(e) => set(key, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nro. Contribuyente Especial</label>
            <input
              type="text"
              value={String(v('contribuyente_especial'))}
              onChange={(e) => set('contribuyente_especial', e.target.value)}
              placeholder="Dejar vacío si no aplica"
              className={inp}
            />
          </div>
          {/* RIMPE */}
          <div className="col-span-2 border border-gray-200 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={vb('regimen_rimpe')} onChange={(e) => set('regimen_rimpe', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Contribuyente Régimen RIMPE</span>
            </label>
            {vb('regimen_rimpe') && (
              <div className="ml-7">
                <select value={String(v('tipo_rimpe'))} onChange={(e) => set('tipo_rimpe', e.target.value)} className={inp}>
                  <option value="RIMPE_EMPRENDEDOR">Contribuyente Régimen RIMPE</option>
                  <option value="RIMPE_POPULAR">Negocio Popular Régimen RIMPE</option>
                </select>
              </div>
            )}
          </div>
          {/* Exportador */}
          <div className="col-span-2 border border-gray-200 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={vb('exportador')} onChange={(e) => set('exportador', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Exportador</span>
            </label>
            {vb('exportador') && (
              <div className="ml-7 flex gap-6">
                {(['HABITUAL', 'NO_HABITUAL'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipo_exportador" value={t} checked={v('tipo_exportador') === t} onChange={() => set('tipo_exportador', t)} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">{t === 'HABITUAL' ? 'Habitual' : 'No habitual'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Firma Digital ───────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          🔐 Firma Digital (Certificado .p12)
        </h3>
        <p className="text-xs text-gray-600">
          Archivo proporcionado por el SRI o entidad certificadora autorizada (Security Data, ANF Ecuador, BCE).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo .p12 / .pfx</label>
            <input type="file" accept=".p12,.pfx" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} className={`${inp} bg-white`} />
            {empresa.certificado_digital && !certFile && (
              <p className="text-xs text-green-600 mt-1">✓ Cargado: {String(empresa.certificado_digital).split('/').pop()}</p>
            )}
            {certFile && <p className="text-xs text-blue-600 mt-1">📎 Nuevo archivo: {certFile.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña del certificado</label>
            <input
              type="password"
              value={String(v('password_certificado'))}
              onChange={(e) => set('password_certificado', e.target.value)}
              placeholder="Contraseña del .p12"
              className={inp}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={String(v('fecha_vencimiento_certificado'))}
              onChange={(e) => set('fecha_vencimiento_certificado', e.target.value)}
              className={inp}
            />
          </div>
          <label className="flex items-center gap-3 p-3 border border-blue-200 bg-white rounded-lg cursor-pointer self-end">
            <input type="checkbox" checked={vb('firmado_automatico')} onChange={(e) => set('firmado_automatico', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <div>
              <span className="text-sm font-medium text-gray-700 block">Firmado Automático</span>
              <span className="text-xs text-gray-400">Firma los comprobantes sin intervención manual</span>
            </div>
          </label>
        </div>
      </div>

      {/* ── 4. Configuración de Facturación ───────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">🧾 Configuración de Facturación Electrónica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente SRI</label>
            <select value={String(v('ambiente'))} onChange={(e) => set('ambiente', e.target.value as '1' | '2')} className={inp}>
              <option value="1">Pruebas</option>
              <option value="2">Producción</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Establecimiento por defecto</label>
            <input type="text" value={String(v('establecimiento_codigo'))} onChange={(e) => set('establecimiento_codigo', e.target.value)} placeholder="001" className={inp} />
            <p className="text-xs text-gray-400 mt-1">Formato válido: 001, 002, 003…</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Punto de Emisión por defecto</label>
            <input type="text" value={String(v('punto_emision_codigo'))} onChange={(e) => set('punto_emision_codigo', e.target.value)} placeholder="001" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo de la Empresa</label>
            <p className="text-xs text-gray-400 mb-1">Ancho y alto máximo: 500×300 px. Formatos: jpg, png, gif, bmp.</p>
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/bmp" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className={`${inp} bg-white`} />
            {empresa.logo && !logoFile && <p className="text-xs text-green-600 mt-1">✓ Logo cargado</p>}
            {logoFile && <p className="text-xs text-blue-600 mt-1">📎 Nuevo logo: {logoFile.name}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje Personalizado</label>
            <p className="text-xs text-gray-400 mb-1">Se mostrará en la parte inferior del RIDE (representación impresa del comprobante).</p>
            <textarea
              rows={2}
              value={String(v('mensaje_personalizado'))}
              onChange={(e) => set('mensaje_personalizado', e.target.value)}
              placeholder="Ej: Gracias por su compra. Este documento es válido como comprobante de pago."
              className={inp}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        <Save size={18} />
        {updateMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  );
}

// ─── Tab Usuarios ──────────────────────────────────────────────────────────────
function UsuariosTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '' });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: usuariosService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setShowForm(false);
      setForm({ email: '', first_name: '', last_name: '', password: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usuariosService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const usuariosArray = Array.isArray(usuarios) ? usuarios : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{usuariosArray.length} usuarios registrados</p>
        <button
          onClick={() => { setShowForm(true); setEditUser(null); setForm({ email: '', first_name: '', last_name: '', password: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">{editUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
              <input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admin</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuariosArray.map((u: Usuario) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle size={12} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle size={12} /> Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {u.is_staff ? '✓' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => { if (await confirmDialog('¿Eliminar usuario?', undefined, 'danger')) deleteMutation.mutate(u.id); }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab Cajas ─────────────────────────────────────────────────────────────────
function CajasTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '', bodega: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: cajas = [], isLoading } = useQuery({
    queryKey: ['cajas'],
    queryFn: cajasService.getAll,
  });

  const { data: bodegas = [] } = useQuery({
    queryKey: ['bodegas'],
    queryFn: bodegasService.getAll,
  });

  const cajasArray = Array.isArray(cajas) ? cajas : [];
  const bodegasArray = Array.isArray(bodegas) ? bodegas : [];

  const createMutation = useMutation({
    mutationFn: cajasService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      setShowForm(false);
      setForm({ codigo: '', nombre: '', descripcion: '', bodega: '' });
      setError(null);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: Record<string, unknown> } };
      if (err.response?.data) {
        const msgs = Object.entries(err.response.data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ');
        setError(msgs);
      } else {
        setError('Error al guardar la caja');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: cajasService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cajas'] }),
  });

  const handleGuardar = () => {
    if (!form.codigo || !form.nombre || !form.bodega) {
      setError('Código, nombre y bodega son obligatorios');
      return;
    }
    setError(null);
    createMutation.mutate({ ...form, bodega: Number(form.bodega) } as Partial<Caja>);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{cajasArray.length} cajas registradas</p>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nueva Caja
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">Nueva Caja Registradora</h3>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
              <input type="text" placeholder="Ej: CAJA01" value={form.codigo}
                onChange={(e) => setForm(p => ({ ...p, codigo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input type="text" placeholder="Ej: Caja Principal" value={form.nombre}
                onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Bodega *</label>
              {bodegasArray.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Debes crear primero una bodega en el módulo de Inventarios
                </p>
              ) : (
                <select value={form.bodega}
                  onChange={(e) => setForm(p => ({ ...p, bodega: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">— Selecciona una bodega —</option>
                  {bodegasArray.map((b: Bodega) => (
                    <option key={b.id} value={b.id}>{b.codigo} — {b.nombre}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <input type="text" placeholder="Descripción opcional" value={form.descripcion}
                onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowForm(false); setError(null); }}
              className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleGuardar} disabled={createMutation.isPending}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : cajasArray.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Monitor size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No hay cajas registradas</p>
          <p className="text-sm mt-1">Las cajas se crean desde el backend o el admin Django</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cajasArray.map((c: Caja) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-blue-600">{c.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-center">
                    {c.activa ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle size={12} /> Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <XCircle size={12} /> Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => { if (await confirmDialog('¿Eliminar caja?', undefined, 'danger')) deleteMutation.mutate(c.id); }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab Facturación ──────────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  '01': 'Factura',
  '04': 'Nota de Crédito',
  '05': 'Nota de Débito',
  '06': 'Guía de Remisión',
  '07': 'Comp. Retención',
};

function FacturacionTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.rol === 'SUPER_ADMIN';

  const { data: secuenciales = [], isLoading } = useQuery({
    queryKey: ['secuenciales-mi-empresa'],
    queryFn: () => secuencialesService.getAll(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saved, setSaved] = useState<number | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);

  const patchMutation = useMutation({
    mutationFn: ({ id, val }: { id: number; val: number }) =>
      secuencialesService.patch(id, { secuencial_actual: val }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['secuenciales-mi-empresa'] });
      setEditingId(null);
      setSaved(id);
      setPatchError(null);
      setTimeout(() => setSaved(null), 3000);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string; secuencial_actual?: string[] } } };
      const msg = err.response?.data?.detail ||
        err.response?.data?.secuencial_actual?.[0] ||
        'Error al guardar';
      setPatchError(msg);
    },
  });

  const inicializarMutation = useMutation({
    mutationFn: () => secuencialesService.inicializar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secuenciales-mi-empresa'] });
    },
  });

  const handleEdit = (s: Secuencial) => {
    setEditingId(s.id);
    setEditValue(String(s.secuencial_actual));
    setPatchError(null);
  };

  const handleSave = (id: number) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) {
      setPatchError('Ingresa un número válido mayor o igual a 0');
      return;
    }
    patchMutation.mutate({ id, val });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <strong>Secuencial inicial:</strong> configura aquí el número desde el cual comenzarán
          los comprobantes. Una vez guardado queda bloqueado para evitar duplicados con el SRI.
          {!isSuperAdmin && ' Para corregirlo contacta al administrador del sistema.'}
        </div>
      </div>

      {secuenciales.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Hash size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">Aún no hay secuenciales configurados</p>
          <p className="text-sm mt-1 mb-4">Inicializa los secuenciales para poder emitir comprobantes</p>
          <button
            onClick={() => inicializarMutation.mutate()}
            disabled={inicializarMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {inicializarMutation.isPending ? 'Inicializando...' : 'Inicializar secuenciales'}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estab.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pto. Emis.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Secuencial actual</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {secuenciales.map((s: Secuencial) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {s.tipo_comprobante_display || TIPO_LABELS[s.tipo_comprobante] || s.tipo_comprobante}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{s.establecimiento}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{s.punto_emision}</td>
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={isSuperAdmin ? 0 : s.secuencial_actual}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-32 px-2 py-1 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        {patchError && (
                          <span className="text-xs text-red-600">{patchError}</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono font-semibold text-blue-700">
                        {String(s.secuencial_actual).padStart(9, '0')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.configurado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <Lock size={11} /> Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === s.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSave(s.id)}
                          disabled={patchMutation.isPending}
                          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                        >
                          {patchMutation.isPending ? '...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setPatchError(null); }}
                          className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      // Allow editing if: not configured yet OR SUPER_ADMIN
                      (!s.configurado || isSuperAdmin) && (
                        <button
                          onClick={() => handleEdit(s)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {s.configurado && isSuperAdmin ? '⚡ Forzar' : 'Configurar'}
                        </button>
                      )
                    )}
                    {saved === s.id && (
                      <span className="text-xs text-green-600 ml-2">✓ Guardado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}



// ─── Tab Pagos Online ────────────────────────────────────────────────────────
function PagosTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.rol === 'SUPER_ADMIN';
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [form, setForm] = useState<PagoConfiguracion>(defaultPagoConfiguracion);
  const [saved, setSaved] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-pagos-config'],
    queryFn: empresasService.getAll,
    enabled: isSuperAdmin,
  });
  const effectiveEmpresa = isSuperAdmin ? selectedEmpresaId : undefined;
  const { data: config, isLoading } = useQuery({
    queryKey: ['pagos-configuracion', effectiveEmpresa],
    queryFn: () => pagosService.getConfiguracion(effectiveEmpresa),
    enabled: !isSuperAdmin || !!effectiveEmpresa,
  });
  const { data: cuentas = [] } = useQuery({ queryKey: ['cuentas-pagos-config'], queryFn: getCuentas });
  const { data: cajas = [] } = useQuery({ queryKey: ['cajas-pagos-config'], queryFn: cajasService.getAll });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios-pagos-config'], queryFn: usuariosService.getAll });
  const { data: productos = [] } = useQuery({
    queryKey: ['productos-servicio-pagos-config'],
    queryFn: () => productosService.getAll({ include_inactive: true, page_size: 500 }),
  });

  useEffect(() => {
    if (config) {
      setForm({ ...defaultPagoConfiguracion, ...config });
      return;
    }
    setForm({ ...defaultPagoConfiguracion, empresa: effectiveEmpresa ? Number(effectiveEmpresa) : undefined });
  }, [config, effectiveEmpresa]);

  const servicios = productos.filter((producto) => producto.tipo === 'SERVICIO');
  const set = (field: keyof PagoConfiguracion, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: () => pagosService.saveConfiguracion(form),
    onSuccess: (data) => {
      setForm({ ...defaultPagoConfiguracion, ...data });
      queryClient.invalidateQueries({ queryKey: ['pagos-configuracion'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500';

  if (isSuperAdmin && !selectedEmpresaId) {
    return (
      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-800"><CreditCard size={18} className="text-blue-600" /> Configuración de pagos por empresa</h3>
        <label className="text-sm font-medium text-gray-700">Empresa
          <select value={selectedEmpresaId} onChange={(e) => setSelectedEmpresaId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            <option value="">Selecciona una empresa</option>
            {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.razon_social} - {empresa.ruc}</option>)}
          </select>
        </label>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>;

  return (
    <div className="max-w-4xl space-y-5">
      {isSuperAdmin && (
        <label className="block max-w-md text-sm font-medium text-gray-700">Empresa
          <select value={selectedEmpresaId} onChange={(e) => setSelectedEmpresaId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.razon_social} - {empresa.ruc}</option>)}
          </select>
        </label>
      )}
      {saved && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700"><CheckCircle size={20} /><span className="font-medium">Configuración de pagos guardada</span></div>}
      {saveMutation.isError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><XCircle size={20} /><span className="font-medium">No se pudo guardar la configuración</span></div>}

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="flex items-center gap-2 font-semibold text-gray-800"><CreditCard size={18} className="text-blue-600" /> Aplicación automática de pagos</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Cuenta PayPhone
            <select value={form.cuenta_payphone ?? ''} onChange={(e) => set('cuenta_payphone', e.target.value ? Number(e.target.value) : null)} className={`${selectClass} mt-1`}>
              <option value="">Selecciona cuenta destino</option>
              {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} - {cuenta.numero_cuenta}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Caja ventas online
            <select value={form.caja_ventas ?? ''} onChange={(e) => set('caja_ventas', e.target.value ? Number(e.target.value) : null)} className={`${selectClass} mt-1`}>
              <option value="">Selecciona caja</option>
              {cajas.map((caja) => <option key={caja.id} value={caja.id}>{caja.codigo} - {caja.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Usuario ventas online
            <select value={form.usuario_ventas ?? ''} onChange={(e) => set('usuario_ventas', e.target.value ? Number(e.target.value) : null)} className={`${selectClass} mt-1`}>
              <option value="">Selecciona usuario</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre_completo || `${usuario.first_name} ${usuario.last_name}`.trim() || usuario.email}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Producto firma electrónica
            <select value={form.producto_firma ?? ''} onChange={(e) => set('producto_firma', e.target.value ? Number(e.target.value) : null)} className={`${selectClass} mt-1`}>
              <option value="">Auto/Firma electrónica</option>
              {servicios.map((producto) => <option key={producto.id} value={producto.id}>{producto.codigo_principal} - {producto.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Producto recargo PayPhone
            <select value={form.producto_recargo_payphone ?? ''} onChange={(e) => set('producto_recargo_payphone', e.target.value ? Number(e.target.value) : null)} className={`${selectClass} mt-1`}>
              <option value="">Auto/Recargo PayPhone</option>
              {servicios.map((producto) => <option key={producto.id} value={producto.id}>{producto.codigo_principal} - {producto.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Producto suscripción ERP
            <select value={form.producto_suscripcion ?? ''} onChange={(e) => set('producto_suscripcion', e.target.value ? Number(e.target.value) : null)} className={`${selectClass} mt-1`}>
              <option value="">Selecciona producto</option>
              {servicios.map((producto) => <option key={producto.id} value={producto.id}>{producto.codigo_principal} - {producto.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">% recargo tarjeta
            <input value={form.fee_percent} onChange={(e) => set('fee_percent', e.target.value)} className={`${selectClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-gray-700">IVA sobre recargo
            <input value={form.fee_tax_rate} onChange={(e) => set('fee_tax_rate', e.target.value)} className={`${selectClass} mt-1`} />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700"><input type="checkbox" checked={form.auto_generar_venta_firmas} onChange={(e) => set('auto_generar_venta_firmas', e.target.checked)} className="h-4 w-4 rounded text-blue-600" /> Generar venta por firmas</label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700"><input type="checkbox" checked={form.auto_generar_venta_suscripciones} onChange={(e) => set('auto_generar_venta_suscripciones', e.target.checked)} className="h-4 w-4 rounded text-blue-600" /> Generar venta por suscripciones</label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700"><input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} className="h-4 w-4 rounded text-blue-600" /> Configuración activa</label>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Para que un pago aprobado cree venta y movimiento bancario, deben estar configurados cuenta, caja y usuario. Los productos de firma y recargo pueden seleccionarse aquí o se crearán automáticamente como servicios si no existen.
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          <Save size={16} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración de pagos'}
        </button>
      </div>
    </div>
  );
}

// ─── Configuración Page ────────────────────────────────────────────────────────
const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'cajas', label: 'Cajas', icon: Monitor },
  { key: 'facturacion', label: 'Facturación', icon: Hash },
  { key: 'pagos', label: 'Pagos', icon: CreditCard },
];

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('empresa');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
          Configuración
        </h1>
        <p className="text-gray-600 mt-1">Gestiona tu empresa, usuarios y cajas registradoras</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'empresa' && <EmpresaTab />}
          {activeTab === 'usuarios' && <UsuariosTab />}
          {activeTab === 'cajas' && <CajasTab />}
          {activeTab === 'facturacion' && <FacturacionTab />}
          {activeTab === 'pagos' && <PagosTab />}
        </div>
      </div>
    </div>
  );
}
