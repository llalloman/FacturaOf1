import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  Eye,
  FileSignature,
  FileText,
  HardDrive,
  KeyRound,
  Loader2,
  Save,
  Upload,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useToast } from '../../hooks/useToast';
import { firmadorService, type FirmadorDocumento } from '../../services/firmadorService';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const readApiError = async (error: unknown): Promise<string> => {
  const axiosError = error as { response?: { data?: unknown } };
  const data = axiosError.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { detail?: string };
      return parsed.detail ?? text;
    } catch {
      return 'No se pudo firmar el PDF.';
    }
  }
  if (data && typeof data === 'object' && 'detail' in data) {
    return String((data as { detail?: string }).detail);
  }
  return 'No se pudo firmar el PDF.';
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function FirmadorPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pdf, setPdf] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [keepFile, setKeepFile] = useState(false);
  const [visibleSignature, setVisibleSignature] = useState(false);
  const [reason, setReason] = useState('Firmado electronicamente');
  const [location, setLocation] = useState('Ecuador');
  const [retentionDays, setRetentionDays] = useState(30);
  const [signing, setSigning] = useState(false);

  const { data: perfil, isLoading: loadingPerfil } = useQuery({
    queryKey: ['firmador-perfil'],
    queryFn: firmadorService.getPerfil,
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['firmador-documentos'],
    queryFn: firmadorService.getDocumentos,
  });

  const storagePercent = useMemo(() => {
    if (!perfil?.max_storage_bytes) return 0;
    return Math.min(100, Math.round((perfil.used_storage_bytes / perfil.max_storage_bytes) * 100));
  }, [perfil]);

  const handleSign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pdf || !certificate) {
      showToast('Selecciona el PDF y el certificado.', 'warning');
      return;
    }
    if (!certificatePassword.trim()) {
      showToast('Ingresa la clave del certificado.', 'warning');
      return;
    }

    setSigning(true);
    try {
      const result = await firmadorService.firmarPdf({
        pdf,
        certificate,
        certificatePassword,
        keepFile,
        visibleSignature,
        reason,
        location,
        retentionDays,
      });
      downloadBlob(result.blob, result.fileName);
      setPdf(null);
      setCertificate(null);
      setCertificatePassword('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['firmador-perfil'] }),
        queryClient.invalidateQueries({ queryKey: ['firmador-documentos'] }),
      ]);
      showToast(result.keepFile ? 'PDF firmado y guardado.' : 'PDF firmado y descargado.', 'success');
    } catch (error) {
      showToast(await readApiError(error), 'error');
    } finally {
      setSigning(false);
    }
  };

  const maxRetentionDays = perfil?.max_retention_days ?? 180;
  const recentDocs = documentos.slice(0, 8);

  return (
    <main className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-blue-700 font-semibold text-sm">
            <FileSignature className="w-5 h-5" />
            Firmador PDF
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            Firma documentos con tu certificado electronico
          </h1>
        </div>
        {loadingPerfil ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        ) : (
          <div className="text-sm text-slate-500">
            {perfil?.nombre}
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Firmas del mes</p>
              <p className="text-2xl font-black text-slate-900">
                {perfil?.monthly_signatures_used ?? 0}/{perfil?.monthly_signature_limit ?? 0}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
        </Card>
        <Card className="rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Archivo maximo</p>
              <p className="text-2xl font-black text-slate-900">
                {formatBytes(perfil?.max_file_size_bytes ?? 0)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        <Card className="rounded-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Almacenamiento</p>
              <p className="text-lg font-black text-slate-900">
                {formatBytes(perfil?.used_storage_bytes ?? 0)} / {formatBytes(perfil?.max_storage_bytes ?? 0)}
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${storagePercent}%` }} />
              </div>
            </div>
            <HardDrive className="w-8 h-8 text-indigo-600" />
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] gap-6">
        <Card className="rounded-lg">
          <form onSubmit={handleSign} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">PDF</span>
                <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setPdf(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white file:font-semibold"
                  />
                  {pdf && <p className="mt-2 text-xs font-semibold text-slate-600 break-all">{pdf.name}</p>}
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Certificado .p12 o .pfx</span>
                <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(event) => setCertificate(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-white file:font-semibold"
                  />
                  {certificate && <p className="mt-2 text-xs font-semibold text-slate-600 break-all">{certificate.name}</p>}
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block md:col-span-1">
                <span className="text-sm font-bold text-slate-700">Clave del certificado</span>
                <div className="relative mt-2">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={certificatePassword}
                    onChange={(event) => setCertificatePassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Motivo</span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Ubicacion</span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={visibleSignature}
                  onChange={(event) => setVisibleSignature(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Eye className="w-4 h-4" />
                  Firma visible
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={keepFile}
                  onChange={(event) => setKeepFile(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Save className="w-4 h-4" />
                  Guardar en R2
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Retencion</span>
                <input
                  type="number"
                  min={1}
                  max={maxRetentionDays}
                  value={retentionDays}
                  disabled={!keepFile}
                  onChange={(event) => setRetentionDays(Number(event.target.value))}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-sm text-slate-500">
                Si no guardas el archivo, se descarga firmado y solo queda el registro de auditoria.
              </p>
              <Button type="submit" loading={signing} icon={<Upload className="w-4 h-4" />}>
                Firmar PDF
              </Button>
            </div>
          </form>
        </Card>

        <Card className="rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900">Documentos recientes</h2>
            <FileSignature className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-3">
            {recentDocs.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">
                Aun no hay documentos firmados.
              </div>
            ) : (
              recentDocs.map((doc: FirmadorDocumento) => (
                <div key={doc.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{doc.signed_file_name || doc.original_file_name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(doc.created_at).toLocaleString()} · {formatBytes(doc.signed_size)}
                      </p>
                    </div>
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}
