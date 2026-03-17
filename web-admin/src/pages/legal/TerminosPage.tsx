import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <FileText size={14} />
            Versión vigente: 16 de marzo de 2026
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Título */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <FileText size={12} /> Documento legal vigente
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Términos y Condiciones de Uso</h1>
          <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
            Estos Términos y Condiciones regulan el uso del sistema de facturación electrónica <strong>OF1 Solutions</strong>,
            operado por <strong>OF1 Solutions S.A.S.</strong>, con domicilio en Ecuador.
            Al crear una cuenta o utilizar nuestros servicios, usted acepta quedar vinculado por estos términos.
          </p>
        </div>

        <div className="space-y-8 text-slate-700 text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">1</span>
              Definiciones
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li><strong>Plataforma:</strong> el sistema SaaS de facturación electrónica OF1 Solutions accesible en línea.</li>
              <li><strong>Usuario:</strong> toda persona natural o representante de persona jurídica que cree una cuenta en la plataforma.</li>
              <li><strong>Empresa:</strong> la razón social registrada por el usuario para emitir documentos electrónicos.</li>
              <li><strong>SRI:</strong> Servicio de Rentas Internas del Ecuador.</li>
              <li><strong>Documento electrónico:</strong> facturas, notas de crédito, notas de débito, retenciones y guías de remisión emitidos con firma electrónica y autorizados por el SRI.</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">2</span>
              Objeto del servicio
            </h2>
            <p>
              OF1 Solutions provee un sistema SaaS (Software as a Service) que permite a contribuyentes obligados o
              no obligados a llevar contabilidad, domiciliados en Ecuador, emitir documentos electrónicos conforme
              al Reglamento de Comprobantes de Venta, Retención y Documentos Complementarios (RCVRDC),
              la Resolución NAC-DGERCGC16-00000247 y demás normativa emitida por el SRI.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">3</span>
              Condiciones de uso
            </h2>
            <p className="mb-2">El usuario se compromete a:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li>Proporcionar información veraz, completa y vigente al registrarse y al configurar su empresa.</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>Utilizar el sistema exclusivamente para actividades lícitas y conformes a la legislación ecuatoriana.</li>
              <li>No intentar eludir, desactivar o interferir con las medidas de seguridad de la plataforma.</li>
              <li>No reproducir, vender, revender ni explotar con fines comerciales, sin autorización expresa, ninguna parte del servicio.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">4</span>
              Registro y cuenta
            </h2>
            <p className="mb-2">
              Para acceder al servicio es necesario registrar una cuenta con datos precisos. El usuario es responsable
              de todas las actividades realizadas bajo su cuenta. OF1 Solutions se reserva el derecho de suspender o
              cancelar cuentas que:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li>Presenten información falsa o errónea.</li>
              <li>Realicen actividades que vulneren estos términos o la ley ecuatoriana.</li>
              <li>Permanezcan inactivas por más de 12 meses consecutivos en plan gratuito.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">5</span>
              Suscripción y pagos
            </h2>
            <p className="mb-2">
              OF1 Solutions ofrece un período de prueba gratuito de 30 días con acceso completo a las funcionalidades.
              Transcurrido dicho período, el usuario debe contratar un plan de suscripción pago para continuar emitiendo
              documentos electrónicos.
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li>Los precios publicados no incluyen IVA (12%), salvo indicación expresa.</li>
              <li>Los pagos se procesan mediante los métodos habilitados en la plataforma.</li>
              <li>Las suscripciones se renuevan automáticamente al vencimiento, salvo cancelación previa.</li>
              <li>No se realizan devoluciones de períodos ya consumidos, salvo fallo técnico imputable a OF1 Solutions.</li>
              <li>OF1 Solutions puede modificar los precios con un aviso previo de al menos 30 días a los usuarios activos.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">6</span>
              Responsabilidades del usuario ante el SRI
            </h2>
            <p className="mb-2">
              El usuario es el único obligado tributario ante el SRI. OF1 Solutions actúa como proveedor tecnológico
              y no asume responsabilidad por:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li>Errores en la información tributaria ingresada por el usuario (RUC, porcentajes de retención, etc.).</li>
              <li>La no autorización de documentos por parte del SRI debido a datos incorrectos.</li>
              <li>Multas, intereses o sanciones derivadas del incumplimiento de obligaciones tributarias del usuario.</li>
              <li>El vencimiento o revocación del certificado digital (.p12) suministrado por el usuario.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">7</span>
              Disponibilidad del servicio
            </h2>
            <p>
              OF1 Solutions procura una disponibilidad del 99 % mensual. Sin embargo, no garantiza disponibilidad
              ininterrumpida. No seremos responsables por interrupciones causadas por mantenimiento programado
              (notificado con anticipación), fallas en los servicios del SRI, cortes de conectividad de terceros,
              fuerza mayor o caso fortuito conforme al artículo 1755 del Código Civil ecuatoriano.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">8</span>
              Propiedad intelectual
            </h2>
            <p>
              Todo el software, diseño, logotipos, textos y contenidos de la plataforma son propiedad exclusiva de
              OF1 Solutions S.A.S. y están protegidos por la Ley de Propiedad Intelectual del Ecuador (Codificación
              No. 2006‑013) y los tratados internacionales vigentes. Queda prohibida su reproducción total o parcial
              sin autorización escrita.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">9</span>
              Protección de datos personales
            </h2>
            <p>
              El tratamiento de datos personales se rige por la <strong>Ley Orgánica de Protección de Datos Personales</strong>
              (LOPDP, publicada en el R.O. Suplemento 459 del 26 de mayo de 2021) y su Reglamento. Para mayor
              detalle, consulte nuestra{' '}
              <Link to="/privacidad" className="text-blue-600 hover:underline font-semibold">
                Política de Privacidad
              </Link>.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">10</span>
              Limitación de responsabilidad
            </h2>
            <p>
              En la máxima medida permitida por la ley ecuatoriana, la responsabilidad total de OF1 Solutions por
              cualquier daño relacionado con el uso del servicio no excederá el valor pagado por el usuario en los
              3 meses anteriores al evento que originó el reclamo. En ningún caso seremos responsables por
              daños indirectos, incidentales, lucro cesante o pérdida de datos, salvo dolo o culpa grave.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">11</span>
              Modificaciones a los términos
            </h2>
            <p>
              OF1 Solutions puede actualizar estos Términos en cualquier momento. Las modificaciones sustanciales
              serán notificadas al correo electrónico registrado con al menos 15 días de anticipación.
              El uso continuado del servicio tras la fecha de vigencia implica la aceptación de los nuevos términos.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">12</span>
              Ley aplicable y jurisdicción
            </h2>
            <p>
              Estos Términos se rigen por las leyes de la República del Ecuador. Cualquier controversia que no
              pueda resolverse amigablemente se someterá a los jueces y tribunales competentes de la ciudad de
              Quito, Distrito Metropolitano, con renuncia expresa a cualquier otro fuero que pudiera corresponder.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">13</span>
              Contacto
            </h2>
            <p>
              Para consultas relacionadas con estos Términos, contáctenos en:{' '}
              <a href="mailto:info@of1solutions.com" className="text-blue-600 hover:underline font-semibold">
                info@of1solutions.com
              </a>{' '}
              o al teléfono <a href="tel:+593983904993" className="text-blue-600 hover:underline font-semibold">+593 98 390 4993</a>.
            </p>
          </section>

        </div>

        {/* Footer de la página */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} OF1 Solutions S.A.S. — Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacidad" className="hover:text-slate-700 transition-colors">Política de privacidad</Link>
            <Link to="/" className="hover:text-slate-700 transition-colors">Página principal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
