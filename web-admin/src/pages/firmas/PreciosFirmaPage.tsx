import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, CalendarDays, Edit2, Percent, RefreshCw, Save, Ticket, Trash2 } from 'lucide-react';
import {
  firmasService,
  type CuponFirma,
  type PrecioFirma,
  type PromocionFirma,
  type PromocionFirmaBulkPayload,
} from '../../services/firmasService';
import { toast } from '../../store/toastStore';

const money = (value?: string | number) => `$${Number(value ?? 0).toFixed(2)}`;
const today = new Date().toISOString().slice(0, 10);
const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const errorDetail = (error: unknown) => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  return data ? JSON.stringify(data) : 'Revisa los datos ingresados.';
};

function PriceEditor({ precio }: { precio: PrecioFirma }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ regular_price: precio.regular_price, tax_rate: precio.tax_rate, active: precio.active, order: precio.order });
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
  const base = Number(form.regular_price || 0) / (1 + Number(form.tax_rate || 0) / 100);

  return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">Vigencia</p><h3 className="text-xl font-black text-slate-950">{precio.validity_display}</h3></div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${precio.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{precio.active ? 'Activo' : 'Inactivo'}</span></div>
    <div className="mt-4 grid grid-cols-3 gap-3">
      <label className="col-span-2 text-xs font-semibold text-slate-600">Precio final incluido IVA<input type="number" min="0" step="0.01" value={form.regular_price} onChange={(e) => setForm({...form, regular_price: e.target.value})} className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-semibold text-slate-600">IVA %<input type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm({...form, tax_rate: e.target.value})} className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-semibold text-slate-600">Orden<input type="number" value={form.order} onChange={(e) => setForm({...form, order: Number(e.target.value)})} className={`${inputClass} mt-1`} /></label>
      <div className="col-span-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">Base sin IVA: <strong>{money(base)}</strong></div>
    </div>
    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.active} onChange={(e) => setForm({...form, active: e.target.checked})} /> Mostrar en el formulario público</label>
    <div className="mt-4 rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Precio vigente</p><div className="mt-1 flex items-end gap-2">{hasPromotion && <span className="text-sm font-semibold text-red-500 line-through">{money(precio.regular_price)}</span>}<strong className="text-2xl font-black">{money(precio.current_price)}</strong><span className="mb-1 text-xs font-bold text-emerald-700">IVA incluido</span></div>{precio.active_promotion && <p className="mt-1 text-xs text-slate-500">Promoción: {precio.active_promotion.name}</p>}</div>
    <button onClick={() => update.mutate()} disabled={update.isPending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"><Save size={16} /> Guardar precio</button>
  </div>;
}

function PromotionsPanel({ precios, promociones }: { precios: PrecioFirma[]; promociones: PromocionFirma[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PromocionFirmaBulkPayload>({ prices: [], name: '', discount_type: 'PERCENTAGE', discount_value: '', start_date: today, end_date: today, active: true });
  const create = useMutation({
    mutationFn: () => firmasService.createPromocionesFirma(form),
    onSuccess: () => { toast.success('Promoción creada para las vigencias seleccionadas'); setForm({...form, prices: [], name: '', discount_value: ''}); qc.invalidateQueries({queryKey:['promociones-firma-admin']}); qc.invalidateQueries({queryKey:['precios-firma-admin']}); },
    onError: (error) => toast.error('No se pudo crear la promoción', errorDetail(error)),
  });
  const remove = useMutation({ mutationFn: firmasService.deletePromocionFirma, onSuccess: () => { qc.invalidateQueries({queryKey:['promociones-firma-admin']}); qc.invalidateQueries({queryKey:['precios-firma-admin']}); } });
  const toggle = useMutation({ mutationFn: (item: PromocionFirma) => firmasService.updatePromocionFirma(item.id!, {active: !item.active}), onSuccess: () => { qc.invalidateQueries({queryKey:['promociones-firma-admin']}); qc.invalidateQueries({queryKey:['precios-firma-admin']}); } });
  const selected = precios.filter((price) => form.prices.includes(price.id));
  const preview = (price: PrecioFirma) => {
    if (form.discount_type === 'FINAL_PRICE') return Number(form.discount_value || 0);
    const base = Number(price.regular_price) / (1 + Number(price.tax_rate) / 100);
    const discountedBase = base * (1 - Number(form.discount_value || 0) / 100);
    return discountedBase * (1 + Number(price.tax_rate) / 100);
  };
  const togglePrice = (id: number) => setForm({...form, prices: form.prices.includes(id) ? form.prices.filter((item) => item !== id) : [...form.prices, id]});

  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
    <section className="space-y-4"><div><h2 className="flex items-center gap-2 text-lg font-black"><Percent size={20} className="text-blue-700" /> Nueva promoción</h2><p className="mt-1 text-sm text-slate-500">Selecciona una o varias vigencias.</p></div>
      <label className="block text-sm font-semibold">Nombre<input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} placeholder="Ej. Promoción de temporada" className={`${inputClass} mt-1`} /></label>
      <div><p className="mb-2 text-sm font-semibold">Vigencias</p><div className="grid gap-2 sm:grid-cols-2">{precios.map((price) => <label key={price.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${form.prices.includes(price.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" checked={form.prices.includes(price.id)} onChange={() => togglePrice(price.id)} /><span><strong>{price.validity_display}</strong><span className="block text-xs text-slate-500">{money(price.regular_price)}</span></span></label>)}</div></div>
      <div><p className="mb-2 text-sm font-semibold">Modalidad</p><div className="grid grid-cols-2 rounded-lg border border-slate-200 p-1"><button type="button" onClick={() => setForm({...form, discount_type:'PERCENTAGE'})} className={`rounded-md px-3 py-2 text-sm font-semibold ${form.discount_type === 'PERCENTAGE' ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>Porcentaje</button><button type="button" onClick={() => setForm({...form, discount_type:'FINAL_PRICE'})} className={`rounded-md px-3 py-2 text-sm font-semibold ${form.discount_type === 'FINAL_PRICE' ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>Precio final</button></div></div>
      <label className="block text-sm font-semibold">{form.discount_type === 'PERCENTAGE' ? 'Descuento sobre la base sin IVA (%)' : 'Precio promocional incluido IVA'}<input type="number" min="0.01" step="0.01" value={form.discount_value} onChange={(e) => setForm({...form, discount_value:e.target.value})} className={`${inputClass} mt-1`} /></label>
      {selected.length > 0 && <div className="rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="mb-2 text-xs font-bold uppercase text-blue-700">Vista previa</p>{selected.map((price) => <div key={price.id} className="flex justify-between py-1 text-sm"><span>{price.validity_display}</span><span><s className="mr-2 text-red-500">{money(price.regular_price)}</s><strong>{money(preview(price))}</strong></span></div>)}</div>}
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Inicio<input type="date" value={form.start_date} onChange={(e) => setForm({...form,start_date:e.target.value})} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Fin<input type="date" value={form.end_date} onChange={(e) => setForm({...form,end_date:e.target.value})} className={`${inputClass} mt-1`} /></label></div>
      <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.discount_value || !form.prices.length} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><BadgeDollarSign size={17} /> Crear promoción</button>
    </section>
    <section><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CalendarDays size={20} className="text-blue-700" /> Promociones creadas</h2><div className="space-y-3">{!promociones.length && <p className="border-y py-8 text-center text-sm text-slate-500">No hay promociones creadas.</p>}{promociones.map((item) => { const price=precios.find((p)=>p.id===item.price); return <div key={item.id} className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>{item.name}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.active?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{item.active?'Activa':'Inactiva'}</span></div><p className="mt-1 text-sm text-slate-500">{price?.validity_display} · {item.discount_type === 'PERCENTAGE' ? `${item.discount_value}%` : money(item.discount_value)} · <s>{money(price?.regular_price)}</s> → <strong>{money(item.promotional_price)}</strong></p><p className="text-xs text-slate-400">{item.start_date} a {item.end_date}</p></div><div className="flex gap-2"><button onClick={()=>toggle.mutate(item)} className="rounded-md border px-3 py-2 text-xs font-bold">{item.active?'Desactivar':'Activar'}</button><button onClick={()=>item.id&&remove.mutate(item.id)} title="Eliminar" className="rounded-md border border-red-200 p-2 text-red-600"><Trash2 size={15}/></button></div></div>;})}</div></section>
  </div>;
}

const blankCoupon = (): CuponFirma => ({ code:'', name:'', discount_type:'PERCENTAGE', discount_value:'', prices:[], start_date:today, end_date:today, minimum_amount:'0', max_total_uses:null, max_uses_per_customer:1, active:true });

function CouponsPanel({ precios, coupons }: { precios: PrecioFirma[]; coupons: CuponFirma[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<CuponFirma>(blankCoupon());
  const refresh = () => qc.invalidateQueries({queryKey:['cupones-firma-admin']});
  const save = useMutation({ mutationFn: () => editing ? firmasService.updateCuponFirma(editing, form) : firmasService.createCuponFirma(form), onSuccess:()=>{toast.success(editing?'Cupón actualizado':'Cupón creado');setEditing(null);setForm(blankCoupon());refresh();}, onError:(error)=>toast.error('No se pudo guardar el cupón',errorDetail(error)) });
  const remove = useMutation({mutationFn:firmasService.deleteCuponFirma,onSuccess:refresh});
  const toggle = useMutation({mutationFn:(item:CuponFirma)=>firmasService.updateCuponFirma(item.id!,{active:!item.active}),onSuccess:refresh});
  const edit = (item:CuponFirma) => {setEditing(item.id!);setForm({...item});};
  const togglePrice = (id:number) => setForm({...form,prices:form.prices.includes(id)?form.prices.filter((item)=>item!==id):[...form.prices,id]});

  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
    <section className="space-y-4"><div><h2 className="flex items-center gap-2 text-lg font-black"><Ticket size={20} className="text-blue-700" /> {editing?'Editar cupón':'Nuevo cupón'}</h2><p className="mt-1 text-sm text-slate-500">Sin vigencias seleccionadas, el cupón aplica a todas.</p></div>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Código<input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value.toUpperCase()})} className={`${inputClass} mt-1 uppercase`} /></label><label className="text-sm font-semibold">Nombre<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className={`${inputClass} mt-1`} /></label></div>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Tipo<select value={form.discount_type} onChange={(e)=>setForm({...form,discount_type:e.target.value as CuponFirma['discount_type']})} className={`${inputClass} mt-1`}><option value="PERCENTAGE">Porcentaje</option><option value="FIXED_AMOUNT">Monto fijo</option></select></label><label className="text-sm font-semibold">Valor<input type="number" min="0.01" step="0.01" value={form.discount_value} onChange={(e)=>setForm({...form,discount_value:e.target.value})} className={`${inputClass} mt-1`} /></label></div>
      <div><p className="mb-2 text-sm font-semibold">Vigencias aplicables</p><div className="grid grid-cols-2 gap-2">{precios.map((price)=><label key={price.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" checked={form.prices.includes(price.id)} onChange={()=>togglePrice(price.id)}/>{price.validity_display}</label>)}</div></div>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Inicio<input type="date" value={form.start_date} onChange={(e)=>setForm({...form,start_date:e.target.value})} className={`${inputClass} mt-1`}/></label><label className="text-sm font-semibold">Fin<input type="date" value={form.end_date} onChange={(e)=>setForm({...form,end_date:e.target.value})} className={`${inputClass} mt-1`}/></label></div>
      <div className="grid grid-cols-3 gap-3"><label className="text-xs font-semibold">Compra mínima<input type="number" min="0" step="0.01" value={form.minimum_amount} onChange={(e)=>setForm({...form,minimum_amount:e.target.value})} className={`${inputClass} mt-1`}/></label><label className="text-xs font-semibold">Usos totales<input type="number" min="1" value={form.max_total_uses??''} placeholder="Sin límite" onChange={(e)=>setForm({...form,max_total_uses:e.target.value?Number(e.target.value):null})} className={`${inputClass} mt-1`}/></label><label className="text-xs font-semibold">Por cliente<input type="number" min="1" value={form.max_uses_per_customer} onChange={(e)=>setForm({...form,max_uses_per_customer:Number(e.target.value)})} className={`${inputClass} mt-1`}/></label></div>
      <div className="flex gap-2"><button onClick={()=>save.mutate()} disabled={save.isPending||!form.code||!form.name||!form.discount_value} className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{editing?'Actualizar cupón':'Crear cupón'}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(blankCoupon());}} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>}</div>
    </section>
    <section><h2 className="mb-4 text-lg font-black">Cupones creados</h2><div className="space-y-3">{!coupons.length&&<p className="border-y py-8 text-center text-sm text-slate-500">No hay cupones creados.</p>}{coupons.map((item)=><div key={item.id} className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><strong className="font-mono text-blue-800">{item.code}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.active?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{item.active?'Activo':'Inactivo'}</span></div><p className="text-sm text-slate-600">{item.name} · {item.discount_type==='PERCENTAGE'?`${item.discount_value}%`:money(item.discount_value)} · {item.usage_count??0} usos</p><p className="text-xs text-slate-400">{item.start_date} a {item.end_date}</p></div><div className="flex gap-2"><button onClick={()=>edit(item)} title="Editar" className="rounded-md border p-2 text-blue-700"><Edit2 size={15}/></button><button onClick={()=>toggle.mutate(item)} className="rounded-md border px-3 py-2 text-xs font-bold">{item.active?'Desactivar':'Activar'}</button><button onClick={()=>item.id&&remove.mutate(item.id)} title="Eliminar" className="rounded-md border border-red-200 p-2 text-red-600"><Trash2 size={15}/></button></div></div>)}</div></section>
  </div>;
}

export default function PreciosFirmaPage() {
  const qc = useQueryClient();
  const [tab,setTab]=useState<'prices'|'promotions'|'coupons'>('prices');
  const {data:precios=[],isLoading}=useQuery({queryKey:['precios-firma-admin'],queryFn:firmasService.listPreciosFirma});
  const {data:promociones=[]}=useQuery({queryKey:['promociones-firma-admin'],queryFn:firmasService.listPromocionesFirma});
  const {data:coupons=[]}=useQuery({queryKey:['cupones-firma-admin'],queryFn:firmasService.listCuponesFirma});
  const tabs = useMemo(()=>[{id:'prices',label:'Precios'},{id:'promotions',label:'Promociones'},{id:'coupons',label:'Cupones'}] as const,[]);
  const refresh=()=>{qc.invalidateQueries({queryKey:['precios-firma-admin']});qc.invalidateQueries({queryKey:['promociones-firma-admin']});qc.invalidateQueries({queryKey:['cupones-firma-admin']});};
  return <div className="space-y-6"><header className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold uppercase text-blue-700">Superadministración</p><h1 className="mt-1 text-2xl font-black">Precios, promociones y cupones</h1><p className="mt-1 text-sm text-slate-500">Gestiona los valores que se aplican a las solicitudes de firma electrónica.</p></div><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold"><RefreshCw size={16}/>Actualizar</button></header>
    <nav className="flex gap-6 border-b">{tabs.map((item)=><button key={item.id} onClick={()=>setTab(item.id)} className={`border-b-2 px-1 py-3 text-sm font-bold ${tab===item.id?'border-blue-700 text-blue-700':'border-transparent text-slate-500'}`}>{item.label}</button>)}</nav>
    {tab==='prices'&&(isLoading?<p className="py-10 text-center text-slate-500">Cargando precios...</p>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{precios.map((price)=><PriceEditor key={price.id} precio={price}/>)}</div>)}
    {tab==='promotions'&&<PromotionsPanel precios={precios} promociones={promociones}/>} {tab==='coupons'&&<CouponsPanel precios={precios} coupons={coupons}/>} </div>;
}
