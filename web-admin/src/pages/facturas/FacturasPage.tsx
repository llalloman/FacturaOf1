import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facturasService } from '../../services/facturasService';
import type { Factura } from '../../types';
import { FiPlus, FiSearch, FiFileText, FiCheckCircle, FiXCircle, FiDownload, FiSend, FiRefreshCw, FiMail } from 'react-icons/fi';
import ExportButtons from '../../components/ui/ExportButtons';
import FacturaModal from './FacturaModal';
import { toast } from '../../store/toastStore';
import { confirmDialog, promptDialog } from '../../store/confirmStore';

const FacturasPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const queryClient = useQueryClient();

  const { data: facturas, isLoading } = useQuery({
    queryKey: ['facturas'],
    queryFn: facturasService.getAll,
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
        toast.success('Factura AUTORIZADA', `Nro. Autorización: ${res.numero_autorizacion}`);
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
        toast.success('Factura AUTORIZADA', `Nro. Autorización: ${res.numero_autorizacion}`);
      } else if (res?.estado === 'ENVIADO') {
        toast.warning('Pendiente de autorización en el SRI', res?.mensaje || 'Puede volver a intentar en unos segundos.');
      } else {
        toast.info(`Estado: ${res?.estado ?? '—'}`, res?.mensaje || undefined);
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
        toast.success('Factura anulada', `NC: ${nc.numero} — ${nc.estado}${autMsg}`);
      } else {
        toast.success(res?.mensaje || 'Factura anulada exitosamente');
      }
    },
    onError: (error: unknown) => {
      const resData = (error as { response?: { data?: { error?: string; nota_credito?: { numero: string; estado: string; mensaje: string } } } })?.response?.data;
      if (resData?.nota_credito) {
        const nc = resData.nota_credito;
        toast.error('NC rechazada por el SRI', `NC: ${nc.numero} — ${nc.estado}: ${nc.mensaje}`);
      } else {
        toast.error(resData?.error || 'Error al anular la factura');
      }
    },
  });

  const facturasArray = Array.isArray(facturas) ? facturas : [];

  const filteredFacturas = facturasArray
    .filter((factura) => {
      const matchText =
        (factura.numero_factura ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (factura.cliente_nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchEstado = !filtroEstado || factura.estado === filtroEstado;
      const fechaDoc = (factura.fecha_emision ?? '').split('T')[0].split(' ')[0];
      const matchDesde = !filtroFechaDesde || fechaDoc >= filtroFechaDesde;
      const matchHasta = !filtroFechaHasta || fechaDoc <= filtroFechaHasta;
      return matchText && matchEstado && matchDesde && matchHasta;
    })
    .sort((a, b) => (b.numero_factura ?? '').localeCompare(a.numero_factura ?? '', undefined, { numeric: true }));

  const handleEdit = (factura: Factura) => {
    setSelectedFactura(factura);
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
      esAutorizada ? '⚠️ Anular factura AUTORIZADA' : '¿Anular esta factura?',
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
    } catch {
      toast.error('Error al descargar XML');
    }
  };

  const totalFacturas = facturasArray.length;
  const totalAutorizadas = facturasArray.filter(f => f.estado === 'AUTORIZADO').length;
  const totalBorradores = facturasArray.filter(f => f.estado === 'BORRADOR').length;
  const totalAnuladas = facturasArray.filter(f => f.estado === 'ANULADO').length;

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'AUTORIZADO': return 'text-green-600 bg-green-50';
      case 'BORRADOR': return 'text-yellow-600 bg-yellow-50';
      case 'FIRMADO': return 'text-purple-600 bg-purple-50';
      case 'ANULADO': return 'text-red-600 bg-red-50';
      case 'ENVIADO': return 'text-blue-600 bg-blue-50';
      case 'RECHAZADO': return 'text-red-700 bg-red-100';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-slate-600 bg-clip-text text-transparent">
            Facturación Electrónica
          </h1>
          <p className="text-gray-600 mt-1">Gestión de facturas electrónicas SRI</p>
        </div>
        <button
          onClick={() => {
            setSelectedFactura(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-lg hover:from-blue-800 hover:to-blue-950 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FiPlus /> Nueva Factura
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Facturas</p>
              <p className="text-3xl font-bold text-gray-800">{totalFacturas}</p>
            </div>
            <FiFileText className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Autorizadas</p>
              <p className="text-3xl font-bold text-gray-800">{totalAutorizadas}</p>
            </div>
            <FiCheckCircle className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Borradores</p>
              <p className="text-3xl font-bold text-gray-800">{totalBorradores}</p>
            </div>
            <FiFileText className="text-4xl text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Anuladas</p>
              <p className="text-3xl font-bold text-gray-800">{totalAnuladas}</p>
            </div>
            <FiXCircle className="text-4xl text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* ── Filtros ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="FIRMADO">Firmado</option>
            <option value="ENVIADO">Enviado</option>
            <option value="AUTORIZADO">Autorizado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="ANULADO">Anulado</option>
          </select>
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            title="Fecha desde"
          />
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            title="Fecha hasta"
          />
          {(filtroEstado || filtroFechaDesde || filtroFechaHasta) && (
            <button
              onClick={() => { setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta(''); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg hover:border-red-400 transition-colors"
            >
              Limpiar filtros
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

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-slate-50">
                  <th className="text-left p-4 font-semibold text-gray-700">Número</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Cliente</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Total</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Autorización</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacturas.map((factura) => (
                  <tr key={factura.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{factura.numero_factura}</td>
                    <td className="p-4 text-gray-700">{factura.cliente_nombre || `Cliente #${factura.cliente}`}</td>
                    <td className="p-4 text-gray-700">{new Date(factura.fecha_emision).toLocaleDateString()}</td>
                    <td className="p-4 text-right font-semibold text-gray-900">${Number(factura.total).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoColor(factura.estado)}`}>
                          {factura.estado}
                        </span>
                        {(factura.estado === 'RECHAZADO' || factura.estado === 'NO_AUTORIZADO') && factura.mensajes_sri && (
                          <span className="text-xs text-red-600 max-w-[200px] text-center leading-tight" title={factura.mensajes_sri}>
                            {factura.mensajes_sri.length > 80 ? factura.mensajes_sri.slice(0, 80) + '…' : factura.mensajes_sri}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center text-xs text-gray-600">
                      {factura.numero_autorizacion
                        ? <span title={factura.clave_acceso ?? ''}>{factura.numero_autorizacion}</span>
                        : factura.clave_acceso
                          ? <span className="text-gray-400" title={factura.clave_acceso}>{factura.clave_acceso.slice(0, 12)}…</span>
                          : '-'
                      }
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        {factura.estado === 'BORRADOR' && (
                          <>
                            <button
                              onClick={() => handleEdit(factura)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Editar"
                            >
                              <FiFileText />
                            </button>
                            <button
                              onClick={() => handleEnviarSRI(factura.id)}
                              className="text-green-600 hover:text-green-800 transition-colors"
                              title="Enviar al SRI"
                            >
                              <FiSend />
                            </button>
                            <button
                              onClick={() => handleDelete(factura.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Eliminar"
                            >
                              <FiXCircle />
                            </button>
                          </>
                        )}
                        {factura.estado === 'AUTORIZADO' && (
                          <>
                            <button
                              onClick={() => handleDescargarPDF(factura.id, factura.numero_factura)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Descargar PDF"
                            >
                              <FiDownload />
                            </button>
                            <button
                              onClick={() => handleDescargarXML(factura.id, factura.numero_factura)}
                              className="text-blue-700 hover:text-blue-800 transition-colors"
                              title="Descargar XML"
                            >
                              <FiFileText />
                            </button>
                            <button
                              onClick={async () => {
                                if (await confirmDialog('Reenviar PDF+XML al email del cliente?')) {
                                  reenviarEmailMutation.mutate(factura.id);
                                }
                              }}
                              className="text-teal-600 hover:text-teal-800 transition-colors"
                              title="Reenviar por email"
                            >
                              <FiMail />
                            </button>
                            <button
                              onClick={() => handleAnular(factura.id, factura.estado)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Anular"
                            >
                              <FiXCircle />
                            </button>
                          </>
                        )}
                        {factura.estado === 'FIRMADO' && (
                          <button
                            onClick={() => handleEnviarSRI(factura.id)}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Enviar al SRI (ya firmado)"
                          >
                            <FiSend />
                          </button>
                        )}
                        {factura.estado === 'ENVIADO' && (
                          <button
                            onClick={async () => {
                              if (await confirmDialog('Consultar y reintentar autorización SRI?', 'Puede tardar hasta ~30 segundos.')) {
                                reprocesarMutation.mutate(factura.id);
                              }
                            }}
                            disabled={reprocesarMutation.isPending}
                            className="text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-40"
                            title="Reintentar autorización SRI"
                          >
                            <FiRefreshCw className={reprocesarMutation.isPending ? 'animate-spin' : ''} />
                          </button>
                        )}
                        {(factura.estado === 'RECHAZADO' || factura.estado === 'NO_AUTORIZADO') && (
                          <>
                            <button
                              onClick={async () => {
                                if (await confirmDialog('Re-enviar esta factura al SRI?')) {
                                  enviarSRIMutation.mutate(factura.id);
                                }
                              }}
                              className="text-green-600 hover:text-green-800 transition-colors"
                              title="Re-enviar al SRI"
                            >
                              <FiSend />
                            </button>
                            <button
                              onClick={() => handleAnular(factura.id, factura.estado)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Anular"
                            >
                              <FiXCircle />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredFacturas.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No se encontraron facturas
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <FacturaModal
          factura={selectedFactura}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedFactura(null);
          }}
        />
      )}
    </div>
  );
};

export default FacturasPage;
