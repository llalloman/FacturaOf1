import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BarChart3, Loader2, MonitorPlay, PackageCheck, ReceiptText, Send, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { firmasService, type SolicitudDemoERP } from '../../services/firmasService';

const baseForm: SolicitudDemoERP = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  city: '',
  business_type: '',
  interested_plan: 'PROFESIONAL',
  needs_signature: false,
  already_has_signature: false,
  message: '',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export default function SolicitarDemoPage() {
  const [form, setForm] = useState<SolicitudDemoERP>(baseForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const setField = <K extends keyof SolicitudDemoERP>(field: K, value: SolicitudDemoERP[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await firmasService.createDemoPublic(form);
      setMessage(result.mensaje);
      setForm(baseForm);
    } catch (err) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      setError(data ? JSON.stringify(data) : 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="FacturaOF1 ERP" className="h-10 w-auto brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/solicitar-firma-electronica" className="hidden rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex">
              Solo firma electrónica
            </Link>
            <Link to="/" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-700/30 transition hover:bg-blue-500">
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
          <section className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-200">
              <MonitorPlay size={14} />
              Demo del ERP
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Mira cómo FacturaOF1 ERP puede ordenar tu facturación y tu operación
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Agenda una demostración enfocada en tu negocio. Revisamos facturación electrónica SRI, POS, inventario, clientes, cartera y reportes.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                { icon: ReceiptText, title: 'Facturación SRI', desc: 'Comprobantes electrónicos y control de estados.' },
                { icon: ShoppingCart, title: 'Ventas y POS', desc: 'Flujos para caja, pedidos y ventas directas.' },
                { icon: PackageCheck, title: 'Inventario', desc: 'Productos, stock y operación diaria.' },
                { icon: BarChart3, title: 'Reportes', desc: 'Métricas para decidir con datos.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <item.icon className="mb-3 h-5 w-5 text-blue-300" />
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-bold text-emerald-200">Firma electrónica sin confusión</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                El ERP incluye facturación electrónica. Si aún no tienes firma, lo revisamos durante la demo y te guiamos por el proceso correcto.
              </p>
            </div>
          </section>

          <form onSubmit={submit} className="rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-2xl shadow-blue-950/30 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Solicitud de demo</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Datos para agendar</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Un asesor revisará tu operación y coordinará la demostración.</p>
              </div>
            </div>

            {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Negocio">
                <input required className={inputClass} placeholder="Ej. Minimarket Central" value={form.business_name} onChange={(e) => setField('business_name', e.target.value)} />
              </Field>
              <Field label="Contacto">
                <input required className={inputClass} placeholder="Nombre y apellido" value={form.contact_name} onChange={(e) => setField('contact_name', e.target.value)} />
              </Field>
              <Field label="Correo">
                <input required type="email" className={inputClass} placeholder="correo@empresa.com" value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </Field>
              <Field label="Celular">
                <input required className={inputClass} placeholder="09xxxxxxxx" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
              </Field>
              <Field label="Ciudad">
                <input className={inputClass} placeholder="Quito, Guayaquil, Cuenca..." value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
              </Field>
              <Field label="Tipo de negocio">
                <input className={inputClass} placeholder="Tienda, restaurante, servicios..." value={form.business_type ?? ''} onChange={(e) => setField('business_type', e.target.value)} />
              </Field>
              <Field label="Plan de interés">
                <select className={`${inputClass} md:col-span-2`} value={form.interested_plan} onChange={(e) => setField('interested_plan', e.target.value as SolicitudDemoERP['interested_plan'])}>
                  <option value="PROFESIONAL">Profesional</option>
                  <option value="BASICO">Básico</option>
                  <option value="EMPRESARIAL">Empresarial</option>
                  <option value="NO_SEGURO">No estoy seguro, necesito asesoría</option>
                </select>
              </Field>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-1 rounded accent-blue-600" checked={form.already_has_signature} onChange={(e) => setField('already_has_signature', e.target.checked)} />
                <span>Ya tengo firma electrónica</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-1 rounded accent-blue-600" checked={form.needs_signature} onChange={(e) => setField('needs_signature', e.target.checked)} />
                <span>Necesito ayuda con firma electrónica</span>
              </label>
            </div>

            <Field label="Necesidad principal">
              <textarea className={`${inputClass} mt-1 min-h-28 resize-none`} placeholder="Cuéntanos qué necesitas vender, facturar o controlar" value={form.message ?? ''} onChange={(e) => setField('message', e.target.value)} />
            </Field>

            <button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/30 transition hover:bg-blue-500 disabled:opacity-60">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              Solicitar demostración del ERP
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              ¿Solo necesitas firma electrónica?{' '}
              <Link to="/solicitar-firma-electronica" className="font-semibold text-blue-600 hover:text-blue-700">
                Ir al formulario de firma
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
