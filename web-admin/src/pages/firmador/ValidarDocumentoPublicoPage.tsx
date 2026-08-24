import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Download, FileCheck2, FileSignature, Loader2, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { firmadorService, type FirmadorPdfValidado } from '../../services/firmadorService';

const shortHash = (hash?: string) => {
  if (!hash) return 'No disponible';
  return `${hash.slice(0, 16)}...${hash.slice(-12)}`;
};

export default function ValidarDocumentoPublicoPage() {
  const [params] = useSearchParams();
  const documento = params.get('documento') ?? '';
  const token = params.get('token') ?? '';
  const hasQrParams = Boolean(documento && token);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FirmadorPdfValidado[]>([]);
  const [validating, setValidating] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['firmador-validacion-publica', documento, token],
    queryFn: () => firmadorService.validarDocumentoPublico(documento, token),
    enabled: hasQrParams,
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
              <h1 className="mt-6 text-2xl font-black text-slate-950">
                {hasQrParams ? 'Validacion de documento firmado' : 'Validar PDF firmado'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {hasQrParams ? 'Consulta publica generada desde OF1 Firmador.' : 'Sube uno o varios PDFs para revisar firmas y registro en OF1 Firmador.'}
              </p>
            </div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${valid ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
              {valid ? <ShieldCheck className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
            </div>
          </div>

          {!hasQrParams ? (
            <PublicUploadValidator
              files={files}
              results={results}
              validating={validating}
              uploadError={uploadError}
              onFiles={(nextFiles) => {
                setUploadError('');
                const pdfs = nextFiles.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
                if (nextFiles.length && !pdfs.length) {
                  setUploadError('Solo puedes subir documentos PDF.');
                  return;
                }
                setFiles((current) => [...current, ...pdfs].slice(0, 10));
                setResults([]);
              }}
              onRemove={(index) => {
                setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
                setResults([]);
              }}
              onReset={() => {
                setFiles([]);
                setResults([]);
                setUploadError('');
              }}
              onValidate={async () => {
                if (!files.length) {
                  setUploadError('Sube al menos un PDF firmado.');
                  return;
                }
                setValidating(true);
                setUploadError('');
                try {
                  setResults(await firmadorService.validarPdfs(files));
                } catch {
                  setUploadError('No se pudo completar la validacion. Intenta nuevamente.');
                } finally {
                  setValidating(false);
                }
              }}
            />
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

function PublicUploadValidator({
  files,
  results,
  validating,
  uploadError,
  onFiles,
  onRemove,
  onReset,
  onValidate,
}: {
  files: File[];
  results: FirmadorPdfValidado[];
  validating: boolean;
  uploadError: string;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  onReset: () => void;
  onValidate: () => void;
}) {
  return (
    <div className="mt-8 space-y-5">
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-100">
        <UploadCloud className="h-10 w-10 text-blue-700" />
        <span className="mt-3 text-sm font-black text-blue-900">Subir PDF firmado</span>
        <span className="mt-1 text-xs text-blue-700">Puedes seleccionar hasta 10 documentos PDF.</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </label>

      {uploadError && <Message type="error" text={uploadError} />}

      {files.length > 0 && (
        <div className="rounded-2xl border border-slate-200">
          {files.map((file, index) => {
            const result = results[index];
            const validSignature = result?.signatures?.some((signature) => signature.valid || signature.intact);
            const status = result
              ? result.error
                ? 'Error'
                : result.of1_registered
                  ? 'Registrado en OF1'
                  : validSignature
                    ? 'Firma detectada'
                    : 'Sin firma detectada'
              : 'Pendiente';
            return (
              <div key={`${file.name}-${index}`} className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_150px_40px] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  {result && (
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {result.error || `${result.signature_count} firma(s). Hash ${result.sha256.slice(0, 12)}...`}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-black ${
                  result?.of1_registered ? 'text-blue-700' : result?.error ? 'text-red-600' : validSignature ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {status}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                  title="Quitar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <FileCheck2 className="mb-2 h-5 w-5 text-blue-700" />
          La validacion publica revisa firmas embebidas y confirma coincidencia por hash con documentos registrados en OF1 Firmador.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Limpiar
        </button>
        <button
          type="button"
          disabled={!files.length || validating}
          onClick={onValidate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {validating && <Loader2 className="h-4 w-4 animate-spin" />}
          Validar PDF
        </button>
      </div>
    </div>
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
