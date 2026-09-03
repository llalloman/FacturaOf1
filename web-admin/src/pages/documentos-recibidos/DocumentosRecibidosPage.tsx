import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  FileArchive,
  FileSearch,
  FileText,
  Search,
  Upload,
  XCircle,
} from 'lucide-react';
import { documentosRecibidosService, type DocumentoRecibidoSRI } from '../../services/documentosRecibidosService';
import { toast } from '../../store/toastStore';

const estados = [
  { value: '', label: 'Todos' },
  { value: 'RECIBIDO', label: 'Recibidos' },
  { value: 'REQUIERE_REVISION', label: 'Revisión' },
  { value: 'VALIDADO', label: 'Validados' },
  { value: 'CONVERTIDO', label: 'Convertidos' },
];

const tipos = [
  { value: '', label: 'Todos los tipos' },
  { value: '01', label: 'Factura' },
  { value: '03', label: 'Liquidación' },
  { value: '04', label: 'Nota de crédito' },
  { value: '05', label: 'Nota de débito' },
  { value: '06', label: 'Guía de remisión' },
  { value: '07', label: 'Retención' },
];

const formatCurrency = (value: string | number) => Number(value || 0).toLocaleString('es-EC', {
  style: 'currency',
  currency: 'USD',
});

const statusStyle: Record<string, string> = {
  RECIBIDO: 'bg-blue-50 text-blue-700 ring-blue-200',
  VALIDADO: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  DUPLICADO: 'bg-slate-100 text-slate-600 ring-slate-200',
  REQUIERE_REVISION: 'bg-amber-50 text-amber-700 ring-amber-200',
  CONVERTIDO: 'bg-violet-50 text-violet-700 ring-violet-200',
  DESCARTADO: 'bg-red-50 text-red-700 ring-red-200',
};

export default function DocumentosRecibidosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentoRecibidoSRI | null>(null);
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['documentos-recibidos'],
    queryFn: () => documentosRecibidosService.getAll(),
  });

  const importMutation = useMutation({
    mutationFn: documentosRecibidosService.importar,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['documentos-recibidos'] });
      setSelectedFiles([]);
      toast.success(
        'Importación finalizada',
        `${result.creados} nuevo(s), ${result.duplicados} duplicado(s), ${result.errores} error(es).`,
      );
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || 'No se pudo importar los documentos.');
    },
  });

  const convertirMutation = useMutation({
    mutationFn: documentosRecibidosService.convertirCxp,
    onSuccess: (documento) => {
      queryClient.invalidateQueries({ queryKey: ['documentos-recibidos'] });
      setSelectedDoc(documento);
      toast.success('Cuenta por pagar creada', documento.cuenta_por_pagar_numero || 'Documento convertido correctamente.');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || 'No se pudo convertir el documento.');
    },
  });

  const filtered = data.filter((doc) => {
    const search = searchTerm.toLowerCase();
    const matchText =
      doc.numero_comprobante.toLowerCase().includes(search) ||
      doc.clave_acceso.toLowerCase().includes(search) ||
      doc.ruc_emisor.toLowerCase().includes(search) ||
      doc.razon_social_emisor.toLowerCase().includes(search);
    const matchEstado = !estado || doc.estado_interno === estado;
    const matchTipo = !tipo || doc.tipo_comprobante === tipo;
    const matchDesde = !fechaDesde || (doc.fecha_emision ?? '') >= fechaDesde;
    const matchHasta = !fechaHasta || (doc.fecha_emision ?? '') <= fechaHasta;
    return matchText && matchEstado && matchTipo && matchDesde && matchHasta;
  });

  const stats = useMemo(() => ({
    total: data.length,
    recibidos: data.filter((d) => d.estado_interno === 'RECIBIDO').length,
    revision: data.filter((d) => d.estado_interno === 'REQUIERE_REVISION').length,
    convertidos: data.filter((d) => d.estado_interno === 'CONVERTIDO').length,
    monto: data.reduce((acc, doc) => acc + Number(doc.total || 0), 0),
  }), [data]);

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files.filter((file) => /\.(xml|zip)$/i.test(file.name)));
    event.target.value = '';
  };

  const handleImport = () => {
    if (selectedFiles.length === 0) {
      toast.warning('Selecciona al menos un XML o ZIP.');
      return;
    }
    importMutation.mutate(selectedFiles);
  };

  const copyClave = async (clave: string) => {
    await navigator.clipboard.writeText(clave);
    toast.success('Clave de acceso copiada');
  };

  const canConvert = (doc: DocumentoRecibidoSRI) => (
    !doc.cuenta_por_pagar &&
    ['01', '03', '05'].includes(doc.tipo_comprobante)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Bandeja Tributaria</p>
          <h1 className="text-3xl font-bold text-slate-900">Documentos recibidos SRI</h1>
          <p className="mt-1 text-slate-500">
            Importa XML o ZIP, detecta duplicados y prepara compras, ATS e IVA sin depender de scraping.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 lg:min-w-[320px]">
          <div className="flex items-center gap-2 font-semibold">
            <FileSearch className="h-4 w-4" />
            MVP seguro
          </div>
          <p>Base robusta: XML/ZIP, validación por datos del archivo y revisión antes de convertir.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total recibidos" value={stats.total.toString()} icon={FileText} />
        <StatCard label="Pendientes" value={stats.recibidos.toString()} icon={FileArchive} />
        <StatCard label="Revisión" value={stats.revision.toString()} icon={AlertTriangle} tone="amber" />
        <StatCard label="Convertidos" value={stats.convertidos.toString()} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Monto importado" value={formatCurrency(stats.monto)} icon={FileSearch} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Importar comprobantes</h2>
            <p className="text-sm text-slate-500">Acepta archivos `.xml` o `.zip` con comprobantes electrónicos recibidos.</p>
            <label className="mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 px-4 text-center transition hover:border-blue-400 hover:bg-blue-50">
              <Upload className="mb-2 h-7 w-7 text-blue-600" />
              <span className="font-semibold text-slate-800">Selecciona XML/ZIP para importar</span>
              <span className="text-sm text-slate-500">Puedes elegir varios archivos a la vez</span>
              <input type="file" accept=".xml,.zip" multiple className="hidden" onChange={handleFiles} />
            </label>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-[320px]">
            <p className="text-sm font-semibold text-slate-700">Archivos seleccionados</p>
            <div className="mt-3 max-h-28 space-y-2 overflow-auto">
              {selectedFiles.length === 0 ? (
                <p className="text-sm text-slate-400">Todavía no hay archivos.</p>
              ) : selectedFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className="truncate rounded-md bg-white px-3 py-2 text-sm text-slate-600">
                  {file.name}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedFiles.length === 0 || importMutation.isPending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <Upload className="h-4 w-4" />
              {importMutation.isPending ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Buscar por proveedor, RUC, número o clave..."
            />
          </div>
          <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5">
            {tipos.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={estado} onChange={(event) => setEstado(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5">
            {estados.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5" />
          <input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5" />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Comprobantes importados</h2>
          <p className="text-sm text-slate-500">{filtered.length} resultado(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Documento</th>
                <th className="px-5 py-3">Proveedor</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Cargando documentos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No hay documentos recibidos todavía.</td></tr>
              ) : filtered.map((doc) => (
                <tr key={doc.id} className="align-top transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{doc.numero_comprobante || 'Sin número'}</p>
                    <button type="button" onClick={() => copyClave(doc.clave_acceso)} className="mt-1 inline-flex max-w-[260px] items-center gap-1 text-xs text-slate-400 hover:text-blue-600">
                      <span className="truncate">{doc.clave_acceso}</span>
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800">{doc.razon_social_emisor || 'Proveedor sin nombre'}</p>
                    <p className="text-sm text-slate-400">{doc.ruc_emisor}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{doc.fecha_emision || '-'}</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatCurrency(doc.total)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyle[doc.estado_interno] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                      {doc.estado_interno_display}
                    </span>
                    {doc.errores.length > 0 && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Requiere revisión
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canConvert(doc) && (
                        <button
                          type="button"
                          onClick={() => convertirMutation.mutate(doc.id)}
                          disabled={convertirMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CreditCard className="h-4 w-4" />
                          CxP
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(doc)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FileSearch className="h-4 w-4" />
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDoc && (
        <DocumentoDetalleModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onConvert={() => convertirMutation.mutate(selectedDoc.id)}
          canConvert={canConvert(selectedDoc)}
          isConverting={convertirMutation.isPending}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: 'blue' | 'amber' | 'emerald';
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DocumentoDetalleModal({
  doc,
  onClose,
  onConvert,
  canConvert,
  isConverting,
}: {
  doc: DocumentoRecibidoSRI;
  onClose: () => void;
  onConvert: () => void;
  canConvert: boolean;
  isConverting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{doc.tipo_comprobante_display}</p>
            <h3 className="text-xl font-bold text-slate-900">{doc.numero_comprobante || 'Documento recibido'}</h3>
            <p className="text-sm text-slate-500">{doc.razon_social_emisor}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {doc.cuenta_por_pagar && (
            <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Cuenta por pagar creada</p>
              <p className="mt-1">
                {doc.cuenta_por_pagar_numero || `CxP #${doc.cuenta_por_pagar}`}
                {doc.proveedor_nombre ? ` - ${doc.proveedor_nombre}` : ''}
              </p>
            </div>
          )}

          {doc.errores.length > 0 && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Pendiente de revisión</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {doc.errores.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Info label="RUC emisor" value={doc.ruc_emisor} />
            <Info label="RUC receptor" value={doc.ruc_receptor} />
            <Info label="Autorización" value={doc.numero_autorizacion || 'Sin validar'} />
            <Info label="Fecha emisión" value={doc.fecha_emision || '-'} />
            <Info label="Subtotal IVA" value={formatCurrency(doc.subtotal_iva)} />
            <Info label="IVA" value={formatCurrency(doc.iva)} />
            <Info label="Subtotal 0%" value={formatCurrency(doc.subtotal_0)} />
            <Info label="Total" value={formatCurrency(doc.total)} strong />
            <Info label="Proveedor vinculado" value={doc.proveedor_nombre || 'Sin vincular'} />
            <Info label="Cuenta por pagar" value={doc.cuenta_por_pagar_numero || 'No creada'} />
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[720px] w-full">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Base</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doc.detalles.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin detalle disponible.</td></tr>
                ) : doc.detalles.map((detalle) => (
                  <tr key={detalle.id}>
                    <td className="px-4 py-3 text-slate-800">{detalle.descripcion}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{Number(detalle.cantidad).toLocaleString('es-EC')}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(detalle.base_imponible)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(detalle.iva)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(detalle.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
            {canConvert && (
              <button
                type="button"
                onClick={onConvert}
                disabled={isConverting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                <CreditCard className="h-4 w-4" />
                {isConverting ? 'Convirtiendo...' : 'Crear cuenta por pagar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 break-words ${strong ? 'text-lg font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{value}</p>
    </div>
  );
}
