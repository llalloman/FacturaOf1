import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
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
  Move,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useToast } from '../../hooks/useToast';
import { firmadorService, type FirmadorCertificado, type FirmadorDocumento } from '../../services/firmadorService';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

type TabKey = 'certificados' | 'firmar' | 'documentos' | 'validar' | 'ayuda';
type SignMode = 'multiples_documentos' | 'multiples_firmantes' | 'un_firmante';
type SignatureType = 'SIMPLE' | 'QR' | 'AVANZADA';

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

const signatureTypes: Array<{ key: SignatureType; label: string; description: string; icon: React.ElementType }> = [
  { key: 'SIMPLE', label: 'Simple', description: 'Firma digital sin marca visible.', icon: FileSignature },
  { key: 'QR', label: 'QR', description: 'Reserva un espacio visible para verificacion.', icon: QrCode },
  { key: 'AVANZADA', label: 'Avanzada', description: 'Firma visible con motivo y ubicacion.', icon: ShieldCheck },
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
      return 'No se pudo completar la operacion.';
    }
  }
  if (data && typeof data === 'object' && 'detail' in data) {
    return String((data as { detail?: string }).detail);
  }
  if (data && typeof data === 'object') {
    const firstValue = Object.values(data as Record<string, unknown>)[0];
    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (firstValue) return String(firstValue);
  }
  return 'No se pudo completar la operacion.';
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
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [certificate, setCertificate] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [certificateAlias, setCertificateAlias] = useState('');
  const [selectedCertificateId, setSelectedCertificateId] = useState<number | null>(null);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [deletingCertificateId, setDeletingCertificateId] = useState<number | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [keepFile, setKeepFile] = useState(false);
  const [visibleSignature, setVisibleSignature] = useState(false);
  const [signatureType, setSignatureType] = useState<SignatureType>('AVANZADA');
  const [signaturePage, setSignaturePage] = useState(1);
  const [signaturePosition, setSignaturePosition] = useState({ x: 6, y: 72, width: 36, height: 10 });
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

  const { data: certificados = [], isLoading: loadingCertificados } = useQuery({
    queryKey: ['firmador-certificados'],
    queryFn: firmadorService.getCertificados,
  });

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;

    if (!pdf) {
      setPdfDocument(null);
      setPdfPageCount(0);
      setPdfPreviewError('');
      return undefined;
    }

    setPdfDocument(null);
    setPdfPageCount(0);
    setPdfPreviewError('');
    pdf.arrayBuffer()
      .then((data) => pdfjsLib.getDocument({ data }).promise)
      .then((document) => {
        loadedDocument = document;
        if (cancelled) {
          void document.destroy();
          return;
        }
        setPdfDocument(document);
        setPdfPageCount(document.numPages);
      })
      .catch(() => {
        if (!cancelled) setPdfPreviewError('No se pudo cargar la vista previa del PDF.');
      });

    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [pdf]);

  useEffect(() => {
    if (signatureType === 'SIMPLE') {
      setVisibleSignature(false);
    } else {
      setVisibleSignature(true);
    }
  }, [signatureType]);

  const selectedCertificate = useMemo(
    () => certificados.find((cert) => cert.id === selectedCertificateId) ?? certificados[0] ?? null,
    [certificados, selectedCertificateId],
  );

  const storagePercent = useMemo(() => {
    if (!perfil?.max_storage_bytes) return 0;
    return Math.min(100, (perfil.used_storage_bytes / perfil.max_storage_bytes) * 100);
  }, [perfil]);
  const storageBarPercent = perfil?.used_storage_bytes
    ? Math.max(1, storagePercent)
    : 0;
  const availableStorage = Math.max((perfil?.max_storage_bytes ?? 0) - (perfil?.used_storage_bytes ?? 0), 0);

  const handleUploadCertificate = async () => {
    if (!certificate) {
      showToast('Selecciona un certificado .p12 o .pfx.', 'warning');
      return;
    }
    if (!certificatePassword.trim()) {
      showToast('Ingresa la clave del certificado para validarlo.', 'warning');
      return;
    }
    if (certificados.length >= 2) {
      showToast('Puedes almacenar hasta 2 certificados digitales.', 'warning');
      return;
    }

    setUploadingCertificate(true);
    try {
      const saved = await firmadorService.subirCertificado({
        certificate,
        certificatePassword,
        alias: certificateAlias.trim() || undefined,
      });
      setSelectedCertificateId(saved.id);
      setCertificate(null);
      setCertificateAlias('');
      await queryClient.invalidateQueries({ queryKey: ['firmador-certificados'] });
      showToast('Certificado validado y guardado.', 'success');
    } catch (error) {
      showToast(await readApiError(error), 'error');
    } finally {
      setUploadingCertificate(false);
    }
  };

  const handleDeleteCertificate = async (certificado: FirmadorCertificado) => {
    setDeletingCertificateId(certificado.id);
    try {
      await firmadorService.eliminarCertificado(certificado.id);
      if (selectedCertificateId === certificado.id) {
        setSelectedCertificateId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['firmador-certificados'] });
      showToast('Certificado eliminado.', 'success');
    } catch (error) {
      showToast(await readApiError(error), 'error');
    } finally {
      setDeletingCertificateId(null);
    }
  };

  const handlePreviewClick = (pageNumber: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (!visibleSignature || signatureType === 'SIMPLE') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setSignaturePage(pageNumber);
    setSignaturePosition((current) => ({
      ...current,
      x: Math.max(0, Math.min(100 - current.width, x - current.width / 2)),
      y: Math.max(0, Math.min(100 - current.height, y - current.height / 2)),
    }));
  };

  const handleDeleteDocument = async (doc: FirmadorDocumento) => {
    setDeletingDocumentId(doc.id);
    try {
      await firmadorService.eliminarDocumento(doc.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['firmador-perfil'] }),
        queryClient.invalidateQueries({ queryKey: ['firmador-documentos'] }),
      ]);
      showToast('Documento eliminado.', 'success');
    } catch (error) {
      showToast(await readApiError(error), 'error');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleSign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pdf) {
      showToast('Selecciona el PDF que deseas firmar.', 'warning');
      return;
    }
    if (!selectedCertificate && !certificate) {
      showToast('Selecciona o sube un certificado digital.', 'warning');
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
        certificate: selectedCertificate ? null : certificate,
        certificateId: selectedCertificate?.id ?? null,
        certificatePassword,
        keepFile,
        visibleSignature,
        signatureType,
        signaturePage,
        signatureX: signaturePosition.x,
        signatureY: signaturePosition.y,
        signatureWidth: signaturePosition.width,
        signatureHeight: signaturePosition.height,
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
  const certificateName =
    selectedCertificate?.alias ||
    certificate?.name.replace(/\.(p12|pfx)$/i, '') ||
    'Certificado digital';
  const storedDocs = useMemo(() => documentos.filter((doc) => doc.keep_file), [documentos]);
  const recentDocs = storedDocs.slice(0, 10);

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
                    active ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-400 hover:text-slate-700'
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Puedes almacenar hasta 2 certificados digitales. Los certificados se guardan cifrados y la clave no se almacena.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-950">Subir Certificado</h1>
                    <p className="mt-1 text-sm text-slate-500">Archivo .p12 o .pfx</p>
                  </div>
                  <span className="rounded-full bg-blue-700 px-3 py-1 text-xs font-bold text-white">
                    {certificados.length}/2
                  </span>
                </div>

                {certificate ? (
                  <div className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <FileSignature className="h-9 w-9 flex-shrink-0 text-blue-800" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{certificate.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatBytes(certificate.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCertificate(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white"
                      title="Quitar"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => certInputRef.current?.click()}
                    disabled={certificados.length >= 2}
                    className="mt-8 flex h-44 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-center transition-colors hover:border-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <UploadCloud className="h-11 w-11 text-slate-500" />
                    <span className="mt-4 text-sm font-bold text-slate-900">Arrastra tu certificado o haz clic</span>
                    <span className="mt-1 text-xs text-slate-500">Formatos: .p12, .pfx (max. 2MB)</span>
                  </button>
                )}
                <input
                  ref={certInputRef}
                  type="file"
                  accept=".p12,.pfx"
                  className="hidden"
                  onChange={(event) => setCertificate(event.target.files?.[0] ?? null)}
                />

                <label className="mt-5 block">
                  <span className="text-sm font-bold text-slate-700">Contrasena del certificado *</span>
                  <div className="relative mt-2">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={certificatePassword}
                      onChange={(event) => setCertificatePassword(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <span className="mt-2 block text-xs text-slate-500">Esta clave se usa para validar el certificado. No se guarda.</span>
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-bold text-slate-700">Alias de la firma (Opcional)</span>
                  <input
                    value={certificateAlias}
                    onChange={(event) => setCertificateAlias(event.target.value)}
                    placeholder="Ej: FIRMA PERSONAL, FIRMA DE EMPRESA..."
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                  <span className="mt-2 block text-xs text-slate-500">Nombre para identificar esta firma rapidamente.</span>
                </label>

                <Button
                  type="button"
                  loading={uploadingCertificate}
                  disabled={!certificate || certificados.length >= 2}
                  icon={<Upload className="h-4 w-4" />}
                  className="mt-6 w-full bg-blue-700 hover:bg-blue-800"
                  onClick={handleUploadCertificate}
                >
                  Subir Certificado
                </Button>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-950">Mis Certificados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {certificados.length} certificado(s) guardado(s)
                </p>

                <div className="mt-7 space-y-3">
                  {loadingCertificados ? (
                    <div className="flex items-center justify-center py-10 text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : certificados.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
                      No hay certificados guardados.
                    </div>
                  ) : (
                    certificados.map((certificado) => {
                      const active = selectedCertificate?.id === certificado.id;
                      return (
                        <div
                          key={certificado.id}
                          onClick={() => setSelectedCertificateId(certificado.id)}
                          className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border px-4 py-4 text-left transition-colors ${
                            active ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                              <FileSignature className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-950">{certificado.alias}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                                  certificado.is_expired ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                                }`}>
                                  <CheckCircle2 className="h-3 w-3" />
                                  {certificado.is_expired ? 'Expirado' : 'Vigente'}
                                </span>
                                <span>hasta {new Date(certificado.expires_at).toLocaleDateString()}</span>
                                <span>{formatBytes(certificado.file_size)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteCertificate(certificado);
                              }}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                              title="Eliminar"
                            >
                              {deletingCertificateId === certificado.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
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
                      active ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                      active ? 'bg-blue-800 text-white' : 'bg-slate-50 text-slate-500'
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
                  className="mt-7 flex h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-center transition-colors hover:border-blue-700 hover:bg-blue-50"
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
                    <span className="text-sm font-bold text-slate-700">Certificado para firmar</span>
                    <select
                      value={selectedCertificate?.id ?? ''}
                      onChange={(event) => setSelectedCertificateId(event.target.value ? Number(event.target.value) : null)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Selecciona un certificado</option>
                      {certificados.map((certificado) => (
                        <option key={certificado.id} value={certificado.id} disabled={certificado.is_expired}>
                          {certificado.alias} {certificado.is_expired ? '(expirado)' : ''}
                        </option>
                      ))}
                    </select>
                    {certificados.length === 0 && (
                      <span className="mt-2 block text-xs text-slate-500">Primero guarda un certificado en Firma Digital.</span>
                    )}
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Clave del certificado seleccionado</span>
                    <div className="relative mt-2">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={certificatePassword}
                        onChange={(event) => setCertificatePassword(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </label>

                  <div>
                    <span className="text-sm font-bold text-slate-700">Tipo de firma</span>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {signatureTypes.map((type) => {
                        const Icon = type.icon;
                        const active = signatureType === type.key;
                        return (
                          <button
                            key={type.key}
                            type="button"
                            onClick={() => setSignatureType(type.key)}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              active ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-800' : 'text-slate-500'}`} />
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-slate-900">{type.label}</span>
                              <span className="block text-xs text-slate-500">{type.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Motivo</span>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Ubicacion</span>
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={visibleSignature}
                      disabled={signatureType === 'SIMPLE'}
                      onChange={(event) => setVisibleSignature(event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:opacity-50"
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
                      className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Save className="h-4 w-4" />
                      Guardar
                    </span>
                  </label>
                </div>

                {visibleSignature && signatureType !== 'SIMPLE' && (
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">Pagina</span>
                      <input
                        type="number"
                        min={1}
                        value={signaturePage}
                        onChange={(event) => setSignaturePage(Math.max(1, Number(event.target.value) || 1))}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">Tamano visible</span>
                      <select
                        value={`${signaturePosition.width}-${signaturePosition.height}`}
                        onChange={(event) => {
                          const [width, height] = event.target.value.split('-').map(Number);
                          setSignaturePosition((current) => ({ ...current, width, height }));
                        }}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="28-8">Compacta</option>
                        <option value="36-10">Normal</option>
                        <option value="46-12">Amplia</option>
                      </select>
                    </label>
                  </div>
                )}

                <label className="mt-5 block">
                  <span className="text-sm font-bold text-slate-700">Retencion</span>
                  <input
                    type="number"
                    min={1}
                    max={maxRetentionDays}
                    value={retentionDays}
                    disabled={!keepFile}
                    onChange={(event) => setRetentionDays(Number(event.target.value))}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  />
                </label>

                <Button type="submit" loading={signing} icon={<FileSignature className="h-4 w-4" />} className="mt-6 w-full">
                  Firmar documento
                </Button>
              </section>

              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Vista Previa</h2>
                    <p className="text-xs text-slate-500">
                      {visibleSignature && signatureType !== 'SIMPLE'
                        ? 'Haz clic sobre el PDF para ubicar la firma visible.'
                        : 'La firma simple no muestra marca visible.'}
                    </p>
                  </div>
                  {visibleSignature && signatureType !== 'SIMPLE' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      <Move className="h-3.5 w-3.5" />
                      Pagina {signaturePage}
                    </span>
                  )}
                </div>
                <div className="bg-slate-100 p-4">
                  {pdfDocument ? (
                    <div className="max-h-[620px] space-y-4 overflow-auto pr-1">
                      {Array.from({ length: pdfPageCount }, (_, index) => {
                        const pageNumber = index + 1;
                        const selectedPage = signaturePage === pageNumber;
                        return (
                          <div key={pageNumber} className="mx-auto max-w-[820px]">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                              <span>Pagina {pageNumber}</span>
                              {visibleSignature && signatureType !== 'SIMPLE' && (
                                <button
                                  type="button"
                                  onClick={() => setSignaturePage(pageNumber)}
                                  className={`rounded-full px-3 py-1 ${
                                    selectedPage ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-blue-50'
                                  }`}
                                >
                                  Usar esta pagina
                                </button>
                              )}
                            </div>
                            <div
                              onClick={(event) => handlePreviewClick(pageNumber, event)}
                              className={`relative overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm ${
                                visibleSignature && signatureType !== 'SIMPLE' ? 'cursor-crosshair' : ''
                              }`}
                            >
                              <PdfPageCanvas document={pdfDocument} pageNumber={pageNumber} />
                              {visibleSignature && signatureType !== 'SIMPLE' && selectedPage && (
                                <div
                                  className="pointer-events-none absolute z-20 flex items-center justify-center rounded border-2 border-blue-700 bg-blue-600/10 text-center text-[11px] font-bold text-blue-900 shadow-sm"
                                  style={{
                                    left: `${signaturePosition.x}%`,
                                    top: `${signaturePosition.y}%`,
                                    width: `${signaturePosition.width}%`,
                                    height: `${signaturePosition.height}%`,
                                  }}
                                >
                                  <span className="rounded bg-white/85 px-2 py-1">
                                    {signatureType === 'QR' ? 'QR + Firma' : 'Firma visible'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : pdfPreviewError ? (
                    <div className="flex min-h-[420px] items-center justify-center text-center">
                      <div>
                        <FileText className="mx-auto h-14 w-14 text-red-300" />
                        <p className="mt-4 text-sm font-semibold text-red-600">{pdfPreviewError}</p>
                      </div>
                    </div>
                  ) : pdf ? (
                    <div className="flex min-h-[420px] items-center justify-center text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center text-center">
                      <div>
                        <FileText className="mx-auto h-14 w-14 text-slate-400" />
                        <p className="mt-4 text-sm font-semibold text-slate-600">Selecciona un PDF para preparar la firma</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {selectedCertificate ? `Certificado: ${certificateName}` : 'Selecciona un certificado en Firma Digital'}
                        </p>
                      </div>
                    </div>
                  )}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-2">
                  <Save className="h-5 w-5 text-blue-800" />
                  <h2 className="text-lg font-black text-slate-950">Estado del Almacenamiento</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {storagePercent.toFixed(storagePercent > 0 && storagePercent < 1 ? 2 : 0)}%
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {formatBytes(perfil?.used_storage_bytes ?? 0)} utilizados de {formatBytes(perfil?.max_storage_bytes ?? 0)}
              </p>
              <div className="mt-6">
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${storageBarPercent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{formatBytes(availableStorage)} disponibles</span>
                  <span>Solo cuentan los documentos guardados</span>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Tus Documentos</h2>
              <p className="text-sm text-slate-500">{storedDocs.length} documento(s) guardado(s)</p>

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
                      <div className="flex items-center gap-2">
                        {doc.download_url && (
                          <a
                            href={doc.download_url}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteDocument(doc)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                          title="Eliminar documento"
                        >
                          {deletingDocumentId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
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

function PdfPageCanvas({ document, pageNumber }: { document: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    document.getPage(pageNumber).then((loadedPage) => {
      if (!cancelled) setPage(loadedPage);
    });
    return () => {
      cancelled = true;
    };
  }, [document, pageNumber]);

  useEffect(() => {
    if (!page || !canvasRef.current) return undefined;
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    const task = page.render({ canvas, canvasContext: context, viewport });
    return () => {
      task.cancel();
    };
  }, [page]);

  return (
    <canvas ref={canvasRef} className="block w-full bg-white" />
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
      <Icon className="mx-auto h-12 w-12 text-blue-800" />
      <h1 className="mt-5 text-2xl font-black text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </section>
  );
}
