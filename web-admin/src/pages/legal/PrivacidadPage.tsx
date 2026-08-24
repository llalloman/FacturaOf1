import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: 'Responsable del tratamiento',
    body: [
      'OF1 Solutions S.A.S., domiciliada en Ecuador, es responsable del tratamiento de los datos personales recopilados en FacturaOF1, en el portal de solicitud de firma electronica y en el servicio OF1 Firmador.',
      'Contacto para privacidad: info@of1solutions.com. Telefono: +593 99 529 8989.',
    ],
  },
  {
    title: 'Datos recopilados',
    body: [
      'Para la solicitud de firma electronica recopilamos identificacion, nombres y apellidos, codigo dactilar, fecha de nacimiento, nacionalidad, sexo, correo electronico, celular, direccion, ubicacion declarada, RUC, informacion empresarial y documentos cargados por el solicitante.',
      'Para OF1 Firmador recopilamos datos de cuenta, correo electronico, nombres, apellidos, identificacion cuando se proporcione, documentos PDF cargados para firma o validacion, metadatos de documentos firmados, certificados digitales cuando el usuario decide guardarlos, hashes, fechas de firma, tipo de firma, posicion visible, enlaces o tokens de validacion y datos de uso del servicio.',
      'Tambien registramos datos tecnicos y de auditoria como IP, User-Agent, fecha y hora de aceptacion de documentos legales, registros de acceso, operaciones realizadas, errores tecnicos y eventos necesarios para seguridad y trazabilidad.',
    ],
  },
  {
    title: 'Finalidades del tratamiento',
    body: [
      'Usamos la informacion para gestionar solicitudes, validar identidad, revisar documentacion, emitir o coordinar la emision de certificados electronicos, informar estados, prestar soporte, cumplir obligaciones legales y mantener evidencia auditable del consentimiento.',
      'En OF1 Firmador usamos los datos para crear y administrar cuentas de firmador, validar certificados, firmar PDFs, permitir descargas, conservar documentos cuando el usuario lo solicita, generar QR o enlaces de validacion, controlar limites de uso, prevenir abusos y resolver incidencias tecnicas.',
    ],
  },
  {
    title: 'Certificados digitales y contrasenas',
    body: [
      'Los certificados .p12 o .pfx que el usuario decide guardar se almacenan cifrados y asociados a su cuenta o workspace de firmador.',
      'La contrasena del certificado se usa para validar el certificado o ejecutar la firma solicitada. OF1 Solutions S.A.S. no debe almacenar dicha contrasena como dato persistente.',
      'El usuario puede eliminar certificados guardados desde la plataforma. La eliminacion desactiva el certificado para usos futuros y puede conservar metadatos minimos para auditoria.',
    ],
  },
  {
    title: 'Documentos PDF y codigos QR',
    body: [
      'Los PDFs cargados pueden contener datos personales, comerciales, tributarios, laborales o informacion confidencial del usuario o de terceros. El usuario debe contar con base legal o autorizacion suficiente para cargarlos y firmarlos.',
      'Cuando el usuario decide guardar un documento firmado, el archivo puede almacenarse en infraestructura propia o de proveedores tecnologicos, incluyendo almacenamiento compatible con objetos como Cloudflare R2 u otros servicios equivalentes.',
      'Cuando se genera una firma con QR, el enlace de validacion puede mostrar informacion basica del documento firmado, como estado, tipo de firma, fecha, hash, nombre del archivo y disponibilidad del documento. El QR no debe revelar la contrasena del certificado ni el contenido completo del PDF salvo que el documento este disponible para descarga mediante el enlace correspondiente.',
    ],
  },
  {
    title: 'Base legal y consentimiento',
    body: [
      'El tratamiento se realiza con base en la ejecucion de la relacion contractual o precontractual, el consentimiento del titular cuando corresponda, el cumplimiento de obligaciones legales, la seguridad de la plataforma y el interes legitimo compatible con la prestacion del servicio.',
      'Al registrarse en OF1 Firmador, el usuario acepta los Terminos y Condiciones y autoriza el tratamiento de sus datos personales conforme a esta politica. La plataforma registra evidencia de aceptacion, version legal, IP, User-Agent, fecha y origen.',
    ],
  },
  {
    title: 'Conservacion y eliminacion',
    body: [
      'Los datos se conservan durante el tiempo necesario para prestar el servicio, cumplir obligaciones legales, tributarias, contractuales, de soporte, seguridad y auditoria aplicables en Ecuador.',
      'Los documentos firmados guardados se conservan segun la retencion elegida, el limite maximo configurado, el plan aplicable o las reglas vigentes del servicio. Al expirar o eliminarse, pueden dejar de estar disponibles para descarga o validacion completa.',
      'Los metadatos, hashes, evidencia legal y registros de auditoria pueden conservarse por periodos mayores cuando sean necesarios para trazabilidad, seguridad, defensa de derechos o cumplimiento normativo.',
    ],
  },
  {
    title: 'Terceros autorizados y proveedores',
    body: [
      'Podemos compartir informacion estrictamente necesaria con proveedores autorizados para la emision o validacion de certificados electronicos, servicios tecnologicos de almacenamiento, correo transaccional, infraestructura, seguridad, analitica operativa, pasarelas de pago y autoridades competentes cuando corresponda por ley.',
      'OF1 Solutions S.A.S. no vende datos personales a terceros.',
    ],
  },
  {
    title: 'Seguridad',
    body: [
      'Aplicamos controles razonables de seguridad, cifrado cuando corresponde, acceso restringido, separacion por usuarios o espacios de trabajo, registros de auditoria y medidas orientadas a reducir riesgos de acceso no autorizado, perdida, alteracion o divulgacion.',
      'Ningun sistema es completamente infalible. El usuario debe proteger sus credenciales, su correo, su certificado digital y la contrasena de su certificado.',
    ],
  },
  {
    title: 'Derechos del titular',
    body: [
      'El titular puede solicitar acceso, rectificacion, actualizacion, eliminacion, oposicion, suspension del tratamiento y portabilidad de sus datos conforme a la Ley Organica de Proteccion de Datos Personales de Ecuador.',
      'Para ejercer estos derechos, debe escribir a info@of1solutions.com adjuntando informacion que permita verificar su identidad y describiendo claramente la solicitud.',
    ],
  },
  {
    title: 'Reclamos y cambios de la politica',
    body: [
      'El titular puede presentar reclamos ante OF1 Solutions S.A.S. y, cuando corresponda, ante la Autoridad de Proteccion de Datos Personales de Ecuador.',
      'Esta politica puede actualizarse para reflejar cambios normativos, tecnicos o funcionales. La version vigente se publicara en la plataforma.',
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalShell
      icon={<ShieldCheck size={16} />}
      badge="Documento legal vigente"
      title="Politica de Privacidad"
      version="privacidad-2026-08-24"
      tone="blue"
    >
      <p className="text-sm leading-7 text-slate-600">
        Esta politica explica como OF1 Solutions S.A.S. trata datos personales en FacturaOF1, en la solicitud de
        firma electronica y en OF1 Firmador, conforme a la Ley Organica de Proteccion de Datos Personales de Ecuador.
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

function LegalShell({
  icon,
  badge,
  title,
  version,
  children,
}: {
  icon: ReactNode;
  badge: string;
  title: string;
  version: string;
  tone: 'blue';
  children: ReactNode;
}) {
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
            {icon}
            {badge}
          </div>
          <h1 className="text-3xl font-black text-slate-950">{title}</h1>
          <p className="mt-2 text-xs font-semibold text-slate-400">Version vigente: {version}</p>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>
        <footer className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>(c) {new Date().getFullYear()} OF1 Solutions S.A.S.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/terminos-y-condiciones" className="font-semibold hover:text-blue-700">Terminos y Condiciones</Link>
            <Link to="/solicitar-firma-electronica" className="font-semibold hover:text-blue-700">Solicitar firma electronica</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
