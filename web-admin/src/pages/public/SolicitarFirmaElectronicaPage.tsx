import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRight, CheckCircle2, FileSignature, Loader2, Send, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { firmasService, type SolicitudFirma, type TipoSolicitudFirma } from '../../services/firmasService';

const baseForm: Partial<SolicitudFirma> = {
  request_type: 'PERSONA_NATURAL',
  first_name: '',
  last_name: '',
  identification: '',
  fingerprint_code: '',
  ruc: '',
  business_name: '',
  email: '',
  phone: '',
  province: '',
  city: '',
  address: '',
  validity: '1_ANIO',
  container_type: 'ARCHIVO',
  wants_erp: true,
  interested_plan: 'PROFESIONAL',
  source: 'LANDING',
  provider: 'UANATACA',
  internal_notes: '',
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

export default function SolicitarFirmaElectronicaPage() {
  const [form, setForm] = useState<Partial<SolicitudFirma>>(baseForm);
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState('');
  const [error, setError] = useState('');

  const setField = (field: keyof SolicitudFirma, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'wants_erp') {
        next.interested_plan = value ? 'PROFESIONAL' : 'SOLO_FIRMA';
      }
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await firmasService.createPublic(form);
      setSentMessage(result.mensaje);
      setForm(baseForm);
    } catch (err) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      setError(data ? JSON.stringify(data) : 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const isCompanyRequest = form.request_type === 'REPRESENTANTE_LEGAL' || form.request_type === 'MIEMBRO_EMPRESA';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="FacturaOF1 ERP" className="h-10 w-auto brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/solicitar-demo" className="hidden rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex">
              Ver demo del ERP
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
              <FileSignature size={14} />
              Firma electrónica
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Solicita tu firma electrónica para emitir comprobantes
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Este flujo es para clientes que necesitan gestionar la firma electrónica. Si también buscas sistema de facturación, puedes solicitar una demo del ERP.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                'Persona Natural, Representante Legal o Miembro de Empresa',
                'Vigencias desde 15 días hasta 5 años',
                'Acompañamiento para documentos y proveedor',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <span className="text-sm font-medium text-slate-200">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-blue-200">
                <ShieldCheck size={17} />
                Documentos sensibles protegidos
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Primero registramos la solicitud. Los documentos como cédula, selfie o nombramiento se cargan posteriormente por un canal protegido.
              </p>
            </div>
          </section>

          <form onSubmit={submit} className="rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-2xl shadow-blue-950/30 sm:p-7">
            <div className="mb-6">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Solicitud de firma</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Datos del solicitante</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Completa los datos principales para iniciar el contacto y validar requisitos.</p>
            </div>

            {sentMessage && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sentMessage}</div>}
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tipo de solicitud">
                <select className={inputClass} value={form.request_type} onChange={(e) => setField('request_type', e.target.value as TipoSolicitudFirma)}>
                  <option value="PERSONA_NATURAL">Persona Natural</option>
                  <option value="REPRESENTANTE_LEGAL">Representante Legal</option>
                  <option value="MIEMBRO_EMPRESA">Miembro de Empresa</option>
                </select>
              </Field>
              <Field label="Vigencia">
                <select className={inputClass} value={form.validity} onChange={(e) => setField('validity', e.target.value)}>
                  <option value="15_DIAS">15 días</option>
                  <option value="1_MES">1 mes</option>
                  <option value="1_ANIO">1 año</option>
                  <option value="2_ANIOS">2 años</option>
                  <option value="3_ANIOS">3 años</option>
                  <option value="4_ANIOS">4 años</option>
                  <option value="5_ANIOS">5 años</option>
                </select>
              </Field>
              <Field label="Nombres">
                <input required className={inputClass} placeholder="Nombres" value={form.first_name ?? ''} onChange={(e) => setField('first_name', e.target.value)} />
              </Field>
              <Field label="Apellidos">
                <input required className={inputClass} placeholder="Apellidos" value={form.last_name ?? ''} onChange={(e) => setField('last_name', e.target.value)} />
              </Field>
              <Field label="Cédula">
                <input required className={inputClass} placeholder="0102030405" value={form.identification ?? ''} onChange={(e) => setField('identification', e.target.value)} />
              </Field>
              <Field label="Código dactilar">
                <input required className={inputClass} placeholder="Código dactilar" value={form.fingerprint_code ?? ''} onChange={(e) => setField('fingerprint_code', e.target.value)} />
              </Field>
              {isCompanyRequest && (
                <>
                  <Field label="RUC empresa">
                    <input required className={inputClass} placeholder="1790012345001" value={form.ruc ?? ''} onChange={(e) => setField('ruc', e.target.value)} />
                  </Field>
                  <Field label="Razón social">
                    <input required className={inputClass} placeholder="Razón social" value={form.business_name ?? ''} onChange={(e) => setField('business_name', e.target.value)} />
                  </Field>
                </>
              )}
              <Field label="Correo">
                <input required type="email" className={inputClass} placeholder="correo@empresa.com" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
              </Field>
              <Field label="Celular">
                <input required className={inputClass} placeholder="09xxxxxxxx" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} />
              </Field>
              <Field label="Provincia">
                <input required className={inputClass} placeholder="Pichincha" value={form.province ?? ''} onChange={(e) => setField('province', e.target.value)} />
              </Field>
              <Field label="Ciudad">
                <input required className={inputClass} placeholder="Quito" value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Dirección">
                  <input required className={inputClass} placeholder="Dirección completa" value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <Field label="Contenedor">
                <select className={inputClass} value={form.container_type} onChange={(e) => setField('container_type', e.target.value)}>
                  <option value="ARCHIVO">Archivo</option>
                  <option value="NUBE">Nube</option>
                  <option value="TOKEN">Token</option>
                </select>
              </Field>
              <Field label="Interés">
                <select className={inputClass} value={form.interested_plan} onChange={(e) => setField('interested_plan', e.target.value)}>
                  <option value="SOLO_FIRMA">Solo firma</option>
                  <option value="BASICO">ERP Básico</option>
                  <option value="PROFESIONAL">ERP Profesional</option>
                  <option value="EMPRESARIAL">ERP Empresarial</option>
                </select>
              </Field>
              <label className="flex items-start gap-3 text-sm text-slate-700 md:col-span-2">
                <input type="checkbox" className="mt-1 rounded accent-blue-600" checked={Boolean(form.wants_erp)} onChange={(e) => setField('wants_erp', e.target.checked)} />
                <span>También quiero información de FacturaOF1 ERP</span>
              </label>
            </div>

            <button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/30 transition hover:bg-blue-500 disabled:opacity-60">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              Enviar solicitud de firma
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              ¿Quieres ver el sistema completo?{' '}
              <Link to="/solicitar-demo" className="font-semibold text-blue-600 hover:text-blue-700">
                Solicitar demo del ERP
              </Link>
              <ArrowRight size={12} className="ml-1 inline" />
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
