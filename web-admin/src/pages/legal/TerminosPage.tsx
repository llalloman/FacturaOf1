import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

const sections = [
  {
    title: 'Objeto del servicio',
    body: [
      'OF1 Solutions S.A.S. facilita la recepción, revisión y gestión de solicitudes de Firma Electrónica para personas naturales, miembros de empresa y representantes legales.',
      'La emisión final del certificado puede realizarse mediante proveedores autorizados, como Uanataca u otros prestadores relacionados con certificados electrónicos.',
    ],
  },
  {
    title: 'Proceso de solicitud',
    body: [
      'El solicitante debe completar el formulario, cargar documentos requeridos, revisar el resumen, aceptar los documentos legales y confirmar la solicitud.',
      'Al confirmar, se genera un número de solicitud para seguimiento, coordinación de pago y gestión interna.',
    ],
  },
  {
    title: 'Validación de identidad',
    body: [
      'La solicitud puede requerir validación de identidad mediante cédula, código dactilar, selfie, RUC, nombramientos, autorizaciones u otros documentos según el tipo de solicitante.',
      'OF1 Solutions S.A.S. y los proveedores autorizados podrán rechazar o solicitar correcciones cuando la información no sea suficiente, legible o consistente.',
    ],
  },
  {
    title: 'Responsabilidad del solicitante',
    body: [
      'El solicitante declara que la información ingresada es veraz, completa, actualizada y que cuenta con autorización para actuar en nombre propio o de la empresa indicada.',
      'El solicitante es responsable por errores, omisiones, documentos falsos, información desactualizada o uso indebido del certificado emitido.',
    ],
  },
  {
    title: 'Tiempos estimados',
    body: [
      'Los tiempos de procesamiento dependen de la completitud de los datos, validación documental, confirmación de pago, disponibilidad del proveedor y controles de identidad.',
      'Cualquier tiempo informado es referencial y puede variar cuando se requieran correcciones o validaciones adicionales.',
    ],
  },
  {
    title: 'Casos de rechazo',
    body: [
      'La solicitud puede ser rechazada por documentos ilegibles, datos inconsistentes, falta de autorización, imposibilidad de validar identidad, incumplimiento de requisitos del proveedor o requerimientos legales.',
      'En caso de rechazo, OF1 Solutions S.A.S. informará el motivo conocido y, cuando sea posible, las acciones correctivas.',
    ],
  },
  {
    title: 'Pagos y devoluciones',
    body: [
      'El trámite continúa una vez confirmado el pago por los canales habilitados. Los valores pueden variar según vigencia, promociones o cupones vigentes.',
      'Las devoluciones se evaluarán caso por caso. No aplican devoluciones cuando el certificado ya fue emitido, cuando el rechazo sea imputable a información falsa o incompleta del solicitante, o cuando el proveedor ya haya ejecutado procesos no reversibles.',
    ],
  },
  {
    title: 'Limitación de responsabilidad',
    body: [
      'OF1 Solutions S.A.S. no será responsable por rechazos derivados de información incorrecta, fallas de terceros, indisponibilidad de proveedores, demoras atribuibles al solicitante o decisiones de entidades certificadoras.',
      'La responsabilidad total, cuando legalmente corresponda, se limitará al valor pagado por la solicitud específica.',
    ],
  },
  {
    title: 'Protección de datos y terceros',
    body: [
      'El tratamiento de datos personales se rige por la Política de Privacidad vigente y la Ley Orgánica de Protección de Datos Personales de Ecuador.',
      'El solicitante autoriza compartir la información estrictamente necesaria con proveedores autorizados para la emisión y validación de certificados electrónicos.',
    ],
  },
  {
    title: 'Legislación aplicable',
    body: [
      'Estos términos se rigen por la legislación de la República del Ecuador. Cualquier controversia se procurará resolver de buena fe y, de ser necesario, ante las autoridades competentes ecuatorianas.',
    ],
  },
];

export default function TerminosPage() {
  return (
    <LegalShell version="firma-2026-06-22">
      <p className="text-sm leading-7 text-slate-600">
        Estos Términos y Condiciones regulan la solicitud, revisión y gestión de Firma Electrónica realizada por medio
        de FacturaOF1 y OF1 Solutions S.A.S.
      </p>
      <div className="mt-8 space-y-7">
        {sections.map((section, index) => (
          <section key={section.title}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
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

function LegalShell({ version, children }: { version: string; children: ReactNode }) {
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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            <FileText size={16} />
            Documento legal vigente
          </div>
          <h1 className="text-3xl font-black text-slate-950">Términos y Condiciones</h1>
          <p className="mt-2 text-xs font-semibold text-slate-400">Versión vigente: {version}</p>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>
        <footer className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} OF1 Solutions S.A.S.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/politica-privacidad" className="font-semibold hover:text-blue-700">Política de Privacidad</Link>
            <Link to="/solicitar-firma-electronica" className="font-semibold hover:text-blue-700">Solicitar firma electrónica</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
