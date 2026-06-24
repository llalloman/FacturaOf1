import { CheckCircle2, CreditCard, MessageCircle, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const whatsappBase = 'https://api.whatsapp.com/send/';

export default function FirmaPagoResultadoPage({ status }: { status: 'success' | 'cancelled' | 'error' }) {
  const [params] = useSearchParams();
  const requestNumber = params.get('request') || '';
  const transaction = params.get('transaction') || '';
  const isSuccess = status === 'success';
  const isCancelled = status === 'cancelled';
  const whatsappText = requestNumber
    ? `Hola, acabo de realizar el pago de la solicitud de firma ${requestNumber}.`
    : 'Hola, necesito ayuda con el pago de mi solicitud de firma electrónica.';
  const whatsappUrl = `${whatsappBase}?phone=593995298989&text=${encodeURIComponent(whatsappText)}&type=phone_number&app_absent=0`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="FacturaOF1 ERP" className="h-10 w-auto object-contain" />
          </Link>
          <Link to="/solicitar-firma-electronica" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Nueva solicitud
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
            {isSuccess ? <CheckCircle2 size={36} /> : <XCircle size={36} />}
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-blue-600">Pago PayPhone</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isSuccess ? 'Pago confirmado correctamente' : isCancelled ? 'Pago cancelado' : 'No pudimos confirmar el pago'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            {isSuccess
              ? 'Continuaremos con el proceso de emisión de tu firma electrónica. Si necesitamos validar algún documento adicional, te contactaremos por WhatsApp.'
              : isCancelled
                ? 'La transacción fue cancelada. Puedes volver a intentar el pago o comunicarte con nosotros para recibir asistencia.'
                : 'No se registró una aprobación válida de PayPhone. Si el banco debitó el valor, contáctanos para revisar la transacción.'}
          </p>

          {(requestNumber || transaction) && (
            <dl className="mx-auto mt-7 grid max-w-xl gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm sm:grid-cols-2">
              {requestNumber && (
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Solicitud</dt>
                  <dd className="mt-1 font-black text-slate-950">{requestNumber}</dd>
                </div>
              )}
              {transaction && (
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Transacción</dt>
                  <dd className="mt-1 break-all font-semibold text-slate-800">{transaction}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              <MessageCircle size={18} />
              Contactar por WhatsApp
            </a>
            {!isSuccess && (
              <Link to={`/solicitar-firma-electronica?request=${encodeURIComponent(requestNumber)}&transaction=${encodeURIComponent(transaction)}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">
                <CreditCard size={18} />
                Intentar nuevamente
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
