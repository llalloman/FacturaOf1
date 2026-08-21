import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Download, FileCheck2, FileSignature, Loader2, ShieldCheck } from 'lucide-react';
import { firmadorService } from '../../services/firmadorService';

const shortHash = (hash?: string) => {
  if (!hash) return 'No disponible';
  return `${hash.slice(0, 16)}...${hash.slice(-12)}`;
};

export default function ValidarDocumentoPublicoPage() {
  const [params] = useSearchParams();
  const documento = params.get('documento') ?? '';
  const token = params.get('token') ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['firmador-validacion-publica', documento, token],
    queryFn: () => firmadorService.validarDocumentoPublico(documento, token),
    enabled: Boolean(documento && token),
    retry: false,
  });

  const valid = Boolean(data?.registered && data?.token_valid && data?.status === 'FIRMADO' && !data?.is_expired && !data?.is_deleted);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <img src="/logo-of1-1.png" alt="FacturaOF1" className="h-14 w-auto object-contain" />
              <h1 className="mt-6 text-2xl font-black text-slate-950">Validacion de documento firmado</h1>
              <p className="mt-1 text-sm text-slate-500">Consulta publica generada desde OF1 Firmador.</p>
            </div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${valid ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
              {valid ? <ShieldCheck className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
            </div>
          </div>

          {!documento || !token ? (
            <Message type="error" text="El enlace de validacion esta incompleto." />
          ) : isLoading ? (
            <div className="mt-10 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando documento...
            </div>
          ) : error || !data?.registered ? (
            <Message type="error" text={data?.detail || 'No se pudo validar este documento.'} />
          ) : (
            <div className="mt-8 space-y-5">
              <div className={`rounded-2xl border p-4 ${valid ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-3">
                  {valid ? <CheckCircle2 className="h-6 w-6 text-blue-700" /> : <AlertCircle className="h-6 w-6 text-amber-700" />}
                  <div>
                    <p className={`font-black ${valid ? 'text-blue-900' : 'text-amber-900'}`}>
                      {valid ? 'Documento registrado y vigente' : `Documento ${data.status_display || data.status || 'con observacion'}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {valid
                        ? 'El enlace QR corresponde a un documento firmado desde OF1.'
                        : 'El documento existe, pero no esta vigente o no esta disponible.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200">
                <Row label="Documento" value={data.file_name || 'Documento firmado'} />
                <Row label="Tipo de firma" value={data.signature_type_display || data.signature_type || 'No disponible'} />
                <Row label="Fecha de firma" value={data.signed_at ? new Date(data.signed_at).toLocaleString() : 'No disponible'} />
                <Row label="Expira" value={data.expires_at ? new Date(data.expires_at).toLocaleString() : 'Sin expiracion registrada'} />
                <Row label="Hash firmado" value={shortHash(data.signed_hash)} mono />
                <Row label="Motivo" value={data.reason || 'No registrado'} />
                <Row label="Ubicacion" value={data.location || 'No registrada'} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <FileCheck2 className="mb-2 h-5 w-5 text-blue-700" />
                Esta validacion confirma el registro del documento en OF1 Firmador. Para validar criptograficamente un PDF descargado, ingresa al firmador y usa la opcion Validar.
              </div>

              {data.file_available && data.download_url && (
                <a
                  href={data.download_url}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF firmado
                </a>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
              <FileSignature className="h-4 w-4" />
              Ir a OF1 Firmador
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Message({ type, text }: { type: 'error' | 'info'; text: string }) {
  return (
    <div className={`mt-8 rounded-2xl border p-5 ${type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm font-semibold">{text}</span>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[160px_1fr]">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`break-words text-sm text-slate-900 ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}
