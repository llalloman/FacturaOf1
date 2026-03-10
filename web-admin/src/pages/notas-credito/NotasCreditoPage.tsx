import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notasCreditoService } from '../../services/notasCreditoService';
import { FiSearch, FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { FileCheck2 } from 'lucide-react';
import { toast } from '../../store/toastStore';

const estadoColor = (estado: string) => {
  switch (estado) {
    case 'AUTORIZADO':    return 'text-green-700 bg-green-50 border border-green-200';
    case 'ENVIADO':       return 'text-blue-700 bg-blue-50 border border-blue-200';
    case 'FIRMADO':       return 'text-indigo-700 bg-indigo-50 border border-indigo-200';
    case 'BORRADOR':      return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
    case 'RECHAZADO':
    case 'NO_AUTORIZADO': return 'text-red-700 bg-red-50 border border-red-200';
    case 'ANULADO':       return 'text-gray-600 bg-gray-100 border border-gray-300';
    default:              return 'text-gray-600 bg-gray-50 border border-gray-200';
  }
};

const NotasCreditoPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-credito'],
    queryFn: notasCreditoService.getAll,
  });

  const reprocesarMutation = useMutation({
    mutationFn: notasCreditoService.reprocesar,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notas-credito'] });
      toast.success(data.mensaje || 'Reprocesado correctamente');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al reprocesar';
      toast.error(msg);
    },
  });

  const filtered = notas.filter((n) =>
    n.numero_nota_credito?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.numero_factura_origen?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.motivo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // KPIs
  const total          = notas.length;
  const autorizadas    = notas.filter((n) => n.estado === 'AUTORIZADO').length;
  const pendientes     = notas.filter((n) => ['BORRADOR', 'FIRMADO', 'ENVIADO'].includes(n.estado)).length;
  const totalAnulado   = notas
    .filter((n) => n.estado === 'AUTORIZADO')
    .reduce((s, n) => s + Number(n.total || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FileCheck2 className="h-7 w-7 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notas de Crédito</h1>
            <p className="text-sm text-gray-500">
              Generadas al anular facturas autorizadas (codDoc 04)
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total emitidas</p>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Autorizadas</p>
          <p className="text-3xl font-bold text-green-600">{autorizadas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pendientes SRI</p>
          <p className="text-3xl font-bold text-yellow-600">{pendientes}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total anulado (autorizado)</p>
          <p className="text-3xl font-bold text-teal-600">${totalAnulado.toFixed(2)}</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4 text-sm text-teal-800">
        <strong>¿Cuándo se genera una Nota de Crédito?</strong> Automáticamente al anular una
        factura que ya fue <strong>AUTORIZADA</strong> por el SRI. No es posible crear notas de
        crédito manualmente — se emiten como respaldo del proceso de anulación.
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, factura origen, cliente o motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            Cargando notas de crédito...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <FileCheck2 className="h-12 w-12 mb-2 opacity-20" />
            <p className="font-medium">No hay notas de crédito</p>
            <p className="text-xs mt-1">Se generan al anular facturas autorizadas por el SRI</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-center w-8"></th>
                <th className="px-4 py-3 text-left">N° Nota Crédito</th>
                <th className="px-4 py-3 text-left">Factura Origen</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Fecha</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((nota) => (
                <React.Fragment key={nota.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpanded(expanded === nota.id ? null : nota.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expanded === nota.id ? (
                          <FiChevronUp className="h-4 w-4" />
                        ) : (
                          <FiChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-teal-700 font-semibold">
                      {nota.numero_nota_credito}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {nota.numero_factura_origen}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{nota.cliente_nombre}</td>
                    <td
                      className="px-4 py-3 text-gray-600 max-w-xs truncate"
                      title={nota.motivo}
                    >
                      {nota.motivo}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ${Number(nota.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {nota.fecha_emision
                        ? new Date(nota.fecha_emision).toLocaleDateString('es-EC')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${estadoColor(nota.estado)}`}
                      >
                        {nota.estado}
                      </span>
                      {nota.mensajes_sri && (
                        <div
                          className="text-xs text-red-500 mt-1 max-w-xs truncate"
                          title={nota.mensajes_sri}
                        >
                          {nota.mensajes_sri}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {['ENVIADO', 'RECHAZADO', 'NO_AUTORIZADO'].includes(nota.estado) && (
                        <button
                          onClick={() => reprocesarMutation.mutate(nota.id)}
                          disabled={reprocesarMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors disabled:opacity-50"
                          title="Consultar autorización SRI"
                        >
                          <FiRefreshCw
                            className={`h-3.5 w-3.5 ${reprocesarMutation.isPending ? 'animate-spin' : ''}`}
                          />
                          Reprocesar
                        </button>
                      )}
                      {nota.estado === 'AUTORIZADO' && (
                        <span className="text-xs text-green-600 font-medium">✓ Autorizada</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === nota.id && (
                    <tr>
                      <td colSpan={9} className="bg-teal-50/50 px-6 py-4">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Metadata */}
                          <div>
                            <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wide mb-3">
                              Información del comprobante
                            </h4>
                            <dl className="space-y-1.5 text-sm">
                              <div className="flex gap-2">
                                <dt className="text-gray-500 w-40 shrink-0">N° autorización:</dt>
                                <dd className="font-mono text-xs text-gray-800 break-all">
                                  {nota.numero_autorizacion || '—'}
                                </dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="text-gray-500 w-40 shrink-0">Subtotal sin IVA:</dt>
                                <dd className="font-semibold">${Number(nota.subtotal_sin_impuestos).toFixed(2)}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="text-gray-500 w-40 shrink-0">Descuento:</dt>
                                <dd>${Number(nota.total_descuento).toFixed(2)}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="text-gray-500 w-40 shrink-0">Total (modificación):</dt>
                                <dd className="font-bold text-teal-700">${Number(nota.total).toFixed(2)}</dd>
                              </div>
                            </dl>
                          </div>

                          {/* Items */}
                          <div>
                            <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wide mb-3">
                              Ítems
                            </h4>
                            {nota.detalles && nota.detalles.length > 0 ? (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 uppercase border-b border-gray-200">
                                    <th className="text-left pb-1">Descripción</th>
                                    <th className="text-right pb-1 w-16">Cant.</th>
                                    <th className="text-right pb-1 w-20">P. Unit.</th>
                                    <th className="text-right pb-1 w-20">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {nota.detalles.map((d, i) => (
                                    <tr key={i}>
                                      <td className="py-1 text-gray-700">{d.descripcion}</td>
                                      <td className="py-1 text-right">{Number(d.cantidad).toFixed(2)}</td>
                                      <td className="py-1 text-right">${Number(d.precio_unitario).toFixed(2)}</td>
                                      <td className="py-1 text-right font-semibold">
                                        ${Number(d.precio_total_sin_impuesto).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-xs text-gray-400">Sin detalle disponible</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default NotasCreditoPage;
