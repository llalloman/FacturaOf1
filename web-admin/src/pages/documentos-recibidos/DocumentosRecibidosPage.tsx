import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiAlertTriangle,
  FiArchive,
  FiCheckCircle,
  FiCopy,
  FiCreditCard,
  FiFileText,
  FiFilter,
  FiSearch,
  FiUpload,
  FiXCircle,
} from 'react-icons/fi';
import { documentosRecibidosService, type DocumentoRecibidoSRI } from '../../services/documentosRecibidosService';
import { toast } from '../../store/toastStore';

const PAGE_SIZE = 10;

const tipos = [
  { value: '', label: 'Todos los tipos' },
  { value: '01', label: 'Factura' },
  { value: '03', label: 'Liquidación' },
  { value: '04', label: 'Nota de crédito' },
  { value: '05', label: 'Nota de débito' },
  { value: '06', label: 'Guía de remisión' },
  { value: '07', label: 'Retención' },
];

export default function DocumentosRecibidosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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

  const documentosArray = Array.isArray(data) ? data : [];

  const filteredDocs = documentosArray
    .filter((doc) => {
      const search = searchTerm.toLowerCase();
      const matchText =
        (doc.numero_comprobante ?? '').toLowerCase().includes(search) ||
        (doc.clave_acceso ?? '').toLowerCase().includes(search) ||
        (doc.ruc_emisor ?? '').toLowerCase().includes(search) ||
        (doc.razon_social_emisor ?? '').toLowerCase().includes(search);
      const matchEstado = !filtroEstado || doc.estado_interno === filtroEstado;
      const matchTipo = !filtroTipo || doc.tipo_comprobante === filtroTipo;
      const fechaDoc = (doc.fecha_emision ?? '').split('T')[0].split(' ')[0];
      const matchDesde = !filtroFechaDesde || fechaDoc >= filtroFechaDesde;
      const matchHasta = !filtroFechaHasta || fechaDoc <= filtroFechaHasta;
      return matchText && matchEstado && matchTipo && matchDesde && matchHasta;
    })
    .sort((a, b) => (b.fecha_emision ?? '').localeCompare(a.fecha_emision ?? '') || (b.numero_comprobante ?? '').localeCompare(a.numero_comprobante ?? '', undefined, { numeric: true }));

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDocs = filteredDocs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalDocumentos = documentosArray.length;
  const totalRecibidos = documentosArray.filter((doc) => doc.estado_interno === 'RECIBIDO').length;
  const totalRevision = documentosArray.filter((doc) => doc.estado_interno === 'REQUIERE_REVISION').length;
  const totalConvertidos = documentosArray.filter((doc) => doc.estado_interno === 'CONVERTIDO').length;
  const montoTotal = sumDocumentos(documentosArray);
  const montoFiltrado = sumDocumentos(filteredDocs);

  const statusTabs = useMemo(() => [
    { value: '', label: 'Todos', count: totalDocumentos },
    { value: 'RECIBIDO', label: 'Recibido', count: totalRecibidos },
    { value: 'REQUIERE_REVISION', label: 'Revisión', count: totalRevision },
    { value: 'CONVERTIDO', label: 'Convertido', count: totalConvertidos },
  ], [totalDocumentos, totalRecibidos, totalRevision, totalConvertidos]);

  const updateSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const updateEstado = (value: string) => {
    setFiltroEstado(value);
    setCurrentPage(1);
  };

  const updateTipo = (value: string) => {
    setFiltroTipo(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFiltroEstado('');
    setFiltroTipo('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setCurrentPage(1);
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const validFiles = files.filter((file) => /\.(xml|zip)$/i.test(file.name));
    if (files.length !== validFiles.length) {
      toast.warning('Solo se permiten archivos XML o ZIP.');
    }
    setSelectedFiles(validFiles);
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

  const renderActions = (doc: DocumentoRecibidoSRI, compact = false) => (
    <div className={`flex ${compact ? 'flex-wrap justify-start' : 'justify-end'} gap-1`}>
      {canConvert(doc) && (
        <ActionButton
          title="Crear cuenta por pagar"
          onClick={() => convertirMutation.mutate(doc.id)}
          disabled={convertirMutation.isPending}
          tone="emerald"
        >
          <FiCreditCard />
        </ActionButton>
      )}
      <ActionButton title="Ver detalle" onClick={() => setSelectedDoc(doc)} tone="blue">
        <FiFileText />
      </ActionButton>
      <ActionButton title="Copiar clave de acceso" onClick={() => copyClave(doc.clave_acceso)}>
        <FiCopy />
      </ActionButton>
    </div>
  );

  const hasFilters = Boolean(searchTerm || filtroEstado || filtroTipo || filtroFechaDesde || filtroFechaHasta);

  return (
    <div className="space-y-6 bg-slate-50 p-6">
      <div className="w-full space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Bandeja Tributaria</h1>
            <p className="mt-1 text-sm text-slate-500">Documentos recibidos SRI · XML, ZIP, compras y cuentas por pagar</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800">
              <FiUpload />
              Seleccionar XML/ZIP
              <input type="file" accept=".xml,.zip" multiple className="hidden" onChange={handleFiles} />
            </label>
            {selectedFiles.length > 0 && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiArchive />
                {importMutation.isPending ? 'Importando...' : `Importar ${selectedFiles.length} archivo(s)`}
              </button>
            )}
          </div>
        </header>

        {selectedFiles.length > 0 && (
          <section className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">Archivos listos para importar</p>
                <p className="mt-1 truncate text-sm font-semibold text-blue-900">
                  {selectedFiles.map((file) => file.name).join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
                className="h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                Quitar selección
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <MetricCard title="Total recibidos" value={totalDocumentos} amount={formatMoney(montoTotal)} icon={<FiFileText />} tone="blue" />
          <MetricCard title="Pendientes" value={totalRecibidos} amount="Por revisar" icon={<FiArchive />} tone="amber" />
          <MetricCard title="Revisión" value={totalRevision} amount="Requieren atención" icon={<FiAlertTriangle />} tone="red" />
          <MetricCard title="Convertidos" value={totalConvertidos} amount="Con CxP vinculada" icon={<FiCheckCircle />} tone="emerald" />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-[260px] flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por proveedor, RUC, número o clave..."
                value={searchTerm}
                onChange={(event) => updateSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filtroTipo}
                onChange={(event) => updateTipo(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                title="Tipo de comprobante"
              >
                {tipos.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(event) => {
                  setFiltroFechaDesde(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                title="Fecha desde"
              />
              <span className="hidden text-slate-300 sm:inline">-</span>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(event) => {
                  setFiltroFechaHasta(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                title="Fecha hasta"
              />
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const active = filtroEstado === tab.value;
                return (
                  <button
                    key={tab.value || 'todos'}
                    type="button"
                    onClick={() => updateEstado(tab.value)}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                      active ? 'bg-blue-700 text-white shadow-md shadow-blue-900/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
              <FiFilter />
              {filteredDocs.length} resultado(s)
            </p>
          </div>
        </section>

        <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-700" />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1120px] table-fixed">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                      <th className="w-[18%] px-4 py-4 text-left">Documento</th>
                      <th className="w-[24%] px-4 py-4 text-left">Proveedor</th>
                      <th className="w-[10%] px-4 py-4 text-left">Fecha</th>
                      <th className="w-[10%] px-4 py-4 text-right">Total</th>
                      <th className="w-[14%] px-4 py-4 text-center">Estado</th>
                      <th className="w-[8%] px-4 py-4 text-center">SRI</th>
                      <th className="w-[16%] px-4 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDocs.map((doc) => (
                      <tr key={doc.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="truncate font-mono text-sm font-black text-slate-950">{doc.numero_comprobante || 'Sin número'}</div>
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-400">
                            <span className="truncate">{doc.clave_acceso ? `${doc.clave_acceso.slice(0, 18)}...` : '-'}</span>
                            {doc.clave_acceso && (
                              <button
                                type="button"
                                onClick={() => copyClave(doc.clave_acceso)}
                                className="text-slate-300 hover:text-blue-700"
                                title="Copiar clave de acceso"
                              >
                                <FiCopy />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-black text-blue-700">
                              {(doc.razon_social_emisor || doc.ruc_emisor || 'PR').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-700">
                                {doc.razon_social_emisor || 'Proveedor sin nombre'}
                              </span>
                              <span className="block truncate text-xs font-medium text-slate-400">{doc.ruc_emisor || '-'}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-500">{formatFechaLocal(doc.fecha_emision)}</td>
                        <td className="px-4 py-4 text-right text-sm font-black text-slate-950">{formatMoney(doc.total)}</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getEstadoColor(doc.estado_interno)}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {doc.estado_interno_display}
                            </span>
                            {doc.errores.length > 0 && (
                              <span className="max-w-[200px] text-center text-xs leading-tight text-amber-700" title={doc.errores.join('\n')}>
                                {doc.errores[0].length > 70 ? `${doc.errores[0].slice(0, 70)}...` : doc.errores[0]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${getSriColor(doc.estado_sri)}`}>
                            {doc.estado_sri_display || doc.estado_sri}
                          </span>
                        </td>
                        <td className="px-4 py-4">{renderActions(doc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {paginatedDocs.map((doc) => (
                  <article key={doc.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-black text-slate-950">{doc.numero_comprobante || 'Sin número'}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-600">
                          {doc.razon_social_emisor || 'Proveedor sin nombre'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{doc.ruc_emisor || '-'}</p>
                      </div>
                      <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${getEstadoColor(doc.estado_interno)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {doc.estado_interno_display}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha</p>
                        <p className="mt-1 font-semibold text-slate-700">{formatFechaLocal(doc.fecha_emision)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Total</p>
                        <p className="mt-1 font-black text-slate-950">{formatMoney(doc.total)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg bg-slate-50 p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Autorización / clave</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">
                          {doc.numero_autorizacion || doc.clave_acceso || '-'}
                        </p>
                        {doc.clave_acceso && (
                          <button
                            type="button"
                            onClick={() => copyClave(doc.clave_acceso)}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-blue-700"
                            title="Copiar clave de acceso"
                            aria-label="Copiar clave de acceso"
                          >
                            <FiCopy />
                          </button>
                        )}
                      </div>
                    </div>

                    {doc.errores.length > 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                        {doc.errores[0]}
                      </p>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      {renderActions(doc, true)}
                    </div>
                  </article>
                ))}
              </div>

              {filteredDocs.length === 0 && (
                <div className="py-14 text-center">
                  <FiFileText className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-600">No se encontraron documentos recibidos</p>
                  <p className="mt-1 text-xs text-slate-400">Importa XML/ZIP o ajusta los filtros.</p>
                </div>
              )}
            </>
          )}

          {!isLoading && filteredDocs.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-400">
                {filteredDocs.length} documento(s) · Total {formatMoney(montoFiltrado)}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-700 px-3 text-xs font-black text-white">
                  {safePage}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">{doc.tipo_comprobante_display}</p>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-950">{doc.numero_comprobante || 'Documento recibido'}</h3>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">{doc.razon_social_emisor || 'Proveedor sin nombre'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <FiXCircle />
          </button>
        </div>

        <div className="max-h-[76vh] overflow-y-auto p-6">
          {doc.cuenta_por_pagar && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-black">Cuenta por pagar creada</p>
              <p className="mt-1 font-semibold">
                {doc.cuenta_por_pagar_numero || `CxP #${doc.cuenta_por_pagar}`}
                {doc.proveedor_nombre ? ` · ${doc.proveedor_nombre}` : ''}
              </p>
            </div>
          )}

          {doc.errores.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-black">Pendiente de revisión</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {doc.errores.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <Info label="RUC emisor" value={doc.ruc_emisor || '-'} />
            <Info label="RUC receptor" value={doc.ruc_receptor || '-'} />
            <Info label="Fecha emisión" value={formatFechaLocal(doc.fecha_emision)} />
            <Info label="Estado SRI" value={doc.estado_sri_display || doc.estado_sri} />
            <Info label="Subtotal IVA" value={formatMoney(doc.subtotal_iva)} />
            <Info label="IVA" value={formatMoney(doc.iva)} />
            <Info label="Subtotal 0%" value={formatMoney(doc.subtotal_0)} />
            <Info label="Total" value={formatMoney(doc.total)} strong />
            <Info label="Proveedor vinculado" value={doc.proveedor_nombre || 'Sin vincular'} wide />
            <Info label="Cuenta por pagar" value={doc.cuenta_por_pagar_numero || 'No creada'} wide />
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Clave de acceso</p>
            <p className="mt-2 break-all font-mono text-xs font-semibold text-slate-600">{doc.clave_acceso || '-'}</p>
            {doc.numero_autorizacion && (
              <>
                <p className="mt-4 text-[11px] font-black uppercase tracking-wide text-slate-400">Número de autorización</p>
                <p className="mt-2 break-all font-mono text-xs font-semibold text-slate-600">{doc.numero_autorizacion}</p>
              </>
            )}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Base</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {doc.detalles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
                      Sin detalle disponible.
                    </td>
                  </tr>
                ) : doc.detalles.map((detalle) => (
                  <tr key={detalle.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{detalle.descripcion}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">{Number(detalle.cantidad).toLocaleString('es-EC')}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">{formatMoney(detalle.base_imponible)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">{formatMoney(detalle.iva)}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-slate-950">{formatMoney(detalle.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-500 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
            {canConvert && (
              <button
                type="button"
                onClick={onConvert}
                disabled={isConverting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCreditCard />
                {isConverting ? 'Convirtiendo...' : 'Crear cuenta por pagar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function sumDocumentos(items: DocumentoRecibidoSRI[]) {
  return items.reduce((sum, doc) => sum + Number(doc.total || 0), 0);
}

function formatMoney(value: number | string) {
  return Number(value || 0).toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatFechaLocal(fecha?: string | null) {
  const value = (fecha ?? '').split('T')[0].split(' ')[0];
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'VALIDADO': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'CONVERTIDO': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'RECIBIDO': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'REQUIERE_REVISION': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'DUPLICADO': return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'DESCARTADO': return 'border-red-200 bg-red-50 text-red-700';
    default: return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function getSriColor(estado: string) {
  switch (estado) {
    case 'AUTORIZADO': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'NO_AUTORIZADO': return 'border-red-200 bg-red-50 text-red-700';
    case 'ERROR': return 'border-red-200 bg-red-100 text-red-800';
    default: return 'border-slate-200 bg-slate-50 text-slate-500';
  }
}

function MetricCard({
  title,
  value,
  amount,
  icon,
  tone,
}: {
  title: string;
  value: number;
  amount: string;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'red';
}) {
  const toneClass = {
    blue: 'border-blue-500 text-blue-700',
    emerald: 'border-emerald-500 text-emerald-700',
    amber: 'border-amber-500 text-amber-700',
    red: 'border-red-500 text-red-700',
  }[tone];

  return (
    <div className={`rounded-xl border-l-4 bg-white p-6 shadow-lg ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{amount}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-2xl">
          {icon}
        </span>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  title,
  onClick,
  disabled,
  tone = 'slate',
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tone?: 'slate' | 'blue' | 'emerald' | 'red';
}) {
  const toneClass = {
    slate: 'text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700',
    blue: 'text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800',
    emerald: 'text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800',
    red: 'text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function Info({
  label,
  value,
  strong = false,
  wide = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 break-words ${strong ? 'text-lg font-black text-slate-950' : 'text-sm font-semibold text-slate-700'}`}>{value}</p>
    </div>
  );
}
