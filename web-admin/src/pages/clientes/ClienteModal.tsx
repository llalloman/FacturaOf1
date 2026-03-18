import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { clientesService } from '../../services/clientesService';
import { clienteSchema, type ClienteFormData } from '../../schemas/formSchemas';
import type { Cliente } from '../../types';
import { X, Save } from 'lucide-react';

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TIPOS = [
  {
    value: '05' as const,
    label: 'Cédula',
    placeholder: '0912345678',
    maxLen: 10,
    labelNombre: 'Nombres y Apellidos',
    placeholderNombre: 'Juan Carlos Pérez López',
    esEmpresa: false,
  },
  {
    value: '04' as const,
    label: 'RUC',
    placeholder: '0912345678001',
    maxLen: 13,
    labelNombre: 'Razón Social',
    placeholderNombre: 'Empresa S.A.',
    esEmpresa: true,
  },
  {
    value: '06' as const,
    label: 'Pasaporte',
    placeholder: 'AB123456',
    maxLen: 20,
    labelNombre: 'Nombre Completo',
    placeholderNombre: 'John Michael Doe',
    esEmpresa: false,
  },
];

type TipoValue = (typeof TIPOS)[number]['value'];
const getTipo = (val: string) => TIPOS.find((t) => t.value === val) ?? TIPOS[0];

export default function ClienteModal({ cliente, onClose, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: cliente
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
      : {
          tipo_identificacion: '05',
          identificacion: '',
          razon_social: '',
          nombre_comercial: '',
          email: '',
          telefono: '',
          direccion: '',
          activo: true,
        },
  });

  const tipoValue = watch('tipo_identificacion');
  const tipo = getTipo(tipoValue);

  const mutation = useMutation({
    mutationFn: (data: ClienteFormData) =>
      cliente ? clientesService.update(cliente.id, data) : clientesService.create(data),
    onSuccess,
  });

  // When tipo changes, reset identification fields
  const handleTipoChange = (newTipo: TipoValue) => {
    reset({
      tipo_identificacion: newTipo,
      identificacion: '',
      razon_social: '',
      nombre_comercial: '',
      email: '',
      telefono: '',
      direccion: '',
      activo: watch('activo'),
    });
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onSubmit = (data: ClienteFormData) => mutation.mutate(data);

  const fieldError = (name: keyof ClienteFormData) =>
    errors[name] ? (
      <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>
    ) : null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/50 to-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-blue-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-slate-50">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
            {cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" noValidate>
          {/* Server error */}
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {(() => {
                const err = mutation.error as { response?: { data?: Record<string, unknown> } };
                if (err?.response?.data) {
                  return Object.entries(err.response.data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
                }
                return 'Error al guardar el cliente';
              })()}
            </div>
          )}

          {/* Tipo de identificación — 3 buttons */}
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
                    tipoValue === t.value
                      ? 'border-blue-700 bg-blue-700 text-white shadow-md'
                      : 'border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {fieldError('tipo_identificacion')}
          </div>

          {/* Número de identificación */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              Número de {tipo.label} *
            </label>
            <input
              {...register('identificacion')}
              type="text"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
                errors.identificacion ? 'border-red-400' : 'border-blue-200'
              }`}
              placeholder={tipo.placeholder}
              maxLength={tipo.maxLen}
            />
            {fieldError('identificacion')}
            {tipoValue === '04' && !errors.identificacion && (
              <p className="text-xs text-gray-400 mt-1">13 dígitos (cédula + 001)</p>
            )}
            {tipoValue === '05' && !errors.identificacion && (
              <p className="text-xs text-gray-400 mt-1">10 dígitos</p>
            )}
          </div>

          {/* Razón Social / Nombre */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              {tipo.labelNombre} *
            </label>
            <input
              {...register('razon_social')}
              type="text"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
                errors.razon_social ? 'border-red-400' : 'border-blue-200'
              }`}
              placeholder={tipo.placeholderNombre}
            />
            {fieldError('razon_social')}
          </div>

          {/* Nombre Comercial — solo RUC */}
          {tipo.esEmpresa && (
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                Nombre Comercial
              </label>
              <input
                {...register('nombre_comercial')}
                type="text"
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
                {...register('email')}
                type="email"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
                  errors.email ? 'border-red-400' : 'border-blue-200'
                }`}
                placeholder="correo@ejemplo.com"
              />
              {fieldError('email')}
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">Teléfono</label>
              <input
                {...register('telefono')}
                type="tel"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
                  errors.telefono ? 'border-red-400' : 'border-blue-200'
                }`}
                placeholder="0999999999"
              />
              {fieldError('telefono')}
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-2">Dirección</label>
            <textarea
              {...register('direccion')}
              rows={2}
              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Dirección completa"
            />
          </div>

          {/* Estado */}
          <div className="flex items-center gap-3">
            <input
              {...register('activo')}
              type="checkbox"
              id="activo"
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
              disabled={isSubmitting || mutation.isPending}
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

