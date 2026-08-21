import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  HelpCircle,
  Info,
  KeyRound,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useToast } from '../../hooks/useToast';
import { firmadorService, type FirmadorDocumento } from '../../services/firmadorService';

type TabKey = 'certificados' | 'firmar' | 'documentos' | 'validar' | 'ayuda';
type SignMode = 'multiples_documentos' | 'multiples_firmantes' | 'un_firmante';

const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'certificados', label: 'Firma Digital', icon: Upload },
  { key: 'firmar', label: 'Firmar Documento', icon: FileSignature },
  { key: 'documentos', label: 'Documentos Firmados', icon: FileCheck2 },
  { key: 'validar', label: 'Validar', icon: ShieldCheck },
  { key: 'ayuda', label: 'Ayuda', icon: HelpCircle },
];

const signModes: Array<{ key: SignMode; label: string; description: string; icon: React.ElementType }> = [
  {
    key: 'multiples_documentos',
    label: 'Multiples Documentos',
    description: 'Aplica la misma firma en la misma posicion a varios archivos PDF.',
    icon: FileText,
  },
  {
    key: 'multiples_firmantes',
    label: 'Multiples Firmantes',
    description: 'Diferentes personas firman en un unico documento PDF.',
    icon: FileCheck2,
  },
  {
    key: 'un_firmante',
    label: 'Un Firmante',
    description: 'Una sola persona firma en varios lugares de un documento PDF.',
    icon: FileSignature,
  },
];

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
  const certInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('certificados');
  const [signMode, setSignMode] = useState<SignMode>('multiples_documentos');
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['firmador-perfil'] }),
        queryClient.invalidateQueries({ queryKey: ['firmador-documentos'] }),
      ]);
      showToast(result.keepFile ? 'PDF firmado y guardado.' : 'PDF firmado y descargado.', 'success');
      setActiveTab('documentos');
    } catch (error) {
      showToast(await readApiError(error), 'error');
    } finally {
      setSigning(false);
    }
  };

  const maxRetentionDays = perfil?.max_retention_days ?? 180;
  const certificateName = certificate?.name.replace(/\.(p12|pfx)$/i, '') || 'Certificado temporal';
  const recentDocs = documentos.slice(0, 10);

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 gap-1 md:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex h-12 items-center justify-center gap-2 border-b-2 text-sm font-semibold transition-colors ${
                    active ? 'border-cyan-700 text-cyan-800' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {activeTab === 'certificados' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Puedes usar un certificado digital por sesion. No se guarda la clave del certificado.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-950">Subir Certificado</h1>
                    <p className="mt-1 text-sm text-slate-500">Archivo .p12 o .pfx</p>
                  </div>
                  <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-bold text-white">
                    {certificate ? '1/1' : '0/1'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => certInputRef.current?.click()}
                  className="mt-8 flex h-44 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-center transition-colors hover:border-cyan-700 hover:bg-cyan-50"
                >
                  <UploadCloud className="h-11 w-11 text-slate-500" />
                  <span className="mt-4 text-sm font-bold text-slate-900">
                    {certificate ? certificate.name : 'Arrastra tu certificado o haz clic'}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">Formatos: .p12, .pfx (max. 2MB)</span>
                </button>
                <input
                  ref={certInputRef}
                  type="file"
                  accept=".p12,.pfx"
                  className="hidden"
                  onChange={(event) => setCertificate(event.target.files?.[0] ?? null)}
                />

                <label className="mt-5 block">
                  <span className="text-sm font-bold text-slate-700">Clave del certificado</span>
                  <div className="relative mt-2">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={certificatePassword}
                      onChange={(event) => setCertificatePassword(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                    />
                  </div>
                </label>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-950">Mis Certificados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {certificate ? '1 certificado cargado en esta sesion' : '0 certificados cargados'}
                </p>

                <div className="mt-7">
                  {certificate ? (
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800">
                          <FileSignature className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">{certificateName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Cargado
                            </span>
                            <span>{formatBytes(certificate.size)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCertificate(null);
                            setCertificatePassword('');
                          }}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
                      No hay certificados cargados.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'firmar' && (
          <form onSubmit={handleSign} className="space-y-7">
            <header>
              <h1 className="text-3xl font-black text-slate-950">Firma de Multiples Documentos</h1>
              <p className="mt-2 text-slate-500">Selecciona el modo que mejor se adapte a tus necesidades.</p>
            </header>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {signModes.map((mode) => {
                const Icon = mode.icon;
                const active = signMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setSignMode(mode.key)}
                    className={`flex items-start gap-4 rounded-lg border bg-white p-6 text-left shadow-sm transition-colors ${
                      active ? 'border-cyan-700 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                      active ? 'bg-cyan-800 text-white' : 'bg-slate-50 text-slate-500'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-lg font-black text-slate-950">{mode.label}</span>
                      <span className="mt-2 block text-sm leading-6 text-slate-500">{mode.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.4fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Configuracion</h2>

                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="mt-7 flex h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-center transition-colors hover:border-cyan-700 hover:bg-cyan-50"
                >
                  <UploadCloud className="h-10 w-10 text-slate-500" />
                  <span className="mt-4 text-sm font-bold text-slate-950">
                    {pdf ? pdf.name : 'Arrastra un PDF o haz click'}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">Puedes cargar un archivo PDF</span>
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(event) => setPdf(event.target.files?.[0] ?? null)}
                />

                <div className="mt-5 grid grid-cols-1 gap-4">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Motivo</span>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Ubicacion</span>
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={visibleSignature}
                      onChange={(event) => setVisibleSignature(event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                    />
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Eye className="h-4 w-4" />
                      Firma visible
                    </span>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={keepFile}
                      onChange={(event) => setKeepFile(event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                    />
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Save className="h-4 w-4" />
                      Guardar
                    </span>
                  </label>
                </div>

                <label className="mt-5 block">
                  <span className="text-sm font-bold text-slate-700">Retencion</span>
                  <input
                    type="number"
                    min={1}
                    max={maxRetentionDays}
                    value={retentionDays}
                    disabled={!keepFile}
                    onChange={(event) => setRetentionDays(Number(event.target.value))}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100 disabled:bg-slate-100"
                  />
                </label>

                <Button type="submit" loading={signing} icon={<FileSignature className="h-4 w-4" />} className="mt-6 w-full">
                  Firmar documento
                </Button>
              </section>

              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-lg font-black text-slate-950">Vista Previa</h2>
                </div>
                <div className="flex min-h-[420px] items-center justify-center bg-slate-100 px-6 text-center">
                  <div>
                    <FileText className="mx-auto h-14 w-14 text-slate-400" />
                    <p className="mt-4 text-sm font-semibold text-slate-600">
                      {pdf ? pdf.name : 'Selecciona un PDF para preparar la firma'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {certificate ? `Certificado: ${certificateName}` : 'Carga un certificado en Firma Digital'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </form>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-6">
            <header>
              <h1 className="text-3xl font-black text-slate-950">Documentos Firmados</h1>
              <p className="mt-2 text-slate-500">Gestiona todos tus documentos firmados electronicamente</p>
            </header>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Save className="h-5 w-5 text-cyan-800" />
                <h2 className="text-lg font-black text-slate-950">Estado del Almacenamiento</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {formatBytes(perfil?.used_storage_bytes ?? 0)} utilizados de {formatBytes(perfil?.max_storage_bytes ?? 0)}
              </p>
              <div className="mt-10 grid grid-cols-[70px_1fr] items-center gap-4">
                <span className="text-sm font-semibold text-slate-900">Espacio</span>
                <div className="h-12 bg-slate-200">
                  <div className="h-full bg-cyan-700" style={{ width: `${storagePercent}%` }} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Tus Documentos</h2>
              <p className="text-sm text-slate-500">{documentos.length} documento(s) guardado(s)</p>

              <div className="mt-5 space-y-3">
                {loadingPerfil ? (
                  <div className="flex items-center justify-center py-10 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
                    No hay documentos guardados.
                  </div>
                ) : (
                  recentDocs.map((doc: FirmadorDocumento) => (
                    <div key={doc.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{doc.signed_file_name || doc.original_file_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(doc.created_at).toLocaleString()} - {formatBytes(doc.signed_size)}
                        </p>
                      </div>
                      {doc.download_url && (
                        <a
                          href={doc.download_url}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Descargar"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'validar' && (
          <PlaceholderView icon={ShieldCheck} title="Validar documentos" text="La validacion de documentos firmados quedara en este espacio." />
        )}

        {activeTab === 'ayuda' && (
          <PlaceholderView icon={HelpCircle} title="Ayuda" text="Soporte, preguntas frecuentes y trazabilidad del firmador." />
        )}
      </section>
    </main>
  );
}

function PlaceholderView({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
      <Icon className="mx-auto h-12 w-12 text-cyan-800" />
      <h1 className="mt-5 text-2xl font-black text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </section>
  );
}
