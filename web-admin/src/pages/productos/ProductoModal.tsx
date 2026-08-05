import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';
import type { Producto } from '../../types';
import { X, Save, Upload } from 'lucide-react';

interface Props {
  producto: Producto | null;
  onClose: () => void;
  onSuccess: () => void;
}

const makeEmpty = () => ({
  codigo_principal: '',
  codigo_auxiliar: '',
  tipo: 'BIEN' as 'BIEN' | 'SERVICIO',
  nombre: '',
  descripcion: '',
  modo_precio: 'SIN_IVA' as 'SIN_IVA' | 'CON_IVA',
  precio: '',
  precio_con_iva_input: '',
  costo: '',
  aplica_iva: true,
  porcentaje_iva: '4', // 15%
  maneja_inventario: false,
  stock_actual: '',
  stock_minimo: '',
  controla_caducidad: false,
  exige_lote: false,
  dias_alerta_caducidad: '30',
  vida_util_dias: '',
  activo: true,
});

export default function ProductoModal({ producto, onClose, onSuccess }: Readonly<Props>) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(producto?.imagen ?? null);
  const precioConIvaInicial = producto?.precio_con_iva ?? 0;
  const [formData, setFormData] = useState(() =>
    producto
      ? {
          codigo_principal: producto.codigo_principal ?? '',
          codigo_auxiliar: producto.codigo_auxiliar ?? '',
          tipo: (producto.tipo ?? 'BIEN') as 'BIEN' | 'SERVICIO',
          nombre: producto.nombre ?? '',
          descripcion: producto.descripcion ?? '',
          modo_precio: 'SIN_IVA' as 'SIN_IVA' | 'CON_IVA',
          precio: String(Number(producto.precio) || 0),
          precio_con_iva_input: String(Number(precioConIvaInicial) || 0),
          costo: String(Number(producto.costo) || 0),
          aplica_iva: producto.aplica_iva ?? true,
          porcentaje_iva: producto.porcentaje_iva ?? '4',
          maneja_inventario: producto.maneja_inventario ?? true,
          stock_actual: String(Number(producto.stock_actual) || 0),
          stock_minimo: String(Number(producto.stock_minimo) || 0),
          controla_caducidad: producto.controla_caducidad ?? false,
          exige_lote: producto.exige_lote ?? false,
          dias_alerta_caducidad: String(Number(producto.dias_alerta_caducidad ?? 30) || 30),
          vida_util_dias: producto.vida_util_dias == null ? '' : String(Number(producto.vida_util_dias) || ''),
          activo: producto.activo ?? true,
        }
      : makeEmpty()
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: FormData | Record<string, unknown>) => {
      const isForm = payload instanceof FormData;
      const cfg = isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
      const url = producto
        ? `/productos/productos/${producto.id}/`
        : '/productos/productos/';
      const { data } = producto
        ? await apiClient.patch(url, payload, cfg)
        : await apiClient.post(url, payload, cfg);
      return data;
    },
    onSuccess,
    onError: (e: unknown) => {
      const err = e as { response?: { data?: Record<string, unknown> } };
      if (err.response?.data) {
        const msgs = Object.entries(err.response.data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ');
        setError(msgs);
      } else {
        setError('Error al guardar el producto');
      }
    },
  });

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const parsed = {
      ...formData,
      precio: Number.parseFloat(formData.precio) || 0,
      precio_con_iva_input: Number.parseFloat(formData.precio_con_iva_input) || 0,
      costo: Number.parseFloat(formData.costo) || 0,
      maneja_inventario: formData.tipo === 'BIEN' ? formData.maneja_inventario : false,
      stock_actual: formData.tipo === 'BIEN' && formData.maneja_inventario ? Number.parseFloat(formData.stock_actual) || 0 : 0,
      stock_minimo: formData.tipo === 'BIEN' && formData.maneja_inventario ? Number.parseFloat(formData.stock_minimo) || 0 : 0,
      controla_caducidad:
        formData.tipo === 'BIEN' && formData.maneja_inventario ? Boolean(formData.controla_caducidad) : false,
      exige_lote:
        formData.tipo === 'BIEN' && formData.maneja_inventario && formData.controla_caducidad
          ? Boolean(formData.exige_lote)
          : false,
      dias_alerta_caducidad:
        formData.tipo === 'BIEN' && formData.maneja_inventario && formData.controla_caducidad
          ? Math.max(1, Number.parseInt(formData.dias_alerta_caducidad || '30', 10) || 30)
          : 30,
      vida_util_dias:
        formData.tipo === 'BIEN' && formData.maneja_inventario && formData.controla_caducidad && formData.vida_util_dias !== ''
          ? Math.max(1, Number.parseInt(formData.vida_util_dias || '0', 10) || 0)
          : null,
    };
    if (imageFile) {
      const fd = new FormData();
      Object.entries(parsed).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append('imagen', imageFile);
      mutation.mutate(fd);
    } else {
      mutation.mutate(parsed);
    }
  };

  const set = (field: string, value: unknown) =>
    setFormData((prev) => {
      if (field === 'tipo' && value === 'SERVICIO') {
        return {
          ...prev,
          tipo: value as 'SERVICIO',
          maneja_inventario: false,
          stock_actual: '0',
          stock_minimo: '0',
          controla_caducidad: false,
          exige_lote: false,
          dias_alerta_caducidad: '30',
          vida_util_dias: '',
        };
      }
      if (field === 'maneja_inventario' && value === false) {
        return {
          ...prev,
          maneja_inventario: false,
          stock_actual: '0',
          stock_minimo: '0',
          controla_caducidad: false,
          exige_lote: false,
          dias_alerta_caducidad: '30',
          vida_util_dias: '',
        };
      }
      if (field === 'controla_caducidad' && value === false) {
        return {
          ...prev,
          controla_caducidad: false,
          exige_lote: false,
          dias_alerta_caducidad: '30',
          vida_util_dias: '',
        };
      }
      return { ...prev, [field]: value };
    });

  const IVA_PCT: Record<string, number> = { '0': 0, '2': 12, '3': 14, '4': 15, '6': 0, '7': 0 };
  const ivaRate = formData.aplica_iva ? (IVA_PCT[formData.porcentaje_iva] ?? 0) : 0;
  const precioNeto = Number.parseFloat(formData.precio) || 0;
  const precioFinal = Number.parseFloat(formData.precio_con_iva_input) || 0;
  const previewPrecioConIva = ivaRate > 0 ? precioNeto * (1 + ivaRate / 100) : precioNeto;
  const previewPrecioNeto = ivaRate > 0 ? precioFinal / (1 + ivaRate / 100) : precioFinal;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/50 via-blue-900/50 to-sky-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-blue-100">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-blue-50 to-sky-50">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-600 to-sky-600 bg-clip-text text-transparent">
            {producto ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Imagen */}
          <div>
            <p className="block text-sm font-semibold text-blue-900 mb-2">Imagen del producto</p>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl border-2 border-blue-200 bg-blue-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  : <Upload size={28} className="text-blue-300" />}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm text-blue-600 font-medium">
                  <Upload size={16} />
                  {imageFile ? imageFile.name : 'Seleccionar imagen'}
                  <input
                    id="imagen_producto"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setImageFile(f);
                        setImagePreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="mt-1.5 text-xs text-red-500 hover:underline"
                  >
                    Quitar imagen
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-1">JPG, PNG o WebP · Máx 2 MB</p>
              </div>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <p className="block text-sm font-semibold text-blue-900 mb-2">Tipo *</p>
            <div className="grid grid-cols-2 gap-3">
              {(['BIEN', 'SERVICIO'] as const).map((t) => (
                <button key={t} type="button" onClick={() => set('tipo', t)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    formData.tipo === t
                      ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                      : 'border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                  {t === 'BIEN' ? 'Bien / Producto' : 'Servicio'}
                </button>
              ))}
            </div>
          </div>

          {/* Códigos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="codigo_principal" className="block text-sm font-semibold text-blue-900 mb-2">Código Principal *</label>
              <input id="codigo_principal" type="text" value={formData.codigo_principal}
                onChange={(e) => set('codigo_principal', e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="P001" required />
            </div>
            <div>
              <label htmlFor="codigo_auxiliar" className="block text-sm font-semibold text-blue-900 mb-2">Código Auxiliar</label>
              <input id="codigo_auxiliar" type="text" value={formData.codigo_auxiliar}
                onChange={(e) => set('codigo_auxiliar', e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Código de barra (opcional)" />
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label htmlFor="nombre_producto" className="block text-sm font-semibold text-blue-900 mb-2">Nombre *</label>
            <input id="nombre_producto" type="text" value={formData.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nombre del producto o servicio" required />
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="descripcion_producto" className="block text-sm font-semibold text-blue-900 mb-2">Descripción</label>
            <textarea id="descripcion_producto" value={formData.descripcion} rows={2}
              onChange={(e) => set('descripcion', e.target.value)}
              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descripción opcional" />
          </div>

          {/* Precio y Costo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="block text-sm font-semibold text-blue-900 mb-2">Modo de precio *</p>
              <div className="grid grid-cols-2 gap-2">
                {(['SIN_IVA', 'CON_IVA'] as const).map((modo) => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => set('modo_precio', modo)}
                    className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      formData.modo_precio === modo
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    {modo === 'SIN_IVA' ? 'Ingresar neto' : 'Ingresar final c/IVA'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Usa "final c/IVA" si quieres respetar exactamente el valor de cartilla.
              </p>
            </div>
            <div>
              <label htmlFor={formData.modo_precio === 'CON_IVA' ? 'precio_con_iva_input' : 'precio_neto'} className="block text-sm font-semibold text-blue-900 mb-2">
                {formData.modo_precio === 'CON_IVA' ? 'Precio Final con IVA *' : 'Precio Neto sin IVA *'}
              </label>
              {formData.modo_precio === 'CON_IVA' ? (
                <>
                  <input id="precio_con_iva_input" type="number" step="0.01" min="0"
                    value={formData.precio_con_iva_input}
                    onChange={(e) => set('precio_con_iva_input', e.target.value)}
                    className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required />
                  <p className="mt-1.5 text-xs text-blue-600 font-semibold">
                    Neto calculado: <span className="text-blue-800">${previewPrecioNeto.toFixed(4)}</span>
                  </p>
                </>
              ) : (
                <>
                  <input id="precio_neto" type="number" step="0.0001" min="0"
                    value={formData.precio}
                    onChange={(e) => set('precio', e.target.value)}
                    className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required />
                  <p className="mt-1.5 text-xs text-blue-600 font-semibold">
                    Precio final estimado: <span className="text-blue-800">${previewPrecioConIva.toFixed(2)}</span>
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="costo_producto" className="block text-sm font-semibold text-blue-900 mb-2">Costo</label>
              <input id="costo_producto" type="number" step="0.01" min="0"
                value={formData.costo}
                onChange={(e) => set('costo', e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* IVA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="aplica_iva" className="block text-sm font-semibold text-blue-900 mb-2">IVA</label>
              <select id="aplica_iva" value={formData.aplica_iva ? 'true' : 'false'}
                onChange={(e) => set('aplica_iva', e.target.value === 'true')}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="true">Aplica IVA</option>
                <option value="false">No aplica IVA</option>
              </select>
            </div>
            {formData.aplica_iva && (
              <div>
                <label htmlFor="porcentaje_iva" className="block text-sm font-semibold text-blue-900 mb-2">Tarifa IVA</label>
                <select id="porcentaje_iva" value={formData.porcentaje_iva}
                  onChange={(e) => set('porcentaje_iva', e.target.value)}
                  className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="2">12%</option>
                  <option value="4">15%</option>
                  <option value="0">0%</option>
                  <option value="6">No objeto de impuesto</option>
                  <option value="7">Exento de IVA</option>
                </select>
              </div>
            )}
          </div>

          {/* Inventario — solo para BIEN */}
          {formData.tipo === 'BIEN' && (
            <>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="maneja_inventario" checked={formData.maneja_inventario}
                  onChange={(e) => set('maneja_inventario', e.target.checked)}
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
                <label htmlFor="maneja_inventario" className="text-sm font-semibold text-blue-900">
                  Controlar inventario
                </label>
              </div>
              {formData.maneja_inventario && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="stock_actual" className="block text-sm font-semibold text-blue-900 mb-2">Stock Inicial</label>
                      <input id="stock_actual" type="number" step="0.01" min="0"
                        value={formData.stock_actual}
                        onChange={(e) => set('stock_actual', e.target.value)}
                        className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label htmlFor="stock_minimo" className="block text-sm font-semibold text-blue-900 mb-2">Stock Mínimo (alerta)</label>
                      <input id="stock_minimo" type="number" step="0.01" min="0"
                        value={formData.stock_minimo}
                        onChange={(e) => set('stock_minimo', e.target.value)}
                        className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="controla_caducidad"
                        checked={Boolean(formData.controla_caducidad)}
                        onChange={(e) => set('controla_caducidad', e.target.checked)}
                        className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="controla_caducidad" className="text-sm font-semibold text-blue-900">
                        Controlar caducidad
                      </label>
                    </div>

                    {formData.controla_caducidad && (
                      <>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="exige_lote"
                            checked={Boolean(formData.exige_lote)}
                            onChange={(e) => set('exige_lote', e.target.checked)}
                            className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <label htmlFor="exige_lote" className="text-sm font-semibold text-blue-900">
                            Exigir lote en movimientos
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="dias_alerta_caducidad" className="block text-sm font-semibold text-blue-900 mb-2">Días de alerta de caducidad</label>
                            <input
                              id="dias_alerta_caducidad"
                              type="number"
                              step="1"
                              min="1"
                              value={formData.dias_alerta_caducidad}
                              onChange={(e) => set('dias_alerta_caducidad', e.target.value)}
                              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label htmlFor="vida_util_dias" className="block text-sm font-semibold text-blue-900 mb-2">Vida útil referencial (días)</label>
                            <input
                              id="vida_util_dias"
                              type="number"
                              step="1"
                              min="1"
                              value={formData.vida_util_dias}
                              onChange={(e) => set('vida_util_dias', e.target.value)}
                              placeholder="Opcional"
                              className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Estado */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="activo" checked={formData.activo}
              onChange={(e) => set('activo', e.target.checked)}
              className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
            <label htmlFor="activo" className="text-sm font-semibold text-blue-900">Producto Activo</label>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-blue-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-blue-300 rounded-xl hover:bg-blue-50 font-semibold transition-colors text-blue-700">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-600 to-sky-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:via-blue-700 hover:to-sky-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
              <Save size={20} />
              {mutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
