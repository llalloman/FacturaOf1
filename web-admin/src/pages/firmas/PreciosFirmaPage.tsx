import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, CalendarDays, Percent, RefreshCw, Save, Trash2 } from 'lucide-react';
import { firmasService, type PrecioFirma, type PromocionFirma } from '../../services/firmasService';
import { toast } from '../../store/toastStore';

const money = (value?: string | number) => `$${Number(value ?? 0).toFixed(2)}`;
const today = new Date().toISOString().slice(0, 10);

function PriceEditor({ precio }: { precio: PrecioFirma }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    regular_price: precio.regular_price,
    active: precio.active,
    order: precio.order,
  });

  const update = useMutation({
    mutationFn: () => firmasService.updatePrecioFirma(precio.id, form),
    onSuccess: () => {
      toast.success('Precio actualizado');
      qc.invalidateQueries({ queryKey: ['precios-firma-admin'] });
      qc.invalidateQueries({ queryKey: ['precios-firma-publicos'] });
    },
    onError: () => toast.error('No se pudo actualizar el precio'),
  });

  const hasPromotion = Boolean(precio.active_promotion && Number(precio.current_price) < Number(precio.regular_price));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Vigencia</p>
          <h3 className="text-xl font-black text-slate-950">{precio.validity_display}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${precio.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {precio.active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Precio final incluido IVA</span>
          <input type="number" step="0.01" value={form.regular_price} onChange={(e) => setForm((f) => ({ ...f, regular_price: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Orden</span>
          <input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
        Mostrar esta vigencia en el formulario público
      </label>

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase text-slate-500">Precio vigente</p>
        <div className="mt-1 flex items-end gap-2">
          {hasPromotion && <span className="text-sm font-semibold text-red-500 line-through">{money(precio.regular_price)}</span>}
          <strong className="text-2xl font-black text-slate-950">{money(precio.current_price)}</strong>
          <span className="mb-1 text-xs font-bold text-emerald-700">IVA incluido</span>
        </div>
        {precio.active_promotion && <p className="mt-1 text-xs text-slate-500">Promo: {precio.active_promotion.name}</p>}
      </div>

      <button onClick={() => update.mutate()} disabled={update.isPending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
        <Save size={16} /> {update.isPending ? 'Guardando...' : 'Guardar precio'}
      </button>
    </div>
  );
}

export default function PreciosFirmaPage() {
  const qc = useQueryClient();
  const { data: precios = [], isLoading } = useQuery({ queryKey: ['precios-firma-admin'], queryFn: firmasService.listPreciosFirma });
  const { data: promociones = [] } = useQuery({ queryKey: ['promociones-firma-admin'], queryFn: firmasService.listPromocionesFirma });
  const [promo, setPromo] = useState<PromocionFirma>({
    price: 0,
    name: '',
    promotional_price: '',
    start_date: today,
    end_date: today,
    active: true,
  });

  const createPromo = useMutation({
    mutationFn: () => firmasService.createPromocionFirma(promo),
    onSuccess: () => {
      toast.success('Promoción creada');
      setPromo({ price: 0, name: '', promotional_price: '', start_date: today, end_date: today, active: true });
      qc.invalidateQueries({ queryKey: ['promociones-firma-admin'] });
      qc.invalidateQueries({ queryKey: ['precios-firma-admin'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: unknown } };
      toast.error('No se pudo crear la promoción', JSON.stringify(err.response?.data ?? ''));
    },
  });

  const deletePromo = useMutation({
    mutationFn: firmasService.deletePromocionFirma,
    onSuccess: () => {
      toast.success('Promoción eliminada');
      qc.invalidateQueries({ queryKey: ['promociones-firma-admin'] });
      qc.invalidateQueries({ queryKey: ['precios-firma-admin'] });
    },
  });

  const togglePromo = useMutation({
    mutationFn: (item: PromocionFirma) => firmasService.updatePromocionFirma(item.id!, { active: !item.active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promociones-firma-admin'] });
      qc.invalidateQueries({ queryKey: ['precios-firma-admin'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-slate-950 to-blue-950 p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-blue-200">SUPER_ADMIN</p>
          <h1 className="mt-1 text-2xl font-black">Precios y promociones de firma electrónica</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">Administra los precios finales incluidos IVA y promociones que ve el cliente en el formulario público.</p>
        </div>
        <button onClick={() => { qc.invalidateQueries({ queryKey: ['precios-firma-admin'] }); qc.invalidateQueries({ queryKey: ['promociones-firma-admin'] }); }} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/10">
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Cargando precios...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {precios.map((precio) => <PriceEditor key={precio.id} precio={precio} />)}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Percent className="text-blue-600" size={20} />
            <h2 className="text-lg font-black text-slate-950">Nueva promoción</h2>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Vigencia</span>
              <select value={promo.price || ''} onChange={(e) => setPromo((p) => ({ ...p, price: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Selecciona...</option>
                {precios.map((precio) => <option key={precio.id} value={precio.id}>{precio.validity_display} - {money(precio.regular_price)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Nombre</span>
              <input value={promo.name} onChange={(e) => setPromo((p) => ({ ...p, name: e.target.value }))} placeholder="Ej. Promoción junio" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Precio promocional incluido IVA</span>
              <input type="number" step="0.01" value={promo.promotional_price} onChange={(e) => setPromo((p) => ({ ...p, promotional_price: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Inicio</span>
                <input type="date" value={promo.start_date} onChange={(e) => setPromo((p) => ({ ...p, start_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Fin</span>
                <input type="date" value={promo.end_date} onChange={(e) => setPromo((p) => ({ ...p, end_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <button onClick={() => createPromo.mutate()} disabled={createPromo.isPending || !promo.price || !promo.name || !promo.promotional_price} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              <BadgeDollarSign size={16} /> Crear promoción
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="text-blue-600" size={20} />
            <h2 className="text-lg font-black text-slate-950">Promociones</h2>
          </div>
          <div className="space-y-3">
            {promociones.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay promociones creadas.</p>}
            {promociones.map((item) => {
              const precio = precios.find((p) => p.id === item.price);
              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-950">{item.name}</strong>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.active ? 'Activa' : 'Inactiva'}</span>
                      {item.is_current && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">Vigente hoy</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{precio?.validity_display ?? 'Vigencia'} · <span className="line-through text-red-500">{money(precio?.regular_price)}</span> → <strong className="text-slate-900">{money(item.promotional_price)}</strong> · {item.start_date} a {item.end_date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => togglePromo.mutate(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{item.active ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => item.id && deletePromo.mutate(item.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
