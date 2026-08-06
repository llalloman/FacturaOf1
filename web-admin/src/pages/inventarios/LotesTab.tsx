import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiCalendar, FiCheckCircle, FiPackage } from 'react-icons/fi';
import { inventariosService } from '../../services/inventariosService';
import type { LoteInventario } from '../../types';

const MILISEGUNDOS_DIA = 1000 * 60 * 60 * 24;

const inicioDelDia = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diasParaCaducar = (fechaCaducidad?: string | null) => {
  if (!fechaCaducidad) return null;
  const hoy = inicioDelDia(new Date());
  const fecha = inicioDelDia(new Date(`${fechaCaducidad}T00:00:00`));
  return Math.ceil((fecha.getTime() - hoy.getTime()) / MILISEGUNDOS_DIA);
};

const estadoVisualCaducidad = (diasRestantes: number | null, estado: LoteInventario['estado'], diasAlerta: number) => {
  if (estado === 'VENCIDO' || (diasRestantes !== null && diasRestantes < 0)) {
    return {
      label: 'Vencido',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (diasRestantes !== null && diasRestantes <= diasAlerta) {
    return {
      label: 'Por vencer',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }

  return {
    label: 'Vigente',
    className: 'bg-green-100 text-green-700 border border-green-200',
  };
};

const LotesTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [diasAlerta, setDiasAlerta] = useState(30);

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ['inventarios-lotes'],
    queryFn: () => inventariosService.getLotes({ activo: true }),
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['inventarios-alertas-caducidad', diasAlerta],
    queryFn: () => inventariosService.getAlertasCaducidad(diasAlerta),
  });

  const lotesFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return lotes;

    return lotes.filter((lote) =>
      (lote.numero_lote ?? '').toLowerCase().includes(term)
      || (lote.producto_nombre ?? '').toLowerCase().includes(term)
      || (lote.producto_codigo ?? '').toLowerCase().includes(term)
      || (lote.bodega_nombre ?? '').toLowerCase().includes(term)
    );
  }, [lotes, searchTerm]);

  const resumen = useMemo(() => {
    const hoy = inicioDelDia(new Date());

    const vencidos = lotes.filter((lote) => {
      if (!lote.fecha_caducidad) return false;
      const fecha = inicioDelDia(new Date(`${lote.fecha_caducidad}T00:00:00`));
      return fecha < hoy || lote.estado === 'VENCIDO';
    }).length;

    const porVencer = alertas.filter((lote) => {
      const dias = diasParaCaducar(lote.fecha_caducidad);
      return dias !== null && dias >= 0;
    }).length;

    const vigentes = lotes.length - vencidos - porVencer;

    return {
      total: lotes.length,
      vencidos,
      porVencer,
      vigentes: Math.max(0, vigentes),
    };
  }, [lotes, alertas]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total lotes</p>
              <p className="text-3xl font-bold text-gray-800">{resumen.total}</p>
            </div>
            <FiPackage className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Vigentes</p>
              <p className="text-3xl font-bold text-gray-800">{resumen.vigentes}</p>
            </div>
            <FiCheckCircle className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Por vencer (&lt;= {diasAlerta} días)</p>
              <p className="text-3xl font-bold text-gray-800">{resumen.porVencer}</p>
            </div>
            <FiCalendar className="text-4xl text-amber-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Vencidos</p>
              <p className="text-3xl font-bold text-gray-800">{resumen.vencidos}</p>
            </div>
            <FiAlertTriangle className="text-4xl text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="buscar_lote" className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              id="buscar_lote"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Lote, producto, código o bodega"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="dias_alerta_lote" className="block text-sm font-medium text-gray-700 mb-1">Prealerta (días)</label>
            <input
              id="dias_alerta_lote"
              type="number"
              min={1}
              value={diasAlerta}
              onChange={(event) => setDiasAlerta(Math.max(1, Number.parseInt(event.target.value || '30', 10) || 30))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Producto</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Código</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Bodega</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Lote</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Fecha caducidad</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Días restantes</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Cantidad</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.map((lote) => {
                  const diasRestantes = diasParaCaducar(lote.fecha_caducidad);
                  const badge = estadoVisualCaducidad(diasRestantes, lote.estado, diasAlerta);

                  return (
                    <tr key={lote.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-800">{lote.producto_nombre ?? '-'}</td>
                      <td className="p-3 font-mono text-sm text-gray-700">{lote.producto_codigo ?? '-'}</td>
                      <td className="p-3 text-gray-700">{lote.bodega_nombre ?? '-'}</td>
                      <td className="p-3 font-semibold text-gray-800">{lote.numero_lote}</td>
                      <td className="p-3 text-gray-700">{lote.fecha_caducidad ?? '-'}</td>
                      <td className="p-3 text-right text-gray-700">
                        {diasRestantes === null ? '-' : diasRestantes}
                      </td>
                      <td className="p-3 text-right font-semibold text-gray-800">{Number(lote.cantidad_disponible).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {lotesFiltrados.length === 0 && (
              <div className="text-center py-8 text-gray-500">No se encontraron lotes con los filtros actuales.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LotesTab;
