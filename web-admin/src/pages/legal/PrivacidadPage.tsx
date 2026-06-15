import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function PrivacidadPage() {
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
            <ShieldCheck size={14} />
            Versión vigente: 16 de marzo de 2026
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Título */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <ShieldCheck size={12} /> Documento legal vigente
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Política de Privacidad</h1>
          <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
            En <strong>OF1 Solutions S.A.S.</strong> nos comprometemos a proteger los datos personales de nuestros
            usuarios conforme a la <strong>Ley Orgánica de Protección de Datos Personales</strong> (LOPDP) del Ecuador
            y su Reglamento. Esta política explica qué datos recopilamos, cómo los usamos y qué derechos le asisten.
          </p>
        </div>

        <div className="space-y-8 text-slate-700 text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">1</span>
              Responsable del tratamiento
            </h2>
            <ul className="list-none pl-0 space-y-1 text-slate-600">
              <li><strong>Razón social:</strong> OF1 Solutions S.A.S.</li>
              <li><strong>País:</strong> Ecuador</li>
              <li><strong>Correo de contacto:</strong>{' '}
                <a href="mailto:info@of1solutions.com" className="text-blue-600 hover:underline">info@of1solutions.com</a>
              </li>
              <li><strong>Teléfono:</strong>{' '}
                <a href="tel:+593995298989" className="text-blue-600 hover:underline">+593 99 529 8989</a>
              </li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">2</span>
              Datos que recopilamos
            </h2>
            <p className="mb-2">Recopilamos las siguientes categorías de datos:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li><strong>Datos de identificación:</strong> nombres, apellidos, cédula o RUC, razón social y nombre comercial.</li>
              <li><strong>Datos de contacto:</strong> correo electrónico, teléfono, ciudad y dirección.</li>
              <li><strong>Datos de acceso:</strong> contraseña almacenada con hash seguro (bcrypt), tokens de sesión.</li>
              <li><strong>Datos fiscales:</strong> RUC, tipo de contribuyente, establecimientos y puntos de emisión.</li>
              <li><strong>Certificado digital:</strong> archivo .p12 y su contraseña, almacenados cifrados en nuestros servidores y usados exclusivamente para firmar documentos electrónicos.</li>
              <li><strong>Datos de uso:</strong> registros de acceso, IP de origen, acciones en la plataforma (logs técnicos).</li>
              <li><strong>Datos de pago:</strong> no almacenamos números de tarjeta; el procesamiento se delega a pasarelas PCI-DSS certificadas.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">3</span>
              Finalidades del tratamiento
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li>Prestar el servicio de facturación electrónica y demás funcionalidades contratadas.</li>
              <li>Autenticar al usuario y garantizar la seguridad de la cuenta.</li>
              <li>Firmar electrónicamente documentos tributarios y transmitirlos al SRI.</li>
              <li>Gestionar la suscripción y el cobro del servicio.</li>
              <li>Enviar notificaciones transaccionales (verificación de correo, alertas de vencimiento, comprobantes).</li>
              <li>Cumplir obligaciones legales y requerimientos de autoridades competentes.</li>
              <li>Mejorar el servicio mediante análisis estadísticos anonimizados.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">4</span>
              Base de legitimación
            </h2>
            <p>
              El tratamiento se ampara en: (a) la ejecución del contrato de servicio aceptado al registrarse;
              (b) el cumplimiento de obligaciones legales (normativa tributaria del SRI); y (c) el interés legítimo
              de OF1 Solutions en garantizar la seguridad e integridad de la plataforma.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">5</span>
              Transferencia de datos a terceros
            </h2>
            <p className="mb-2">
              No vendemos ni cedemos sus datos a terceros con fines comerciales. Podemos compartir información con:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li><strong>SRI:</strong> transmisión de documentos electrónicos firmados, exigida por ley.</li>
              <li><strong>Proveedores de infraestructura:</strong> servidores en la nube (Railway, Neon, Cloudflare) bajo acuerdos de confidencialidad y cumplimiento normativo.</li>
              <li><strong>Servicio de correo transaccional:</strong> Resend.com, para el envío de códigos de verificación y notificaciones.</li>
              <li><strong>Autoridades competentes:</strong> cuando sea requerido por orden judicial o legal vigente en Ecuador.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">6</span>
              Plazo de conservación
            </h2>
            <p>
              Los datos se conservan mientras la cuenta esté activa y, una vez cancelada, durante el plazo mínimo
              de <strong>7 años</strong> exigido por la normativa tributaria ecuatoriana (art. 98 LRTI) para los
              documentos fiscales. Los logs técnicos se eliminan a los 12 meses.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">7</span>
              Seguridad de los datos
            </h2>
            <p>
              Implementamos medidas técnicas y organizativas adecuadas: cifrado TLS en tránsito, hashing de
              contraseñas con bcrypt, cifrado AES-256 para el certificado digital, acceso con doble factor
              opcional, y registros de auditoría. A pesar de ello, ningún sistema es 100 % seguro; en caso de
              brecha de seguridad que afecte sus datos, le notificaremos en los plazos previstos por la LOPDP.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">8</span>
              Sus derechos (ARCO + Portabilidad)
            </h2>
            <p className="mb-2">
              Conforme a los artículos 19–24 de la LOPDP, usted tiene derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
              <li><strong>Acceso:</strong> conocer qué datos personales suyos tratamos.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o desactualizados.</li>
              <li><strong>Cancelación/Eliminación:</strong> solicitar la supresión de sus datos cuando no sea requerida su conservación legal.</li>
              <li><strong>Oposición:</strong> oponerse al tratamiento en los casos previstos por ley.</li>
              <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado y de uso común (CSV/JSON).</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, envíe su solicitud con copia de su documento de identidad a{' '}
              <a href="mailto:info@of1solutions.com" className="text-blue-600 hover:underline font-semibold">
                info@of1solutions.com
              </a>. Responderemos en un plazo máximo de 15 días hábiles.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">9</span>
              Cookies y tecnologías similares
            </h2>
            <p>
              La plataforma utiliza almacenamiento local del navegador (<em>localStorage</em>) para mantener la
              sesión autenticada y las preferencias del usuario. No utilizamos cookies de rastreo publicitario
              de terceros.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">10</span>
              Autoridad de control
            </h2>
            <p>
              Si considera que sus derechos han sido vulnerados, puede presentar una reclamación ante la
              <strong> Superintendencia de Protección de Datos Personales</strong> del Ecuador, autoridad competente
              según el art. 65 de la LOPDP.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full text-xs flex items-center justify-center font-black shrink-0">11</span>
              Modificaciones a esta política
            </h2>
            <p>
              Podemos actualizar esta Política de Privacidad para reflejar cambios legales o en el servicio.
              Notificaremos cambios materiales al correo registrado con 15 días de anticipación.
              La versión vigente siempre estará disponible en esta página con su fecha de actualización.
            </p>
          </section>

        </div>

        {/* Footer de la página */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} OF1 Solutions S.A.S. — Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/terminos" className="hover:text-slate-700 transition-colors">Términos y condiciones</Link>
            <Link to="/" className="hover:text-slate-700 transition-colors">Página principal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
