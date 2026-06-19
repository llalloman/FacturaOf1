import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Edit2, Link2, Plus, Search, X } from 'lucide-react';
import { productosService } from '../../services/productosService';
import { proveedoresService, type ProveedorProductoPayload } from '../../services/proveedoresService';
import { toast } from '../../store/toastStore';
import type { Proveedor, ProveedorProducto } from '../../types';

interface Props { proveedores: Proveedor[]; }

const emptyForm: ProveedorProductoPayload = {
  proveedor: 0, producto: 0, codigo_proveedor: '', costo_referencia: 0,
  dias_entrega: 0, es_preferido: false, activo: true,
};

const errorMessage = (error: unknown) => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data) return 'No se pudo guardar la relación.';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    return Object.values(data as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [value]).join(' | ');
  }
  return 'No se pudo guardar la relación.';
};

const ProveedorProductosPanel: React.FC<Props> = ({ proveedores }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ProveedorProducto | null>(null);
  const [form, setForm] = useState<ProveedorProductoPayload>(emptyForm);
  const [isOpen, setIsOpen] = useState(false);

  const { data: relaciones = [], isLoading } = useQuery({
    queryKey: ['proveedores-catalogo'], queryFn: () => proveedoresService.getCatalogo(),
  });
  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'proveedores-catalogo'],
    queryFn: () => productosService.getAll({ page_size: 500, activo: true }),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? proveedoresService.updateRelacion(editing.id, form)
      : proveedoresService.createRelacion(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores-catalogo'] });
      toast.success(editing ? 'Vínculo actualizado' : 'Producto vinculado al proveedor');
      setIsOpen(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: (item: ProveedorProducto) => proveedoresService.updateRelacion(item.id, { activo: !item.activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores-catalogo'] }),
    onError: () => toast.error('No se pudo cambiar el estado del vínculo.'),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? relaciones.filter((item) => [item.proveedor_nombre, item.producto_nombre, item.codigo_proveedor ?? '']
      .some((value) => value.toLowerCase().includes(term))) : relaciones;
  }, [relaciones, search]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, proveedor: proveedores.find((item) => item.activo)?.id ?? 0, producto: productos[0]?.id ?? 0 });
    setIsOpen(true);
  };

  const openEdit = (item: ProveedorProducto) => {
    setEditing(item);
    setForm({ proveedor: item.proveedor, producto: item.producto, codigo_proveedor: item.codigo_proveedor ?? '',
      costo_referencia: item.costo_referencia, dias_entrega: item.dias_entrega,
      es_preferido: item.es_preferido, activo: item.activo });
    setIsOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.proveedor || !form.producto) return toast.error('Seleccione un proveedor y un producto.');
    saveMutation.mutate();
  };

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-semibold text-gray-900">Productos vinculados</h2>
        <p className="text-sm text-gray-500">Define quién suministra cada producto o servicio y su costo de referencia.</p></div>
      <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
        <Plus size={17} /> Vincular producto
      </button>
    </div>

    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor, producto o código..."
        className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></div>

    <div className="overflow-x-auto border-y border-gray-200">
      <table className="w-full min-w-[850px] text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr>
        <th className="px-4 py-3 font-medium">Producto</th><th className="px-4 py-3 font-medium">Proveedor</th>
        <th className="px-4 py-3 font-medium">Código proveedor</th><th className="px-4 py-3 text-right font-medium">Costo</th>
        <th className="px-4 py-3 text-center font-medium">Entrega</th><th className="px-4 py-3 text-center font-medium">Estado</th>
        <th className="px-4 py-3 text-center font-medium">Acciones</th></tr></thead>
        <tbody className="divide-y divide-gray-100 bg-white">{filtered.map((item) => <tr key={item.id} className="hover:bg-gray-50">
          <td className="px-4 py-3"><div className="font-medium text-gray-900">{item.producto_nombre}</div>
            <div className="text-xs text-gray-500">{item.producto_tipo === 'BIEN' ? 'Producto' : 'Servicio'}{item.es_preferido ? ' · Preferente' : ''}</div></td>
          <td className="px-4 py-3 text-gray-700">{item.proveedor_nombre}</td><td className="px-4 py-3 text-gray-600">{item.codigo_proveedor || '-'}</td>
          <td className="px-4 py-3 text-right font-medium">${Number(item.costo_referencia).toFixed(2)}</td>
          <td className="px-4 py-3 text-center">{item.dias_entrega ? `${item.dias_entrega} días` : 'Inmediata'}</td>
          <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.activo ? 'Activo' : 'Inactivo'}</span></td>
          <td className="px-4 py-3"><div className="flex justify-center gap-2">
            <button type="button" onClick={() => openEdit(item)} title="Editar vínculo" className="rounded p-2 text-blue-700 hover:bg-blue-50"><Edit2 size={17} /></button>
            <button type="button" onClick={() => toggleMutation.mutate(item)} title={item.activo ? 'Inactivar vínculo' : 'Activar vínculo'} className="rounded p-2 text-gray-700 hover:bg-gray-100">{item.activo ? <X size={17} /> : <Check size={17} />}</button>
          </div></td></tr>)}</tbody></table>
      {!isLoading && !filtered.length && <div className="py-12 text-center text-gray-500"><Link2 className="mx-auto mb-2 text-gray-400" size={28} />No hay productos vinculados.</div>}
      {isLoading && <div className="py-12 text-center text-gray-500">Cargando vínculos...</div>}
    </div>

    {isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-6 py-4"><div><h3 className="text-lg font-semibold">{editing ? 'Editar vínculo' : 'Vincular producto y proveedor'}</h3><p className="text-sm text-gray-500">Información comercial del abastecimiento.</p></div>
        <button type="button" onClick={() => setIsOpen(false)} title="Cerrar" className="rounded p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></button></div>
      <form onSubmit={submit} className="space-y-5 p-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">Proveedor *<select value={form.proveedor} onChange={(e) => setForm({...form, proveedor: Number(e.target.value)})} disabled={Boolean(editing)} className="mt-1.5 w-full rounded-md border px-3 py-2 disabled:bg-gray-100">
          <option value={0}>Seleccione...</option>{proveedores.filter((p) => p.activo || p.id === form.proveedor).map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Producto o servicio *<select value={form.producto} onChange={(e) => setForm({...form, producto: Number(e.target.value)})} disabled={Boolean(editing)} className="mt-1.5 w-full rounded-md border px-3 py-2 disabled:bg-gray-100">
          <option value={0}>Seleccione...</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.codigo_principal} - {p.nombre}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Código del proveedor<input value={form.codigo_proveedor ?? ''} onChange={(e) => setForm({...form, codigo_proveedor: e.target.value})} className="mt-1.5 w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm font-medium text-gray-700">Costo de referencia<input type="number" min="0" step="0.000001" value={form.costo_referencia} onChange={(e) => setForm({...form, costo_referencia: e.target.value})} className="mt-1.5 w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm font-medium text-gray-700">Días de entrega<input type="number" min="0" step="1" value={form.dias_entrega} onChange={(e) => setForm({...form, dias_entrega: Number(e.target.value)})} className="mt-1.5 w-full rounded-md border px-3 py-2" /></label>
        <div className="flex flex-col justify-end gap-3 pb-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.es_preferido} onChange={(e) => setForm({...form, es_preferido: e.target.checked})} /> Proveedor preferente</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({...form, activo: e.target.checked})} /> Vínculo activo</label></div>
      </div><div className="flex justify-end gap-3 border-t pt-5"><button type="button" onClick={() => setIsOpen(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
        <button type="submit" disabled={saveMutation.isPending} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saveMutation.isPending ? 'Guardando...' : 'Guardar vínculo'}</button></div></form>
    </div></div>}
  </div>;
};

export default ProveedorProductosPanel;
