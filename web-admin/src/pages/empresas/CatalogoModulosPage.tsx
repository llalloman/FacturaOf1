import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Layers3, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { MODULOS } from '../../constants/modulos';
import { suscripcionesService, type ModuloSistema, type SeccionModulo } from '../../services/suscripcionesService';
import { useToast } from '../../hooks/useToast';
import { confirmDialog } from '../../store/confirmStore';

const emptySeccionForm = {
  codigo: '',
  nombre: '',
  orden: 1,
  activo: true,
};

const emptyModuloForm = {
  seccion: undefined as number | undefined,
  codigo: '',
  label: '',
  ruta: '',
  grupo: '',
  icono: 'FileText',
  orden: 1,
  activo: true,
  external: false,
};

const normalizarCodigo = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ordenModulo = (modulo: ModuloSistema | (typeof MODULOS)[number]) =>
  'orden' in modulo ? modulo.orden ?? 0 : 0;

const getModuloSeccionId = (modulo: ModuloSistema | (typeof MODULOS)[number], secciones: SeccionModulo[]) => {
  if ('seccion' in modulo && modulo.seccion) return modulo.seccion;
  return secciones.find((seccion) => seccion.nombre === modulo.grupo)?.id;
};

export default function CatalogoModulosPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [savingSeccion, setSavingSeccion] = useState(false);
  const [savingModulo, setSavingModulo] = useState(false);
  const [deletingSeccionId, setDeletingSeccionId] = useState<number | null>(null);
  const [deletingModuloId, setDeletingModuloId] = useState<number | null>(null);
  const [editingSeccion, setEditingSeccion] = useState<SeccionModulo | null>(null);
  const [editingModulo, setEditingModulo] = useState<ModuloSistema | null>(null);
  const [selectedSeccionId, setSelectedSeccionId] = useState<number | null>(null);
  const [seccionForm, setSeccionForm] = useState<Partial<SeccionModulo>>(emptySeccionForm);
  const [moduloForm, setModuloForm] = useState<Partial<ModuloSistema>>(emptyModuloForm);

  const { data: secciones = [], isLoading: loadingSecciones } = useQuery({
    queryKey: ['modulos-secciones'],
    queryFn: () => suscripcionesService.getSeccionesModulos(),
  });
  const { data: catalogoServidor = [], isLoading: loadingCatalogo } = useQuery({
    queryKey: ['modulos-catalogo'],
    queryFn: () => suscripcionesService.getCatalogModulos(),
  });
  const { data: modulosAdmin = [], isLoading: loadingModulosAdmin } = useQuery({
    queryKey: ['modulos-sistema'],
    queryFn: () => suscripcionesService.getModulosSistema(),
  });

  const modulos = (modulosAdmin.length > 0 ? modulosAdmin : catalogoServidor.length > 0 ? catalogoServidor : MODULOS)
    .slice()
    .sort((a, b) => `${a.grupo}-${ordenModulo(a)}-${a.label}`.localeCompare(`${b.grupo}-${ordenModulo(b)}-${b.label}`));

  const seccionesVisibles = useMemo(() => {
    if (secciones.length > 0) return secciones;
    const grupos = Array.from(new Set(modulos.map((mod) => mod.grupo)));
    return grupos.map((grupo, index) => ({
      id: undefined,
      codigo: normalizarCodigo(grupo),
      nombre: grupo,
      orden: index + 1,
      activo: true,
    }));
  }, [modulos, secciones]);

  const seccionesOrdenadas = seccionesVisibles
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
  const selectedSeccion = seccionesOrdenadas.find((seccion) => seccion.id === selectedSeccionId) ?? seccionesOrdenadas[0];

  const modulosPorSeccion = seccionesVisibles.map((seccion) => ({
    seccion,
    modulos: modulos.filter((modulo) =>
      ('seccion' in modulo && modulo.seccion === seccion.id) ||
      ('seccion_nombre' in modulo && modulo.seccion_nombre === seccion.nombre) ||
      modulo.grupo === seccion.nombre
    ),
  }));
  const selectedSubmenus = selectedSeccion
    ? (modulosPorSeccion.find((grupo) => grupo.seccion.codigo === selectedSeccion.codigo)?.modulos ?? [])
      .slice()
      .sort((a, b) => ordenModulo(a) - ordenModulo(b) || a.label.localeCompare(b.label))
    : [];
  const menuOrderCount = secciones.length + (editingSeccion ? 0 : 1);
  const formSeccionId = Number(moduloForm.seccion || selectedSeccion?.id || 0);
  const formSubmenus = modulos.filter((modulo) => getModuloSeccionId(modulo, secciones) === formSeccionId);
  const submenuOrderCount = formSubmenus.length + (editingModulo ? 0 : 1);

  const resetSeccionForm = () => {
    setEditingSeccion(null);
    setSeccionForm(emptySeccionForm);
  };

  const resetModuloForm = () => {
    setEditingModulo(null);
    setModuloForm({ ...emptyModuloForm, seccion: selectedSeccion?.id });
  };

  const editSeccion = (seccion: SeccionModulo) => {
    if (!seccion.id) return;
    setSelectedSeccionId(seccion.id);
    setEditingSeccion(seccion);
    setSeccionForm({
      codigo: seccion.codigo,
      nombre: seccion.nombre,
      orden: seccion.orden ?? 1,
      activo: seccion.activo ?? true,
    });
  };

  const editModulo = (modulo: ModuloSistema) => {
    const seccionId = modulo.seccion ?? secciones.find((s) => s.nombre === modulo.grupo)?.id;
    setEditingModulo(modulo);
    setModuloForm({
      seccion: seccionId,
      codigo: modulo.codigo,
      label: modulo.label,
      ruta: modulo.ruta,
      grupo: modulo.grupo,
      icono: modulo.icono || 'FileText',
      orden: modulo.orden ?? 1,
      activo: modulo.activo ?? true,
      external: modulo.external ?? false,
    });
  };

  const reorderMenus = async (saved: SeccionModulo, desiredOrder: number) => {
    if (!saved.id) return;
    const others = secciones
      .filter((seccion) => seccion.id && seccion.id !== saved.id)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
    const next = [...others];
    const index = Math.max(0, Math.min(desiredOrder - 1, next.length));
    next.splice(index, 0, saved);
    await Promise.all(
      next.map((seccion, position) => {
        const orden = position + 1;
        return seccion.id && seccion.orden !== orden
          ? suscripcionesService.updateSeccionModulo(seccion.id, { orden })
          : Promise.resolve(seccion);
      }),
    );
  };

  const normalizeMenus = async (deletedId?: number) => {
    const next = secciones
      .filter((seccion) => seccion.id && seccion.id !== deletedId)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
    await Promise.all(
      next.map((seccion, position) => (
        seccion.id && seccion.orden !== position + 1
          ? suscripcionesService.updateSeccionModulo(seccion.id, { orden: position + 1 })
          : Promise.resolve(seccion)
      )),
    );
  };

  const reorderSubmenus = async (saved: ModuloSistema, targetSeccionId: number, desiredOrder: number) => {
    if (!saved.id) return;
    const others = modulosAdmin
      .filter((modulo) => modulo.id && modulo.id !== saved.id && getModuloSeccionId(modulo, secciones) === targetSeccionId)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.label.localeCompare(b.label));
    const next = [...others];
    const index = Math.max(0, Math.min(desiredOrder - 1, next.length));
    next.splice(index, 0, { ...saved, seccion: targetSeccionId });
    await Promise.all(
      next.map((modulo, position) => {
        const orden = position + 1;
        return modulo.id && modulo.orden !== orden
          ? suscripcionesService.updateModuloSistema(modulo.id, { orden })
          : Promise.resolve(modulo);
      }),
    );
  };

  const normalizeSubmenus = async (seccionId: number) => {
    const submenus = modulosAdmin
      .filter((modulo) => modulo.id && getModuloSeccionId(modulo, secciones) === seccionId)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.label.localeCompare(b.label));
    await Promise.all(
      submenus.map((modulo, position) => (
        modulo.id && modulo.orden !== position + 1
          ? suscripcionesService.updateModuloSistema(modulo.id, { orden: position + 1 })
          : Promise.resolve(modulo)
      )),
    );
  };

  const saveSeccion = async () => {
    if (!seccionForm.nombre) {
      showToast('El nombre del menú es requerido', 'warning');
      return;
    }
    setSavingSeccion(true);
    try {
      const payload = {
        codigo: String(seccionForm.codigo || normalizarCodigo(seccionForm.nombre || '')).trim(),
        nombre: String(seccionForm.nombre).trim(),
        orden: Number(seccionForm.orden || 0),
        activo: Boolean(seccionForm.activo),
      };
      let saved: SeccionModulo;
      if (editingSeccion?.id) {
        saved = await suscripcionesService.updateSeccionModulo(editingSeccion.id, payload);
        showToast('Menú actualizado', 'success');
      } else {
        saved = await suscripcionesService.createSeccionModulo(payload);
        showToast('Menú creado', 'success');
      }
      await reorderMenus(saved, Number(seccionForm.orden || 1));
      setSelectedSeccionId(saved.id ?? null);
      resetSeccionForm();
      queryClient.invalidateQueries({ queryKey: ['modulos-secciones'] });
      queryClient.invalidateQueries({ queryKey: ['modulos-catalogo'] });
    } catch {
      showToast('Error al guardar el menú', 'error');
    } finally {
      setSavingSeccion(false);
    }
  };

  const deleteSeccion = async (seccion: SeccionModulo, totalSubmenus: number) => {
    if (!seccion.id) return;
    const confirmed = await confirmDialog(
      'Eliminar menú',
      totalSubmenus > 0
        ? `El menú "${seccion.nombre}" tiene ${totalSubmenus} submenú(s). Primero debes eliminarlos o moverlos a otro menú.`
        : `¿Eliminar el menú "${seccion.nombre}"? Esta acción no se puede deshacer.`,
      'danger',
    );
    if (!confirmed || totalSubmenus > 0) return;

    setDeletingSeccionId(seccion.id);
    try {
      await suscripcionesService.deleteSeccionModulo(seccion.id);
      if (editingSeccion?.id === seccion.id) resetSeccionForm();
      await normalizeMenus(seccion.id);
      showToast('Menú eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['modulos-secciones'] });
      queryClient.invalidateQueries({ queryKey: ['modulos-catalogo'] });
    } catch (error) {
      const message = (error as { response?: { data?: { detail?: string; error?: string } } })?.response?.data?.detail
        || (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al eliminar el menú';
      showToast(message, 'error');
    } finally {
      setDeletingSeccionId(null);
    }
  };

  const saveModulo = async () => {
    const seccionSeleccionada = secciones.find((s) => s.id === Number(moduloForm.seccion));
    if (!moduloForm.codigo || !moduloForm.label || !moduloForm.ruta || !seccionSeleccionada) {
      showToast('Menú, código, etiqueta y ruta son requeridos', 'warning');
      return;
    }
    const targetSeccionId = seccionSeleccionada.id;
    if (!targetSeccionId) {
      showToast('Selecciona un menú válido', 'warning');
      return;
    }
    setSavingModulo(true);
    try {
      const payload = {
        ...moduloForm,
        seccion: seccionSeleccionada.id,
        grupo: seccionSeleccionada.nombre,
        codigo: String(moduloForm.codigo).trim(),
        label: String(moduloForm.label).trim(),
        ruta: String(moduloForm.ruta).trim(),
        icono: String(moduloForm.icono || '').trim(),
        orden: Number(moduloForm.orden || 0),
        activo: Boolean(moduloForm.activo),
        external: Boolean(moduloForm.external),
      };
      const previousSeccionId = editingModulo ? getModuloSeccionId(editingModulo, secciones) : undefined;
      let saved: ModuloSistema;
      if (editingModulo?.id) {
        saved = await suscripcionesService.updateModuloSistema(editingModulo.id, payload);
        showToast('Submenú actualizado', 'success');
      } else {
        saved = await suscripcionesService.createModuloSistema(payload);
        showToast('Submenú creado', 'success');
      }
      await reorderSubmenus(saved, targetSeccionId, Number(moduloForm.orden || 1));
      if (previousSeccionId && previousSeccionId !== targetSeccionId) {
        await normalizeSubmenus(previousSeccionId);
      }
      setSelectedSeccionId(targetSeccionId);
      resetModuloForm();
      queryClient.invalidateQueries({ queryKey: ['modulos-sistema'] });
      queryClient.invalidateQueries({ queryKey: ['modulos-catalogo'] });
      queryClient.invalidateQueries({ queryKey: ['mis-modulos'] });
    } catch {
      showToast('Error al guardar el submenú', 'error');
    } finally {
      setSavingModulo(false);
    }
  };

  const deleteModulo = async (modulo: ModuloSistema) => {
    if (!modulo.id) return;
    const confirmed = await confirmDialog(
      'Eliminar submenú',
      `¿Eliminar el submenú "${modulo.label}"? También se quitará de la matriz de permisos de los planes.`,
      'danger',
    );
    if (!confirmed) return;

    setDeletingModuloId(modulo.id);
    try {
      await suscripcionesService.deleteModuloSistema(modulo.id);
      if (editingModulo?.id === modulo.id) resetModuloForm();
      const seccionId = getModuloSeccionId(modulo, secciones);
      if (seccionId) await normalizeSubmenus(seccionId);
      showToast('Submenú eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['modulos-sistema'] });
      queryClient.invalidateQueries({ queryKey: ['modulos-catalogo'] });
      queryClient.invalidateQueries({ queryKey: ['planes-modulos'] });
      queryClient.invalidateQueries({ queryKey: ['mis-modulos'] });
    } catch (error) {
      const message = (error as { response?: { data?: { detail?: string; error?: string } } })?.response?.data?.detail
        || (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al eliminar el submenú';
      showToast(message, 'error');
    } finally {
      setDeletingModuloId(null);
    }
  };

  if (loadingSecciones || loadingCatalogo || loadingModulosAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Layers3 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Menús</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administra la jerarquía menú y submenú del sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editingSeccion ? 'Editar menú' : 'Nuevo menú'}</h2>
              <p className="text-sm text-gray-500">Agrupa submenús como POS, Facturas, Productos o Bancos.</p>
            </div>
            {editingSeccion && (
              <button type="button" onClick={resetSeccionForm} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Código: ventas"
              value={seccionForm.codigo ?? ''}
              onChange={(e) => setSeccionForm((f) => ({ ...f, codigo: e.target.value }))}
              disabled={!!editingSeccion}
            />
            <input
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Menú: Ventas"
              value={seccionForm.nombre ?? ''}
              onChange={(e) => setSeccionForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <select
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              value={seccionForm.orden ?? 1}
              onChange={(e) => setSeccionForm((f) => ({ ...f, orden: Number(e.target.value) }))}
            >
              {Array.from({ length: Math.max(1, menuOrderCount) }, (_, index) => index + 1).map((orden) => (
                <option key={orden} value={orden}>Posición {orden}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={saveSeccion}
              disabled={savingSeccion}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {savingSeccion ? <Loader2 size={15} className="animate-spin" /> : editingSeccion ? <Save size={15} /> : <Plus size={15} />}
              {editingSeccion ? 'Guardar menú' : 'Crear menú'}
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" className="rounded accent-blue-600" checked={Boolean(seccionForm.activo)} onChange={(e) => setSeccionForm((f) => ({ ...f, activo: e.target.checked }))} />
            Menú activo
          </label>

          {editingSeccion?.id && (
            <button
              type="button"
              onClick={() => deleteSeccion(
                editingSeccion,
                modulos.filter((m) => ('seccion' in m && m.seccion === editingSeccion.id) || m.grupo === editingSeccion.nombre).length,
              )}
              disabled={deletingSeccionId === editingSeccion.id}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deletingSeccionId === editingSeccion.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Eliminar menú
            </button>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Menús registrados</h3>
              <span className="text-xs text-gray-400">{seccionesOrdenadas.length} total</span>
            </div>
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {seccionesOrdenadas.map((seccion, index) => {
                const hijos = modulosPorSeccion.find((grupo) => grupo.seccion.codigo === seccion.codigo)?.modulos ?? [];
                const selected = selectedSeccion?.codigo === seccion.codigo;
                return (
                  <div
                    key={seccion.codigo}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                      selected ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSeccionId(seccion.id ?? null);
                        setModuloForm((form) => ({ ...form, seccion: seccion.id }));
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-gray-800">{index + 1}. {seccion.nombre}</p>
                      <p className="text-xs text-gray-400">{hijos.length} submenú(s)</p>
                    </button>
                    {seccion.id && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => editSeccion(seccion)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-blue-600" title="Editar menú">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => deleteSeccion(seccion, hijos.length)} disabled={deletingSeccionId === seccion.id} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600 disabled:opacity-60" title="Eliminar menú">
                          {deletingSeccionId === seccion.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editingModulo ? 'Editar submenú' : 'Nuevo submenú'}</h2>
              <p className="text-sm text-gray-500">El submenú es la opción final del menú lateral y de la matriz de permisos.</p>
            </div>
            {editingModulo && (
              <button type="button" onClick={resetModuloForm} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <X size={15} />
                Cancelar edición
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-8">
            <select
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 lg:col-span-2"
              value={moduloForm.seccion ?? ''}
              onChange={(e) => setModuloForm((f) => ({ ...f, seccion: Number(e.target.value) || undefined }))}
            >
              <option value="">Menú</option>
              {seccionesOrdenadas.map((seccion) => (
                <option key={seccion.id} value={seccion.id}>{seccion.nombre}</option>
              ))}
            </select>
            <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="codigo" value={moduloForm.codigo ?? ''} onChange={(e) => setModuloForm((f) => ({ ...f, codigo: e.target.value }))} disabled={!!editingModulo} />
            <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 lg:col-span-2" placeholder="Submenú visible" value={moduloForm.label ?? ''} onChange={(e) => setModuloForm((f) => ({ ...f, label: e.target.value }))} />
            <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="/ruta" value={moduloForm.ruta ?? ''} onChange={(e) => setModuloForm((f) => ({ ...f, ruta: e.target.value }))} />
            <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="Icono" value={moduloForm.icono ?? ''} onChange={(e) => setModuloForm((f) => ({ ...f, icono: e.target.value }))} />
            <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={moduloForm.orden ?? 1} onChange={(e) => setModuloForm((f) => ({ ...f, orden: Number(e.target.value) }))}>
              {Array.from({ length: Math.max(1, submenuOrderCount) }, (_, index) => index + 1).map((orden) => (
                <option key={orden} value={orden}>Posición {orden}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="rounded accent-blue-600" checked={Boolean(moduloForm.activo)} onChange={(e) => setModuloForm((f) => ({ ...f, activo: e.target.checked }))} />
                Activo
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="rounded accent-blue-600" checked={Boolean(moduloForm.external)} onChange={(e) => setModuloForm((f) => ({ ...f, external: e.target.checked }))} />
                Abre en nueva pestaña
              </label>
            </div>
            <button
              type="button"
              onClick={saveModulo}
              disabled={savingModulo || secciones.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingModulo ? <Loader2 size={15} className="animate-spin" /> : editingModulo ? <Save size={15} /> : <Plus size={15} />}
              {editingModulo ? 'Guardar submenú' : 'Crear submenú'}
            </button>
            {editingModulo?.id && (
              <button
                type="button"
                onClick={() => deleteModulo(editingModulo)}
                disabled={deletingModuloId === editingModulo.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {deletingModuloId === editingModulo.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Eliminar submenú
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">
                  Submenús {selectedSeccion ? `de ${selectedSeccion.nombre}` : ''}
                </h3>
                <p className="text-xs text-gray-400">La posición se reacomoda automáticamente al guardar.</p>
              </div>
              {selectedSeccion?.id && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingModulo(null);
                    setModuloForm({ ...emptyModuloForm, seccion: selectedSeccion.id, orden: selectedSubmenus.length + 1 });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Plus size={15} />
                  Nuevo submenú
                </button>
              )}
            </div>

            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {selectedSubmenus.map((mod, index) => (
                <div
                  key={mod.codigo}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-blue-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{index + 1}. {mod.label}</p>
                    <p className="truncate text-xs text-gray-400">{mod.codigo} · {mod.ruta}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {'activo' in mod && mod.activo === false ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Inactivo</span>
                    ) : (
                      <CheckCircle2 size={15} className="text-blue-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => editModulo(mod as ModuloSistema)}
                      className="rounded-lg p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      title="Editar submenú"
                    >
                      <Pencil size={15} />
                    </button>
                    {'id' in mod && mod.id ? (
                      <button
                        type="button"
                        onClick={() => deleteModulo(mod as ModuloSistema)}
                        disabled={deletingModuloId === mod.id}
                        className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar submenú"
                      >
                        {deletingModuloId === mod.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {selectedSubmenus.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                  Este menú aún no tiene submenús.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
