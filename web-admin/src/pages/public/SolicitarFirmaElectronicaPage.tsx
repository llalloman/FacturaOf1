import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileUp,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  firmasService,
  type DocumentoPublicoFirma,
  type SolicitudFirmaPublicPayload,
  type TipoSolicitudFirma,
} from '../../services/firmasService';

const whatsappBase = 'https://api.whatsapp.com/send/';

const baseForm: SolicitudFirmaPublicPayload = {
  request_type: 'PERSONA_NATURAL',
  identification_type: 'CEDULA',
  first_name: '',
  last_name: '',
  second_last_name: '',
  identification: '',
  fingerprint_code: '',
  birth_date: '',
  nationality: 'ECUATORIANA',
  gender: '',
  has_ruc: false,
  ruc: '',
  business_name: '',
  company_unit: '',
  applicant_position: '',
  request_reason: '',
  email: '',
  secondary_email: '',
  phone: '',
  secondary_phone: '',
  province: '',
  city: '',
  address: '',
  representative_identification_type: 'CEDULA',
  representative_identification: '',
  representative_names: '',
  representative_last_names: '',
  validity: '1_ANIO',
  container_type: 'ARCHIVO',
  wants_erp: false,
  interested_plan: 'SOLO_FIRMA',
  archivos: {},
};

const steps = ['Datos personales', 'Documentos', 'Resumen', 'Confirmacion'];

const tipoLabels: Record<TipoSolicitudFirma, string> = {
  PERSONA_NATURAL: 'Persona Natural',
  MIEMBRO_EMPRESA: 'Miembro de Empresa',
  REPRESENTANTE_LEGAL: 'Representante Legal',
};

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase text-slate-500';

type DocumentConfig = {
  key: DocumentoPublicoFirma;
  label: string;
  helper: string;
  required?: boolean;
};

const naturalDocs: DocumentConfig[] = [
  { key: 'cedula_anverso', label: 'Cedula frontal', helper: 'Foto del lado frontal. JPG o PNG.', required: true },
  { key: 'cedula_reverso', label: 'Cedula posterior', helper: 'Foto del lado posterior. JPG o PNG.', required: true },
  { key: 'selfie_cedula', label: 'Selfie', helper: 'Foto selfie con la cedula. JPG o PNG.', required: true },
  { key: 'documento_adicional', label: 'Documento adicional', helper: 'PDF, JPG o PNG.', required: false },
];

const companyDocs: DocumentConfig[] = [
  { key: 'cedula_anverso', label: 'Cedula frontal', helper: 'Foto del lado frontal. JPG o PNG.', required: true },
  { key: 'cedula_reverso', label: 'Cedula posterior', helper: 'Foto del lado posterior. JPG o PNG.', required: true },
  { key: 'selfie_cedula', label: 'Selfie', helper: 'Foto selfie con la cedula. JPG o PNG.', required: true },
  { key: 'ruc_pdf', label: 'RUC', helper: 'Archivo PDF del certificado del RUC.', required: true },
  { key: 'constitucion_compania', label: 'Constitucion de compania', helper: 'Archivo PDF de la constitucion.', required: true },
  { key: 'nombramiento_representante', label: 'Nombramiento', helper: 'PDF del nombramiento legalizado.', required: true },
  { key: 'aceptacion_nombramiento', label: 'Aceptacion de nombramiento', helper: 'PDF de aceptacion si no consta en el nombramiento.', required: false },
  { key: 'carta_autorizacion', label: 'Autorizacion', helper: 'PDF de autorizacion del representante legal.', required: true },
  { key: 'cedula_representante', label: 'Identificacion del representante legal', helper: 'PDF con ambos lados del documento.', required: true },
  { key: 'documento_adicional', label: 'Documento adicional', helper: 'PDF, JPG o PNG.', required: false },
];

const legalDocs: DocumentConfig[] = [
  { key: 'cedula_anverso', label: 'Cedula frontal', helper: 'Foto del lado frontal. JPG o PNG.', required: true },
  { key: 'cedula_reverso', label: 'Cedula posterior', helper: 'Foto del lado posterior. JPG o PNG.', required: true },
  { key: 'selfie_cedula', label: 'Selfie', helper: 'Foto selfie con la cedula. JPG o PNG.', required: true },
  { key: 'ruc_pdf', label: 'RUC', helper: 'Archivo PDF del certificado del RUC.', required: true },
  { key: 'constitucion_compania', label: 'Constitucion de compania', helper: 'Archivo PDF de la constitucion.', required: true },
  { key: 'nombramiento_representante', label: 'Nombramiento', helper: 'PDF del nombramiento legalizado.', required: true },
  { key: 'aceptacion_nombramiento', label: 'Aceptacion de nombramiento', helper: 'PDF de aceptacion si aplica.', required: false },
  { key: 'documento_adicional', label: 'Documento adicional', helper: 'PDF, JPG o PNG.', required: false },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export default function SolicitarFirmaElectronicaPage() {
  const [form, setForm] = useState<SolicitudFirmaPublicPayload>(baseForm);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<{ requestNumber: string; message: string } | null>(null);

  const isCompanyRequest = form.request_type === 'MIEMBRO_EMPRESA' || form.request_type === 'REPRESENTANTE_LEGAL';
  const isMemberRequest = form.request_type === 'MIEMBRO_EMPRESA';
  const documentConfig = useMemo(() => {
    if (form.request_type === 'MIEMBRO_EMPRESA') return companyDocs;
    if (form.request_type === 'REPRESENTANTE_LEGAL') return legalDocs;
    return naturalDocs;
  }, [form.request_type]);

  const setField = (field: keyof SolicitudFirmaPublicPayload, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'request_type') {
        next.archivos = {};
        next.has_ruc = value !== 'PERSONA_NATURAL';
      }
      return next;
    });
  };

  const setFile = (key: DocumentoPublicoFirma, file: File | null) => {
    setForm((prev) => ({
      ...prev,
      archivos: { ...(prev.archivos ?? {}), [key]: file },
    }));
  };

  const validateStep = () => {
    setError('');
    if (step === 0) {
      const required = [
        form.identification_type, form.first_name, form.last_name, form.identification,
        form.fingerprint_code, form.birth_date, form.nationality, form.gender,
        form.email, form.phone, form.province, form.city, form.address,
      ];
      if (isCompanyRequest) required.push(form.ruc, form.business_name, form.applicant_position);
      if (isMemberRequest) {
        required.push(
          form.company_unit,
          form.request_reason,
          form.representative_identification_type,
          form.representative_identification,
          form.representative_names,
          form.representative_last_names,
        );
      }
      if (required.some((value) => !value)) {
        setError('Completa los campos obligatorios para continuar.');
        return false;
      }
    }
    if (step === 1) {
      const missing = documentConfig.filter((doc) => doc.required && !form.archivos?.[doc.key]);
      if (missing.length) {
        setError(`Falta cargar: ${missing.map((item) => item.label).join(', ')}.`);
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (validateStep()) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const previous = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    setError('');
    try {
      const result = await firmasService.createPublic(form);
      setConfirmed({ requestNumber: result.request_number, message: result.mensaje });
      setStep(3);
    } catch (err) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      setError(data ? JSON.stringify(data) : 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = confirmed
    ? `${whatsappBase}?phone=593983904993&text=${encodeURIComponent(`Hola, he realizado la solicitud de firma numero ${confirmed.requestNumber}`)}&type=phone_number&app_absent=0`
    : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="FacturaOF1 ERP" className="h-10 w-auto" />
          </Link>
          <Link to="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-7">
          <p className="text-sm font-bold uppercase text-blue-600">Firma electronica</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Solicitud de firma electronica</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Completa los datos y documentos requeridos. Al finalizar recibiras un numero de solicitud para confirmar el pago por WhatsApp.
          </p>
        </section>

        <StepIndicator current={step} />

        <form onSubmit={submit} className="mt-7 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {step === 0 && (
            <div className="space-y-5">
              <StepTitle title="Paso 1 - Datos Personales" />
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Tipo de solicitud">
                  <select className={inputClass} value={form.request_type} onChange={(e) => setField('request_type', e.target.value as TipoSolicitudFirma)}>
                    <option value="PERSONA_NATURAL">Persona Natural</option>
                    <option value="MIEMBRO_EMPRESA">Miembro de Empresa</option>
                    <option value="REPRESENTANTE_LEGAL">Representante Legal</option>
                  </select>
                </Field>
                <Field label="Tipo de identificacion *">
                  <select className={inputClass} value={form.identification_type} onChange={(e) => setField('identification_type', e.target.value)}>
                    <option value="CEDULA">Cedula</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="RUC">RUC</option>
                  </select>
                </Field>
                <Field label="Identificacion *">
                  <input className={inputClass} value={form.identification ?? ''} onChange={(e) => setField('identification', e.target.value)} />
                </Field>
                <Field label="Codigo dactilar *">
                  <input className={inputClass} placeholder="EXXXXXIXXXX" value={form.fingerprint_code ?? ''} onChange={(e) => setField('fingerprint_code', e.target.value)} />
                </Field>
                <Field label="Nombres *">
                  <input className={inputClass} value={form.first_name ?? ''} onChange={(e) => setField('first_name', e.target.value)} />
                </Field>
                <Field label="1er Apellido *">
                  <input className={inputClass} value={form.last_name ?? ''} onChange={(e) => setField('last_name', e.target.value)} />
                </Field>
                <Field label="2do Apellido">
                  <input className={inputClass} value={form.second_last_name ?? ''} onChange={(e) => setField('second_last_name', e.target.value)} />
                </Field>
                <Field label="Fecha de nacimiento *">
                  <input type="date" className={inputClass} value={form.birth_date ?? ''} onChange={(e) => setField('birth_date', e.target.value)} />
                </Field>
                <Field label="Nacionalidad *">
                  <input className={inputClass} value={form.nationality ?? ''} onChange={(e) => setField('nationality', e.target.value)} />
                </Field>
                <Field label="Sexo *">
                  <select className={inputClass} value={form.gender ?? ''} onChange={(e) => setField('gender', e.target.value)}>
                    <option value="">Seleccione...</option>
                    <option value="HOMBRE">Hombre</option>
                    <option value="MUJER">Mujer</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </Field>
                <Field label="Telefono *">
                  <input className={inputClass} placeholder="09xxxxxxxx" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} />
                </Field>
                <Field label="Telefono 2">
                  <input className={inputClass} placeholder="09xxxxxxxx" value={form.secondary_phone ?? ''} onChange={(e) => setField('secondary_phone', e.target.value)} />
                </Field>
                <Field label="Correo electronico *">
                  <input type="email" className={inputClass} value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
                </Field>
                <Field label="Correo electronico 2">
                  <input type="email" className={inputClass} value={form.secondary_email ?? ''} onChange={(e) => setField('secondary_email', e.target.value)} />
                </Field>
                {!isCompanyRequest && (
                  <div className="md:col-span-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Con RUC?</p>
                    <div className="flex gap-5 text-sm text-slate-700">
                      <label className="flex items-center gap-2"><input type="radio" checked={Boolean(form.has_ruc)} onChange={() => setField('has_ruc', true)} /> Si</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={!form.has_ruc} onChange={() => setField('has_ruc', false)} /> No</label>
                    </div>
                  </div>
                )}
                {(isCompanyRequest || form.has_ruc) && (
                  <>
                    <Field label="Nro. RUC *">
                      <input className={inputClass} value={form.ruc ?? ''} onChange={(e) => setField('ruc', e.target.value)} />
                    </Field>
                    <Field label="Nombre empresa *">
                      <input className={inputClass} value={form.business_name ?? ''} onChange={(e) => setField('business_name', e.target.value)} />
                    </Field>
                  </>
                )}
                {isCompanyRequest && (
                  <Field label={form.request_type === 'REPRESENTANTE_LEGAL' ? 'Cargo *' : 'Cargo *'}>
                    <input className={inputClass} value={form.applicant_position ?? ''} onChange={(e) => setField('applicant_position', e.target.value)} />
                  </Field>
                )}
                {isMemberRequest && (
                  <>
                    <Field label="Unidad *">
                      <input className={inputClass} value={form.company_unit ?? ''} onChange={(e) => setField('company_unit', e.target.value)} />
                    </Field>
                    <Field label="Motivo *">
                      <input className={inputClass} value={form.request_reason ?? ''} onChange={(e) => setField('request_reason', e.target.value)} />
                    </Field>
                  </>
                )}
                <Field label="Provincia *">
                  <input className={inputClass} value={form.province ?? ''} onChange={(e) => setField('province', e.target.value)} />
                </Field>
                <Field label="Canton *">
                  <input className={inputClass} value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
                </Field>
                <Field label="Direccion *">
                  <input className={inputClass} value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
                </Field>
                {isMemberRequest && (
                  <>
                    <Field label="Tipo identificacion representante legal *">
                      <select className={inputClass} value={form.representative_identification_type ?? 'CEDULA'} onChange={(e) => setField('representative_identification_type', e.target.value)}>
                        <option value="CEDULA">Cedula</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="RUC">RUC</option>
                      </select>
                    </Field>
                    <Field label="Identificacion representante legal *">
                      <input className={inputClass} value={form.representative_identification ?? ''} onChange={(e) => setField('representative_identification', e.target.value)} />
                    </Field>
                    <Field label="Nombres representante legal *">
                      <input className={inputClass} value={form.representative_names ?? ''} onChange={(e) => setField('representative_names', e.target.value)} />
                    </Field>
                    <Field label="Apellidos representante legal *">
                      <input className={inputClass} value={form.representative_last_names ?? ''} onChange={(e) => setField('representative_last_names', e.target.value)} />
                    </Field>
                  </>
                )}
                <Field label="Vigencia">
                  <select className={inputClass} value={form.validity} onChange={(e) => setField('validity', e.target.value)}>
                    <option value="15_DIAS">15 dias</option>
                    <option value="1_MES">1 mes</option>
                    <option value="1_ANIO">1 anio</option>
                    <option value="2_ANIOS">2 anios</option>
                    <option value="3_ANIOS">3 anios</option>
                    <option value="4_ANIOS">4 anios</option>
                    <option value="5_ANIOS">5 anios</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <StepTitle title="Paso 2 - Documentos" />
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {documentConfig.map((doc) => (
                  <FileDrop
                    key={doc.key}
                    config={doc}
                    file={form.archivos?.[doc.key] ?? null}
                    onFile={(file) => setFile(doc.key, file)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepTitle title="Paso 3 - Resumen" />
              <div className="grid gap-4 lg:grid-cols-3">
                <SummaryBlock title="Solicitante" rows={[
                  ['Tipo', tipoLabels[form.request_type as TipoSolicitudFirma]],
                  ['Identificacion', `${form.identification_type}: ${form.identification}`],
                  ['Codigo dactilar', form.fingerprint_code],
                  ['Nombre', `${form.first_name} ${form.last_name} ${form.second_last_name ?? ''}`],
                  ['Nacimiento', form.birth_date],
                  ['Nacionalidad', form.nationality],
                  ['Sexo', form.gender],
                ]} />
                <SummaryBlock title="Contacto y ubicacion" rows={[
                  ['Telefono', form.phone],
                  ['Telefono 2', form.secondary_phone],
                  ['Correo', form.email],
                  ['Correo 2', form.secondary_email],
                  ['Provincia', form.province],
                  ['Canton', form.city],
                  ['Direccion', form.address],
                ]} />
                <SummaryBlock title="Empresa" rows={[
                  ['RUC', form.ruc],
                  ['Empresa', form.business_name],
                  ['Unidad', form.company_unit],
                  ['Cargo', form.applicant_position],
                  ['Motivo', form.request_reason],
                  ['Representante', `${form.representative_names ?? ''} ${form.representative_last_names ?? ''}`.trim()],
                ]} />
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-700">Documentos cargados</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {documentConfig.map((doc) => (
                    <div key={doc.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">{doc.label}</span>
                      <span className="truncate pl-3 text-slate-500">{form.archivos?.[doc.key]?.name ?? (doc.required ? 'Pendiente' : 'Opcional')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={34} />
              </div>
              <h2 className="text-2xl font-black text-slate-950">Solicitud registrada</h2>
              <p className="mt-3 text-sm text-slate-600">{confirmed?.message}</p>
              <p className="mt-4 text-3xl font-black text-blue-700">{confirmed?.requestNumber}</p>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                <MessageCircle size={18} />
                Contactar para confirmar pago
              </a>
            </div>
          )}

          {step < 3 && (
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
              <button type="button" onClick={previous} disabled={step === 0} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowLeft size={16} />
                Anterior
              </button>
              {step < 2 ? (
                <button type="button" onClick={next} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                  Siguiente
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Confirmar pedido
                </button>
              )}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((label, index) => {
        const active = index <= current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {index < current ? <Check size={15} /> : index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`h-1 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepTitle({ title }: { title: string }) {
  return <h2 className="text-lg font-bold text-slate-950">{title}</h2>;
}

function FileDrop({ config, file, onFile }: { config: DocumentConfig; file: File | null; onFile: (file: File | null) => void }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {config.label}{config.required ? ' *' : ''}
        <span className="ml-1 normal-case text-slate-400">{config.helper}</span>
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <div className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-blue-400 hover:bg-blue-50">
        {file ? (
          <>
            <CheckCircle2 className="mb-3 text-emerald-600" size={28} />
            <p className="max-w-full truncate text-sm font-bold text-slate-800">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </>
        ) : (
          <>
            <FileUp className="mb-3 text-blue-600" size={28} />
            <p className="text-sm font-bold text-slate-800">Arrastra el archivo para cargar</p>
            <p className="mt-1 text-xs text-slate-500">o clic aqui. Maximo 15 MB.</p>
          </>
        )}
      </div>
    </label>
  );
}

function SummaryBlock({ title, rows }: { title: string; rows: Array<[string, ReactNode]> }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-700">{title}</h3>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-l-2 border-blue-500 pl-3">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="break-words text-sm text-slate-800">{value || '-'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
