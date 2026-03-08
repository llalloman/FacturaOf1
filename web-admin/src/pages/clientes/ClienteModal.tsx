import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { clientesService } from '../../services/clientesService';
import type { Cliente } from '../../types';
import { X, Save } from 'lucide-react';

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Solo los 3 tipos que el usuario puede crear
const TIPOS = [
  {
    value: '05',
    label: 'Cédula',
    placeholder: '0912345678',
    maxLen: 10,
    labelNombre: 'Nombres y Apellidos',
    placeholderNombre: 'Juan Carlos Pérez López',
    esEmpresa: false,
  },
  {
    value: '04',
    label: 'RUC',
    placeholder: '0912345678001',
    maxLen: 13,
    labelNombre: 'Razón Social',
    placeholderNombre: 'Empresa S.A.',
    esEmpresa: true,
  },
  {
    value: '06',
    label: 'Pasaporte',
    placeholder: 'AB123456',
    maxLen: 20,
    labelNombre: 'Nombre Completo',
    placeholderNombre: 'John Michael Doe',
    esEmpresa: false,
  },
] as const;

type TipoValue = (typeof TIPOS)[number]['value'];

const getTipo = (val: string) => TIPOS.find((t) => t.value === val) ?? TIPOS[0];

const makeEmpty = () => ({
  tipo_identificacion: '05' as TipoValue,
  identificacion: '',
  razon_social: '',
  nombre_comercial: '',
  email: '',
  telefono: '',
  direccion: '',
  activo: true,
});

export default function ClienteModal({ cliente, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState(() =>
    cliente
      ? {
          tipo_identificacion: cliente.tipo_identificacion as TipoValue,
          identificacion: cliente.identificacion,
          razon_social: cliente.razon_social,
          nombre_comercial: cliente.nombre_comercial || '',
          email: cliente.email || '',
          telefono: cliente.telefono || '',
          direccion: cliente.direccion || '',
          activo: cliente.activo,
        }
      : makeEmpty()
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: ReturnType<typeof makeEmpty>) =>
      cliente ? clientesService.update(cliente.id, data) : clientesService.create(data),
    onSuccess,
    onError: (e: unknown) => {
      const err = e as { response?: { data?: Record<string, unknown> } };
      if (err.response?.data) {
        const msgs = Object.entries(err.response.data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ');
        setError(msgs);
      } else {
        setError('Error al guardar el cliente');
      }
    },
  });

  const handleTipoChange = (tipo: string) => {
    setFormData({ ...makeEmpty(), tipo_identificacion: tipo as TipoValue, activo: formData.activo });
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate(formData);
  };

  const tipo = getTipo(formData.tipo_identificacion);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/50 to-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-blue-100">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-slate-50">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
            {cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Tipo de identificación — 3 botones */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              Tipo de identificación *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTipoChange(t.value)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    formData.tipo_identificacion === t.value
                      ? 'border-blue-700 bg-blue-700 text-white shadow-md'
                      : 'border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Número de identificación */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              Número de {tipo.label} *
            </label>
            <input
              type="text"
              value={formData.identificacion}
              onChange={(e) => setFormData({ ...formData, identificacion: e.target.value })}
              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder={tipo.placeholder}
              maxLength={tipo.maxLen}
              required
            />
            {formData.tipo_identificacion === '04' && (
              <p className="text-xs text-gray-400 mt-1">13 dígitos (cédula + 001)</p>
            )}
            {formData.tipo_identificacion === '05' && (
              <p className="text-xs text-gray-400 mt-1">10 dígitos</p>
            )}
          </div>

          {/* Nombre o Razón Social — label cambia según tipo */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              {tipo.labelNombre} *
            </label>
            <input
              type="text"
              value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder={tipo.placeholderNombre}
              required
            />
          </div>

          {/* Nombre Comercial — solo para RUC */}
          {tipo.esEmpresa && (
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                Nombre Comercial
              </label>
              <input
                type="text"
                value={formData.nombre_comercial}
                onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Nombre comercial (opcional)"
              />
            </div>
          )}

          {/* Email y Teléfono */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="0999999999"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">Dirección</label>
            <textarea
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Dirección completa"
            />
          </div>

          {/* Estado */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="activo"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-5 h-5 rounded border-blue-300 text-blue-700 focus:ring-2 focus:ring-blue-600"
            />
            <label htmlFor="activo" className="text-sm font-semibold text-blue-900">
              Cliente Activo
            </label>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-blue-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-blue-300 rounded-xl hover:bg-blue-50 font-semibold transition-colors text-blue-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-3 rounded-xl hover:from-blue-800 hover:to-blue-950 disabled:opacity-50 font-semibold shadow-lg transition-all"
            >
              <Save size={20} />
              {mutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

