import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  FileSignature,
  KeyRound,
  LogIn,
  QrCode,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';

const FEATURES = [
  {
    icon: KeyRound,
    title: 'Certificados protegidos',
    description: 'Guarda hasta dos certificados .p12 o .pfx cifrados. La clave no se almacena.',
  },
  {
    icon: FileSignature,
    title: 'Firma PDF',
    description: 'Firma documentos con marca visible, firma avanzada con datos del certificado o firma simple.',
  },
  {
    icon: QrCode,
    title: 'QR verificable',
    description: 'Genera un enlace público para confirmar documentos registrados en OF1 Firmador.',
  },
  {
    icon: FileCheck2,
    title: 'Historial',
    description: 'Guarda respaldos temporales, descarga documentos y controla tu almacenamiento.',
  },
];

const STEPS = [
  'Crea tu cuenta independiente de firmador.',
  'Sube tu certificado electrónico .p12 o .pfx.',
  'Selecciona el PDF, ubica la firma visible si aplica y descarga el documento firmado.',
];

export default function FirmadorLandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="OF1 Solutions" className="h-10 w-auto rounded-lg bg-white p-1.5" />
            <span className="hidden text-sm font-black text-white sm:inline">OF1 Firmador</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" />
              Ingresar
            </Link>
            <Link
              to="/firmador/registro"
              className="hidden rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-400 sm:inline-flex"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_82%_28%,rgba(16,185,129,0.20),transparent_34%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Firmador PDF de OF1 Solutions
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight tracking-tight text-white lg:text-6xl">
              Firma documentos PDF con tu certificado electrónico
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              OF1 Firmador te permite usar tu certificado .p12 o .pfx para firmar PDFs, agregar marca visible o QR verificable y mantener respaldo temporal de tus documentos.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/firmador/registro"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400"
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
              <a
                href="https://facturaof1.of1solutions.com/solicitar-firma-electronica"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 px-6 py-3.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/10"
              >
                Solicitar firma electrónica
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {['Firma simple o visible', 'QR de validación', 'Cuenta independiente'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30">
            <div className="rounded-2xl bg-white p-5 text-slate-900">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-blue-700">Documento listo</p>
                  <h2 className="mt-1 text-xl font-black">Contrato_servicios.pdf</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <UploadCloud className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="h-3 w-4/5 rounded-full bg-slate-200" />
                <div className="h-3 w-full rounded-full bg-slate-200" />
                <div className="h-3 w-3/5 rounded-full bg-slate-200" />
              </div>
              <div className="mt-20 flex justify-end">
                <div className="flex h-20 w-44 items-center justify-center rounded-lg border-2 border-blue-700 bg-blue-50 text-center text-sm font-black text-blue-800">
                  Firma visible
                  <br />
                  + QR
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric label="Certificado" value=".p12 / .pfx" />
              <Metric label="Validación" value="QR público" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-widest text-blue-700">Qué puedes hacer</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Un flujo simple para documentos firmados</h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-8 rounded-3xl bg-slate-950 p-6 text-white lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-emerald-300">Antes de empezar</p>
              <h2 className="mt-3 text-3xl font-black">Firma electrónica y firmador no son lo mismo</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                La firma electrónica es tu certificado. OF1 Firmador es la herramienta para aplicar ese certificado sobre documentos PDF.
              </p>
            </div>
            <div className="grid gap-3">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400 text-sm font-black text-slate-950">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm font-semibold text-slate-100">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} OF1 Solutions S.A.S. OF1 Firmador.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/terminos-y-condiciones" className="hover:text-white">Términos</Link>
            <Link to="/politica-privacidad" className="hover:text-white">Privacidad</Link>
            <a href="https://facturaof1.of1solutions.com" className="hover:text-white">FacturaOF1 ERP</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm font-black text-white">
        <BadgeCheck className="h-4 w-4 text-emerald-300" />
        {value}
      </div>
    </div>
  );
}
