import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facturasService } from '../../services/facturasService';
import type { Factura } from '../../types';
import { FiPlus, FiSearch, FiFileText, FiCheckCircle, FiXCircle, FiDownload, FiSend, FiRefreshCw } from 'react-icons/fi';
import FacturaModal from './FacturaModal';

const FacturasPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const queryClient = useQueryClient();

  const { data: facturas, isLoading } = useQuery({
    queryKey: ['facturas'],
    queryFn: facturasService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: facturasService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
    },
  });

  const enviarSRIMutation = useMutation({
    mutationFn: facturasService.enviarSRI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      alert('Factura enviada al SRI exitosamente');
    },
    onError: () => {
      alert('Error al enviar factura al SRI');
    },
  });

  const reprocesarMutation = useMutation({
    mutationFn: facturasService.reprocesar,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const res = data as { estado?: string; numero_autorizacion?: string; mensaje?: string };
      if (res?.estado === 'AUTORIZADO') {
        alert(`✅ Factura AUTORIZADA\nNro. Autorización: ${res.numero_autorizacion}`);
      } else {
        alert(`Estado actualizado: ${res?.estado ?? '—'}\n${res?.mensaje ?? ''}`);
      }
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Error al reprocesar');
    },
  });

  const anularMutation = useMutation({
    mutationFn: facturasService.anular,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      const res = data as { mensaje?: string; nota_credito?: { numero: string; estado: string; numero_autorizacion?: string } };
      if (res?.nota_credito) {
        const nc = res.nota_credito;
        const autMsg = nc.numero_autorizacion ? `\nAutorización SRI: ${nc.numero_autorizacion}` : '';
        alert(`Factura anulada.\n\nNota de Crédito generada:\n• Número: ${nc.numero}\n• Estado: ${nc.estado}${autMsg}`);
      } else {
        alert(res?.mensaje || 'Factura anulada exitosamente');
      }
    },
    onError: (error: unknown) => {
      const resData = (error as { response?: { data?: { error?: string; nota_credito?: { numero: string; estado: string; mensaje: string } } } })?.response?.data;
      if (resData?.nota_credito) {
        const nc = resData.nota_credito;
        alert(`La Nota de Crédito fue rechazada por el SRI. La factura no fue anulada.\n\nNC: ${nc.numero}\nEstado: ${nc.estado}\n${nc.mensaje}`);
      } else {
        alert(resData?.error || 'Error al anular la factura');
      }
    },
  });

  const facturasArray = Array.isArray(facturas) ? facturas : [];

  const filteredFacturas = facturasArray.filter((factura) =>
    (factura.numero_factura ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (factura.cliente_nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (factura: Factura) => {
    setSelectedFactura(factura);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Está seguro de eliminar esta factura?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEnviarSRI = (id: number) => {
    if (window.confirm('¿Enviar factura al SRI?')) {
      enviarSRIMutation.mutate(id);
    }
  };

  const handleAnular = (id: number, estado?: string) => {
    const esAutorizada = estado === 'AUTORIZADO';
    const confirmMsg = esAutorizada
      ? '⚠️ Esta factura está AUTORIZADA.\nSe generará y enviará una Nota de Crédito al SRI automáticamente.\n\n¿Confirmar anulación?'
      : '¿Anular esta factura?';
    if (!window.confirm(confirmMsg)) return;

    let motivo = 'Anulación de factura';
    if (esAutorizada) {
      const input = window.prompt('Motivo de anulación (requerido por el SRI):', 'Anulación de factura');
      if (input === null) return; // canceló el prompt
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
      alert('Error al descargar PDF');
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
      alert('Error al descargar XML');
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Facturación Electrónica
          </h1>
          <p className="text-gray-600 mt-1">Gestión de facturas electrónicas SRI</p>
        </div>
        <button
          onClick={() => {
            setSelectedFactura(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
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
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoColor(factura.estado)}`}>
                        {factura.estado}
                      </span>
                    </td>
                    <td className="p-4 text-center text-xs text-gray-600">
                      {factura.numero_autorizacion || '-'}
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
                              className="text-indigo-600 hover:text-indigo-800 transition-colors"
                              title="Descargar XML"
                            >
                              <FiFileText />
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
                        {factura.estado === 'ENVIADO' && (
                          <button
                            onClick={() => {
                              if (window.confirm('Consultar al SRI si ya autorizó este comprobante?')) {
                                reprocesarMutation.mutate(factura.id);
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Consultar autorización SRI"
                          >
                            <FiRefreshCw />
                          </button>
                        )}
                        {(factura.estado === 'RECHAZADO' || factura.estado === 'NO_AUTORIZADO') && (
                          <>
                            <button
                              onClick={() => {
                                if (window.confirm('Re-enviar esta factura al SRI?')) {
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
