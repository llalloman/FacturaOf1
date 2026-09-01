import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiXCircle,
} from 'react-icons/fi';
import ExportButtons from '../../components/ui/ExportButtons';
import FiscalReadinessBanner from '../../components/FiscalReadinessBanner';
import { facturasService } from '../../services/facturasService';
import { confirmDialog, promptDialog } from '../../store/confirmStore';
import { toast } from '../../store/toastStore';
import type { Factura } from '../../types';
import FacturaModal from './FacturaModal';

type EstadoFactura = Factura['estado'];

const PAGE_SIZE = 10;

const statusLabels: Record<EstadoFactura, string> = {
  BORRADOR: 'Borrador',
  FIRMADO: 'Firmado',
  ENVIADO: 'Enviado',
  AUTORIZADO: 'Autorizado',
  RECHAZADO: 'Rechazado',
  NO_AUTORIZADO: 'No autorizado',
  ANULADO: 'Anulado',
};

const FacturasPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoFactura | ''>('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const queryClient = useQueryClient();

  const { data: facturas, isLoading } = useQuery({
    queryKey: ['facturas'],
    queryFn: () => facturasService.getAll(),
    refetchInterval: (query) => {
      const data = query.state.data as Factura[] | undefined;
      const hayEnviadas = data?.some((f) => f.estado === 'ENVIADO');
      return hayEnviadas ? 5000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: facturasService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
    },
  });

  const enviarSRIMutation = useMutation({
    mutationFn: facturasService.enviarSRI,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const res = data as { estado?: string; numero_autorizacion?: string; mensaje?: string };
      if (res?.estado === 'AUTORIZADO') {
        toast.success('Factura autorizada', `Nro. autorización: ${res.numero_autorizacion}`);
      } else if (res?.estado === 'RECHAZADO' || res?.estado === 'NO_AUTORIZADO') {
        toast.error(res.estado ?? 'Rechazado', res.mensaje || 'Sin detalle del SRI');
      } else {
        toast.info(`Estado: ${res?.estado ?? 'ENVIADO'}`, res?.mensaje || undefined);
      }
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Error al enviar factura al SRI');
    },
  });

  const reprocesarMutation = useMutation({
    mutationFn: facturasService.reprocesar,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const res = data as { estado?: string; numero_autorizacion?: string; mensaje?: string };
      if (res?.estado === 'AUTORIZADO') {
        toast.success('Factura autorizada', `Nro. autorización: ${res.numero_autorizacion}`);
      } else if (res?.estado === 'ENVIADO') {
        toast.warning('Pendiente de autorización en el SRI', res?.mensaje || 'Puede volver a intentar en unos segundos.');
      } else {
        toast.info(`Estado: ${res?.estado ?? '-'}`, res?.mensaje || undefined);
      }
    },
    onError: (error: unknown) => {
      const errData = (error as { response?: { data?: { error?: string; mensaje?: string } } })?.response?.data;
      toast.error(errData?.error || errData?.mensaje || 'Error al reprocesar');
    },
  });

  const reenviarEmailMutation = useMutation({
    mutationFn: facturasService.reenviarEmail,
    onSuccess: (data: unknown) => {
      const res = data as { mensaje?: string };
      toast.success(res?.mensaje || 'Email enviado exitosamente');
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Error al reenviar el email');
    },
  });

  const anularMutation = useMutation({
    mutationFn: facturasService.anular,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const res = data as { mensaje?: string; nota_credito?: { numero: string; estado: string; numero_autorizacion?: string } };
      if (res?.nota_credito) {
        const nc = res.nota_credito;
        const autMsg = nc.numero_autorizacion ? ` · Aut: ${nc.numero_autorizacion}` : '';
        toast.success('Factura anulada', `NC: ${nc.numero} - ${nc.estado}${autMsg}`);
      } else {
        toast.success(res?.mensaje || 'Factura anulada exitosamente');
      }
    },
    onError: (error: unknown) => {
      const resData = (error as { response?: { data?: { error?: string; nota_credito?: { numero: string; estado: string; mensaje: string } } } })?.response?.data;
      if (resData?.nota_credito) {
        const nc = resData.nota_credito;
        toast.error('NC rechazada por el SRI', `NC: ${nc.numero} - ${nc.estado}: ${nc.mensaje}`);
      } else {
        toast.error(resData?.error || 'Error al anular la factura');
      }
    },
  });

  const facturasArray = Array.isArray(facturas) ? facturas : [];

  const filteredFacturas = facturasArray
    .filter((factura) => {
      const search = searchTerm.toLowerCase();
      const matchText =
        (factura.numero_factura ?? '').toLowerCase().includes(search) ||
        (factura.cliente_nombre ?? '').toLowerCase().includes(search) ||
        (factura.clave_acceso ?? '').toLowerCase().includes(search);
      const matchEstado = !filtroEstado || factura.estado === filtroEstado;
      const fechaDoc = (factura.fecha_emision ?? '').split('T')[0].split(' ')[0];
      const matchDesde = !filtroFechaDesde || fechaDoc >= filtroFechaDesde;
      const matchHasta = !filtroFechaHasta || fechaDoc <= filtroFechaHasta;
      return matchText && matchEstado && matchDesde && matchHasta;
    })
    .sort((a, b) => (b.numero_factura ?? '').localeCompare(a.numero_factura ?? '', undefined, { numeric: true }));

  const totalPages = Math.max(1, Math.ceil(filteredFacturas.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedFacturas = filteredFacturas.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalFacturas = facturasArray.length;
  const totalAutorizadas = facturasArray.filter((f) => f.estado === 'AUTORIZADO').length;
  const totalBorradores = facturasArray.filter((f) => f.estado === 'BORRADOR').length;
  const totalAnuladas = facturasArray.filter((f) => f.estado === 'ANULADO').length;

  const totalMonto = sumFacturas(facturasArray);
  const totalMontoAutorizadas = sumFacturas(facturasArray.filter((f) => f.estado === 'AUTORIZADO'));
  const totalMontoBorradores = sumFacturas(facturasArray.filter((f) => f.estado === 'BORRADOR'));
  const totalMontoAnuladas = sumFacturas(facturasArray.filter((f) => f.estado === 'ANULADO'));
  const totalFiltrado = sumFacturas(filteredFacturas);

  const statusTabs = useMemo<Array<{ value: EstadoFactura | ''; label: string; count: number }>>(() => [
    { value: '', label: 'Todos', count: facturasArray.length },
    { value: 'AUTORIZADO' as EstadoFactura, label: 'Autorizado', count: totalAutorizadas },
    { value: 'BORRADOR' as EstadoFactura, label: 'Borrador', count: totalBorradores },
    { value: 'ANULADO' as EstadoFactura, label: 'Anulado', count: totalAnuladas },
  ], [facturasArray.length, totalAutorizadas, totalBorradores, totalAnuladas]);

  const handleEdit = (factura: Factura) => {
    setSelectedFactura(factura);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDuplicate = (factura: Factura) => {
    setSelectedFactura(factura);
    setModalMode('duplicate');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirmDialog('¿Está seguro de eliminar esta factura?', undefined, 'danger')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEnviarSRI = async (id: number) => {
    if (await confirmDialog('¿Enviar factura al SRI?')) {
      enviarSRIMutation.mutate(id);
    }
  };

  const handleAnular = async (id: number, estado?: string) => {
    const esAutorizada = estado === 'AUTORIZADO';
    const ok = await confirmDialog(
      esAutorizada ? 'Anular factura autorizada' : '¿Anular esta factura?',
      esAutorizada ? 'Se generará y enviará una Nota de Crédito al SRI automáticamente.' : undefined,
      'danger',
    );
    if (!ok) return;

    let motivo = 'Anulación de factura';
    if (esAutorizada) {
      const input = await promptDialog(
        'Motivo de anulación',
        'Requerido por el SRI.',
        'Motivo',
        'Anulación de factura',
      );
      if (input === null) return;
      motivo = input.trim() || 'Anulación de factura';
    }
    anularMutation.mutate({ id, motivo });
  };

  const handleDescargarPDF = async (id: number, numero: string) => {
    try {
      const blob = await facturasService.descargarPDF(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${numero}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar PDF');
    }
  };

  const handleDescargarXML = async (id: number, numero: string) => {
    try {
      const blob = await facturasService.descargarXML(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${numero}.xml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar XML');
    }
  };

  const updateSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const updateEstado = (value: EstadoFactura | '') => {
    setFiltroEstado(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFiltroEstado('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 bg-slate-50 p-6">
      <FiscalReadinessBanner />

      <div className="w-full space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Facturación Electrónica</h1>
            <p className="mt-1 text-sm text-slate-500">Gestión de facturas electrónicas SRI · Ecuador</p>
          </div>
          <button
            onClick={() => {
              setSelectedFactura(null);
              setModalMode('create');
              setIsModalOpen(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800"
          >
            <FiPlus /> Nueva Factura
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <MetricCard title="Total facturas" value={totalFacturas} amount={formatMoney(totalMonto)} icon={<FiFileText />} tone="blue" />
          <MetricCard title="Autorizadas" value={totalAutorizadas} amount={formatMoney(totalMontoAutorizadas)} icon={<FiCheckCircle />} tone="emerald" />
          <MetricCard title="Borradores" value={totalBorradores} amount={formatMoney(totalMontoBorradores)} icon={<FiFileText />} tone="amber" />
          <MetricCard title="Anuladas" value={totalAnuladas} amount={formatMoney(totalMontoAnuladas)} icon={<FiXCircle />} tone="red" />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-[260px] flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por número de factura o cliente..."
                value={searchTerm}
                onChange={(event) => updateSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              {(filtroEstado || filtroFechaDesde || filtroFechaHasta || searchTerm) && (
                <button
                  onClick={clearFilters}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Limpiar
                </button>
              )}
              <ExportButtons
                basePath="/facturacion/facturas"
                filename="facturas"
                queryString={[
                  filtroEstado && `comprobante__estado=${filtroEstado}`,
                  filtroFechaDesde && `comprobante__fecha_emision__gte=${filtroFechaDesde}`,
                  filtroFechaHasta && `comprobante__fecha_emision__lte=${filtroFechaHasta}`,
                  searchTerm && `search=${encodeURIComponent(searchTerm)}`,
                ].filter(Boolean).join('&')}
              />
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
            <p className="text-xs font-semibold text-slate-400">{filteredFacturas.length} resultado(s)</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-700" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    <th className="w-[18%] px-4 py-4 text-left">Número</th>
                    <th className="w-[28%] px-4 py-4 text-left">Cliente</th>
                    <th className="w-[10%] px-4 py-4 text-left">Fecha</th>
                    <th className="w-[10%] px-4 py-4 text-right">Total</th>
                    <th className="w-[14%] px-4 py-4 text-center">Estado</th>
                    <th className="w-[10%] px-4 py-4 text-center">Autorización</th>
                    <th className="w-[10%] px-4 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedFacturas.map((factura) => (
                    <tr key={factura.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="truncate font-mono text-sm font-black text-slate-950">{factura.numero_factura}</div>
                        {factura.clave_acceso && (
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-400">
                            <span className="truncate">{factura.clave_acceso.slice(0, 18)}...</span>
                            <button
                              type="button"
                              onClick={() => void navigator.clipboard.writeText(factura.clave_acceso ?? '')}
                              className="text-slate-300 hover:text-blue-700"
                              title="Copiar clave de acceso"
                            >
                              <FiCopy />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-black text-blue-700">
                            {(factura.cliente_nombre || 'CL').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                            {factura.cliente_nombre || `Cliente #${factura.cliente}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-500">{formatFechaLocal(factura.fecha_emision)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-950">{formatMoney(factura.total)}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${getEstadoColor(factura.estado)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {statusLabels[factura.estado] ?? factura.estado}
                          </span>
                          {(factura.estado === 'RECHAZADO' || factura.estado === 'NO_AUTORIZADO' || factura.estado === 'BORRADOR') && factura.mensajes_sri && (
                            <span
                              className={`max-w-[220px] text-center text-xs leading-tight ${
                                factura.estado === 'BORRADOR' ? 'text-amber-700' : 'text-red-600'
                              }`}
                              title={factura.mensajes_sri}
                            >
                              {factura.mensajes_sri.length > 80 ? `${factura.mensajes_sri.slice(0, 80)}...` : factura.mensajes_sri}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-slate-500">
                        {factura.numero_autorizacion
                          ? <span title={factura.clave_acceso ?? ''}>{factura.numero_autorizacion}</span>
                          : factura.clave_acceso
                            ? <span className="text-slate-400" title={factura.clave_acceso}>{factura.clave_acceso.slice(0, 12)}...</span>
                            : '-'
                        }
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-1">
                          <ActionButton title="Duplicar como borrador" onClick={() => handleDuplicate(factura)}>
                            <FiCopy />
                          </ActionButton>

                          {factura.estado === 'BORRADOR' && (
                            <>
                              <ActionButton title="Editar" onClick={() => handleEdit(factura)} tone="blue">
                                <FiEdit2 />
                              </ActionButton>
                              <ActionButton title="Enviar al SRI" onClick={() => handleEnviarSRI(factura.id)} tone="emerald">
                                <FiSend />
                              </ActionButton>
                              <ActionButton title="Eliminar" onClick={() => handleDelete(factura.id)} tone="red">
                                <FiXCircle />
                              </ActionButton>
                            </>
                          )}

                          {factura.estado === 'AUTORIZADO' && (
                            <>
                              <ActionButton title="Descargar PDF" onClick={() => handleDescargarPDF(factura.id, factura.numero_factura)} tone="blue">
                                <FiDownload />
                              </ActionButton>
                              <ActionButton title="Descargar XML" onClick={() => handleDescargarXML(factura.id, factura.numero_factura)}>
                                <FiFileText />
                              </ActionButton>
                              <ActionButton
                                title="Reenviar por email"
                                onClick={async () => {
                                  if (await confirmDialog('¿Reenviar PDF+XML al email del cliente?')) {
                                    reenviarEmailMutation.mutate(factura.id);
                                  }
                                }}
                                tone="teal"
                              >
                                <FiMail />
                              </ActionButton>
                              <ActionButton title="Anular" onClick={() => handleAnular(factura.id, factura.estado)} tone="red">
                                <FiXCircle />
                              </ActionButton>
                            </>
                          )}

                          {factura.estado === 'FIRMADO' && (
                            <ActionButton title="Enviar al SRI" onClick={() => handleEnviarSRI(factura.id)} tone="emerald">
                              <FiSend />
                            </ActionButton>
                          )}

                          {factura.estado === 'ENVIADO' && (
                            <ActionButton
                              title="Reintentar autorización SRI"
                              disabled={reprocesarMutation.isPending}
                              onClick={async () => {
                                if (await confirmDialog('¿Consultar y reintentar autorización SRI?', 'Puede tardar hasta ~30 segundos.')) {
                                  reprocesarMutation.mutate(factura.id);
                                }
                              }}
                              tone="blue"
                            >
                              <FiRefreshCw className={reprocesarMutation.isPending ? 'animate-spin' : ''} />
                            </ActionButton>
                          )}

                          {(factura.estado === 'RECHAZADO' || factura.estado === 'NO_AUTORIZADO') && (
                            <>
                              <ActionButton
                                title="Reenviar al SRI"
                                onClick={async () => {
                                  if (await confirmDialog('¿Reenviar esta factura al SRI?')) {
                                    enviarSRIMutation.mutate(factura.id);
                                  }
                                }}
                                tone="emerald"
                              >
                                <FiSend />
                              </ActionButton>
                              <ActionButton title="Anular" onClick={() => handleAnular(factura.id, factura.estado)} tone="red">
                                <FiXCircle />
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredFacturas.length === 0 && (
                <div className="py-14 text-center">
                  <FiFileText className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-600">No se encontraron facturas</p>
                  <p className="mt-1 text-xs text-slate-400">Ajusta los filtros o crea una nueva factura.</p>
                </div>
              )}
            </div>
          )}

          {!isLoading && filteredFacturas.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-400">
                {filteredFacturas.length} factura(s) · Total {formatMoney(totalFiltrado)}
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

      {isModalOpen && (
        <FacturaModal
          factura={selectedFactura}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedFactura(null);
            setModalMode('create');
          }}
          mode={modalMode}
        />
      )}
    </div>
  );
};

function sumFacturas(items: Factura[]) {
  return items.reduce((sum, factura) => sum + Number(factura.total || 0), 0);
}

function formatMoney(value: number | string) {
  return Number(value || 0).toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatFechaLocal(fecha?: string) {
  const value = (fecha ?? '').split('T')[0].split(' ')[0];
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'AUTORIZADO': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'BORRADOR': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'FIRMADO': return 'border-purple-200 bg-purple-50 text-purple-700';
    case 'ANULADO': return 'border-red-200 bg-red-50 text-red-700';
    case 'ENVIADO': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'RECHAZADO': return 'border-red-200 bg-red-100 text-red-800';
    case 'NO_AUTORIZADO': return 'border-red-200 bg-red-100 text-red-800';
    default: return 'border-slate-200 bg-slate-50 text-slate-600';
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
  onClick: () => void;
  disabled?: boolean;
  tone?: 'slate' | 'blue' | 'emerald' | 'red' | 'teal';
}) {
  const toneClass = {
    slate: 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
    blue: 'text-blue-600 hover:bg-blue-50 hover:text-blue-800',
    emerald: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800',
    red: 'text-red-500 hover:bg-red-50 hover:text-red-700',
    teal: 'text-teal-600 hover:bg-teal-50 hover:text-teal-800',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

export default FacturasPage;
