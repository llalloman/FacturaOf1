import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: 'Responsable del tratamiento',
    body: [
      'OF1 Solutions S.A.S., domiciliada en Ecuador, es responsable del tratamiento de los datos personales recopilados en FacturaOF1 y en el portal de solicitud de firma electrónica.',
      'Contacto para privacidad: info@of1solutions.com. Teléfono: +593 99 529 8989.',
    ],
  },
  {
    title: 'Datos recopilados',
    body: [
      'Para la solicitud de firma electrónica recopilamos cédula o identificación, nombres y apellidos, código dactilar, fecha de nacimiento, nacionalidad, sexo, correo electrónico, celular, dirección, provincia, ciudad, parroquia o ubicación declarada, RUC, información empresarial y documentos cargados por el solicitante.',
      'También registramos datos técnicos de auditoría como IP, User-Agent, fecha y hora de aceptación de documentos legales.',
    ],
  },
  {
    title: 'Finalidad del tratamiento',
    body: [
      'Usamos la información para gestionar la solicitud, validar identidad, revisar documentación, emitir o coordinar la emisión de certificados electrónicos, informar el estado del trámite, cumplir obligaciones legales y mantener evidencia auditable del consentimiento.',
    ],
  },
  {
    title: 'Uso y conservación',
    body: [
      'Los datos se usan únicamente para fines relacionados con la prestación del servicio, soporte, cumplimiento normativo y trazabilidad interna.',
      'La información se conserva durante el tiempo necesario para atender la solicitud y cumplir obligaciones legales, tributarias, contractuales y de auditoría aplicables en Ecuador.',
    ],
  },
  {
    title: 'Terceros autorizados',
    body: [
      'Podemos compartir información estrictamente necesaria con proveedores autorizados para la emisión de certificados electrónicos, incluyendo Uanataca u otros proveedores relacionados, así como servicios tecnológicos de almacenamiento, correo transaccional, infraestructura y autoridades competentes cuando corresponda por ley.',
      'OF1 Solutions S.A.S. no vende datos personales a terceros.',
    ],
  },
  {
    title: 'Derechos del titular',
    body: [
      'El titular puede solicitar acceso, rectificación, actualización, eliminación, oposición, suspensión del tratamiento y portabilidad de sus datos conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador.',
      'Para ejercer estos derechos, debe escribir a info@of1solutions.com adjuntando información que permita verificar su identidad y describiendo claramente la solicitud.',
    ],
  },
  {
    title: 'Seguridad',
    body: [
      'Aplicamos controles razonables de seguridad, acceso restringido y registros de auditoría para proteger la información. Ningún sistema es completamente infalible, pero adoptamos medidas orientadas a reducir riesgos de acceso no autorizado, pérdida o alteración.',
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalShell
      icon={<ShieldCheck size={16} />}
      badge="Documento legal vigente"
      title="Política de Privacidad"
      version="privacidad-2026-06-22"
      tone="emerald"
    >
      <p className="text-sm leading-7 text-slate-600">
        Esta política explica cómo OF1 Solutions S.A.S. trata datos personales en FacturaOF1 y, de forma especial,
        en el proceso de solicitud de Firma Electrónica, conforme a la Ley Orgánica de Protección de Datos Personales
        de Ecuador.
      </p>
      <div className="mt-8 space-y-7">
        {sections.map((section, index) => (
          <section key={section.title}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                {index + 1}
              </span>
              {section.title}
            </h2>
            <div className="space-y-2 text-sm leading-7 text-slate-600">
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
    </LegalShell>
  );
}

function LegalShell({
  icon,
  badge,
  title,
  version,
  tone,
  children,
}: {
  icon: ReactNode;
  badge: string;
  title: string;
  version: string;
  tone: 'emerald' | 'blue';
  children: ReactNode;
}) {
  const badgeClass = tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700';
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
          <div className="flex-1" />
          <span className="hidden text-xs font-semibold text-slate-400 sm:inline">Versión: {version}</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${badgeClass}`}>
            {icon}
            {badge}
          </div>
          <h1 className="text-3xl font-black text-slate-950">{title}</h1>
          <p className="mt-2 text-xs font-semibold text-slate-400">Versión vigente: {version}</p>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>
        <footer className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} OF1 Solutions S.A.S.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/terminos-y-condiciones" className="font-semibold hover:text-blue-700">Términos y Condiciones</Link>
            <Link to="/solicitar-firma-electronica" className="font-semibold hover:text-blue-700">Solicitar firma electrónica</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
