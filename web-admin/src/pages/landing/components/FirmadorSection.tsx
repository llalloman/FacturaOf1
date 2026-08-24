import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  FileSignature,
  KeyRound,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

const FIRMADOR_FEATURES = [
  {
    icon: KeyRound,
    title: 'Usa tu certificado',
    description: 'Sube certificados .p12 o .pfx, valida la clave y firma PDFs sin depender de herramientas externas.',
  },
  {
    icon: FileSignature,
    title: 'Firma visible o simple',
    description: 'Elige firma sin marca visible, firma avanzada con datos del certificado o firma visible con QR.',
  },
  {
    icon: QrCode,
    title: 'QR verificable',
    description: 'Genera enlaces de validación pública para confirmar que el documento fue registrado en OF1 Firmador.',
  },
  {
    icon: FileCheck2,
    title: 'Historial y respaldo',
    description: 'Guarda copias firmadas por un período definido y descarga documentos cuando los necesites.',
  },
];

export default function FirmadorSection() {
  return (
    <section id="firmador" className="bg-slate-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              OF1 Firmador
            </div>
            <h2 className="mt-5 text-4xl font-black tracking-tight text-white lg:text-5xl">
              Firma, guarda y valida documentos PDF dentro del ecosistema FacturaOF1
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              La firma electrónica es el certificado que necesitas para operar; OF1 Firmador es la herramienta para usarlo en documentos PDF, generar QR verificable y mantener trazabilidad.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/firmador/registro"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
              >
                Crear cuenta de firmador
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Ingresar al firmador
              </Link>
              <Link
                to="/solicitar-firma-electronica"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 px-6 py-3.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/10"
              >
                Solicitar firma electrónica
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              OF1 Solutions desarrolla el ecosistema. FacturaOF1 ERP ordena la operación. OF1 Firmador gestiona documentos PDF firmados.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FIRMADOR_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.description}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 sm:col-span-2">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                <p className="text-sm leading-relaxed text-emerald-50">
                  Para emitir comprobantes electrónicos necesitas una firma electrónica activa. Para firmar contratos, anexos o documentos PDF, usa OF1 Firmador con ese certificado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
