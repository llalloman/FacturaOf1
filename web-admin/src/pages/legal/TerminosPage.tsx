import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

const sections = [
  {
    title: 'Objeto del servicio',
    body: [
      'OF1 Solutions S.A.S. facilita la recepcion, revision y gestion de solicitudes de firma electronica para personas naturales, miembros de empresa y representantes legales.',
      'OF1 Solutions S.A.S. tambien ofrece un firmador PDF que permite cargar certificados digitales, firmar documentos, conservar documentos firmados cuando el usuario lo solicita y generar enlaces o codigos QR de validacion.',
      'La emision final de certificados puede realizarse mediante proveedores autorizados, como Uanataca u otros prestadores relacionados con certificados electronicos.',
    ],
  },
  {
    title: 'Proceso de solicitud de firma electronica',
    body: [
      'El solicitante debe completar el formulario, cargar documentos requeridos, revisar el resumen, aceptar los documentos legales y confirmar la solicitud.',
      'Al confirmar, se genera un numero de solicitud para seguimiento, coordinacion de pago y gestion interna.',
    ],
  },
  {
    title: 'Validacion de identidad',
    body: [
      'La solicitud puede requerir validacion de identidad mediante cedula, codigo dactilar, selfie, RUC, nombramientos, autorizaciones u otros documentos segun el tipo de solicitante.',
      'OF1 Solutions S.A.S. y los proveedores autorizados podran rechazar o solicitar correcciones cuando la informacion no sea suficiente, legible o consistente.',
    ],
  },
  {
    title: 'Responsabilidad del usuario',
    body: [
      'El usuario declara que la informacion ingresada es veraz, completa, actualizada y que cuenta con autorizacion para actuar en nombre propio o de la empresa indicada.',
      'El usuario es responsable por errores, omisiones, documentos falsos, informacion desactualizada o uso indebido del certificado emitido o cargado.',
      'En el firmador PDF, el usuario es responsable de la custodia legal de su certificado, de la confidencialidad de la contrasena del certificado, de la licitud de los documentos que carga y de la ubicacion o visibilidad de la firma insertada.',
    ],
  },
  {
    title: 'Uso del firmador PDF',
    body: [
      'El firmador PDF es una herramienta tecnologica para aplicar firmas electronicas sobre documentos proporcionados por el usuario. OF1 Solutions S.A.S. no revisa ni certifica el contenido juridico, comercial, laboral o tributario de los documentos cargados.',
      'El usuario debe verificar que el documento firmado, la pagina seleccionada, la posicion de la firma visible, el tipo de firma y los datos asociados correspondan a su intencion antes de usar o compartir el archivo resultante.',
      'Cuando el usuario elige firma con QR, acepta que el documento firmado sea conservado durante el periodo aplicable para permitir la validacion publica del enlace o codigo QR.',
    ],
  },
  {
    title: 'Certificados digitales y contrasenas',
    body: [
      'El usuario puede cargar certificados digitales en formato .p12 o .pfx para firmar documentos. Si decide guardar certificados en la plataforma, estos se almacenan cifrados.',
      'La contrasena del certificado se solicita para validar o ejecutar la firma y no debe ser compartida con terceros. OF1 Solutions S.A.S. no asume responsabilidad por el uso indebido derivado de claves reveladas por el usuario.',
    ],
  },
  {
    title: 'Almacenamiento, limites y conservacion',
    body: [
      'El servicio puede aplicar limites de tamano por archivo, almacenamiento total, cantidad de certificados, numero mensual de firmas y dias de retencion, segun configuracion, plan, promocion o politicas internas vigentes.',
      'Los documentos no guardados pueden descargarse al momento de la firma, pero no necesariamente quedaran disponibles para descarga posterior.',
      'Los documentos guardados pueden expirar, eliminarse o dejar de estar disponibles al cumplirse el periodo de retencion, por solicitud del usuario, por falta de espacio, por terminacion de la cuenta o por razones de seguridad o cumplimiento.',
    ],
  },
  {
    title: 'Validacion por QR o enlace',
    body: [
      'Los codigos QR o enlaces de validacion permiten consultar informacion basica del documento firmado, como estado, tipo de firma, fecha, hash y disponibilidad del archivo cuando aplique.',
      'El acceso al enlace de validacion no implica que OF1 Solutions S.A.S. avale el contenido del documento ni sustituye revisiones legales, tecnicas o periciales que puedan corresponder.',
    ],
  },
  {
    title: 'Tiempos estimados',
    body: [
      'Los tiempos de procesamiento dependen de la completitud de los datos, validacion documental, confirmacion de pago, disponibilidad del proveedor y controles de identidad.',
      'Cualquier tiempo informado es referencial y puede variar cuando se requieran correcciones o validaciones adicionales.',
    ],
  },
  {
    title: 'Pagos y devoluciones',
    body: [
      'El tramite continua una vez confirmado el pago por los canales habilitados. Los valores pueden variar segun vigencia, promociones, cupones, plan contratado o limites adicionales del servicio.',
      'Las devoluciones se evaluaran caso por caso. No aplican devoluciones cuando el certificado ya fue emitido, cuando el rechazo sea imputable a informacion falsa o incompleta del solicitante, o cuando el proveedor ya haya ejecutado procesos no reversibles.',
    ],
  },
  {
    title: 'Limitacion de responsabilidad',
    body: [
      'OF1 Solutions S.A.S. no sera responsable por rechazos derivados de informacion incorrecta, fallas de terceros, indisponibilidad de proveedores, demoras atribuibles al solicitante o decisiones de entidades certificadoras.',
      'En el firmador PDF, OF1 Solutions S.A.S. no sera responsable por documentos cargados por el usuario, perdida de validez por certificado revocado o vencido, uso no autorizado del certificado, seleccion incorrecta de firma visible, imposibilidad de validar servicios de terceros o interpretaciones legales del documento firmado.',
      'La responsabilidad total, cuando legalmente corresponda, se limitara al valor pagado por la solicitud o servicio especifico.',
    ],
  },
  {
    title: 'Suspension o restriccion del servicio',
    body: [
      'OF1 Solutions S.A.S. podra suspender, limitar o cancelar cuentas o accesos cuando detecte uso abusivo, fraudulento, contrario a la ley, riesgoso para la seguridad de la plataforma o contrario a estos terminos.',
    ],
  },
  {
    title: 'Proteccion de datos y terceros',
    body: [
      'El tratamiento de datos personales se rige por la Politica de Privacidad vigente y la Ley Organica de Proteccion de Datos Personales de Ecuador.',
      'El usuario autoriza compartir la informacion estrictamente necesaria con proveedores tecnologicos, proveedores autorizados para la emision o validacion de certificados electronicos, infraestructura de almacenamiento, correo transaccional, pasarelas de pago y autoridades competentes cuando corresponda por ley.',
    ],
  },
  {
    title: 'Legislacion aplicable',
    body: [
      'Estos terminos se rigen por la legislacion de la Republica del Ecuador. Cualquier controversia se procurara resolver de buena fe y, de ser necesario, ante las autoridades competentes ecuatorianas.',
    ],
  },
];

export default function TerminosPage() {
  return (
    <LegalShell version="terminos-2026-08-24">
      <p className="text-sm leading-7 text-slate-600">
        Estos Terminos y Condiciones regulan la solicitud, revision y gestion de firma electronica realizada por medio
        de FacturaOF1, el uso del firmador PDF y los servicios relacionados ofrecidos por OF1 Solutions S.A.S.
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
          <span className="hidden text-xs font-semibold text-slate-400 sm:inline">Version: {version}</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            <FileText size={16} />
            Documento legal vigente
          </div>
          <h1 className="text-3xl font-black text-slate-950">Terminos y Condiciones</h1>
          <p className="mt-2 text-xs font-semibold text-slate-400">Version vigente: {version}</p>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>
        <footer className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>(c) {new Date().getFullYear()} OF1 Solutions S.A.S.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/politica-privacidad" className="font-semibold hover:text-blue-700">Politica de Privacidad</Link>
            <Link to="/solicitar-firma-electronica" className="font-semibold hover:text-blue-700">Solicitar firma electronica</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
