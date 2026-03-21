import { useEffect, useState, useRef } from 'react';
import { usePOSStore } from '../store/posStore';
import { apiService } from '../services/apiService';
import { PagoVenta, Venta } from '../types';
import { toast } from '../store/toastStore';

interface SRIResultado {
  ventaNumero: string;
  cambio: number;
  factura?: {
    numero_comprobante: string;
    estado: string;
    mensaje: string;
    numero_autorizacion?: string;
  };
  facturaError?: string;
  // Receipt data for printing
  receiptData?: Record<string, any>;
}

interface PaymentModalProps {
  onClose: () => void;
}

export default function PaymentModal({ onClose }: PaymentModalProps) {
  const config = usePOSStore((state) => state.config);
  const items = usePOSStore((state) => state.items);
  const cliente = usePOSStore((state) => state.cliente);
  const getTotal = usePOSStore((state) => state.getTotal);
  const getSubtotal = usePOSStore((state) => state.getSubtotal);
  const getIVATotal = usePOSStore((state) => state.getIVATotal);
  const getDescuentoTotal = usePOSStore((state) => state.getDescuentoTotal);
  const limpiarCarrito = usePOSStore((state) => state.limpiarCarrito);

  const total = getTotal();
  const esConsumidorFinal = !!cliente && (
    cliente.tipo_identificacion === '07'
    || cliente.identificacion === '9999999999999'
    || cliente.razon_social.trim().toUpperCase() === 'CONSUMIDOR FINAL'
  );
  const bloqueaFactura = esConsumidorFinal && total > 50;
  
  const [pagos, setPagos] = useState<PagoVenta[]>([]);
  const [metodoPago, setMetodoPago] = useState<PagoVenta['metodo_pago']>('EFECTIVO');
  const [monto, setMonto] = useState<string>(total.toFixed(2));
  const [procesando, setProcesando] = useState(false);
  const [generaFactura, setGeneraFactura] = useState(false);
  const [etapa, setEtapa] = useState<'pago' | 'procesando' | 'resultado'>('pago');
  const [mensajeProceso, setMensajeProceso] = useState('');
  const [resultadoSRI, setResultadoSRI] = useState<SRIResultado | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const pendiente = total - totalPagado;
  const cambio = totalPagado > total ? totalPagado - total : 0;

  useEffect(() => {
    if (bloqueaFactura && generaFactura) {
      setGeneraFactura(false);
    }
  }, [bloqueaFactura, generaFactura]);

  const agregarPago = () => {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.warning('Ingrese un monto válido');
      return;
    }

    setPagos([...pagos, { metodo_pago: metodoPago, monto: montoNum }]);
    setMonto('0');
  };

  const eliminarPago = (index: number) => {
    setPagos(pagos.filter((_, i) => i !== index));
  };

  const handleFinalizarVenta = async () => {
    if (pendiente > 0) {
      toast.warning('Aún falta por cobrar');
      return;
    }

    if (!cliente || !config) {
      toast.error('Datos incompletos');
      return;
    }

    if (generaFactura && bloqueaFactura) {
      toast.warning(
        'Consumidor final no puede emitir factura SRI por montos mayores a $50. Registra la venta sin factura o selecciona un cliente identificado.'
      );
      return;
    }

    setProcesando(true);
    setEtapa('procesando');

    try {
      const now = new Date();
      const numeroVenta = `V-${now.getTime()}`;

      const ventaData: Venta = {
        numero_venta: numeroVenta,
        empresa_id: config.empresa_id,
        caja_id: config.caja_id,
        usuario_id: config.usuario_id,
        cliente_id: cliente.id,
        fecha_venta: now.toISOString(),
        subtotal: getSubtotal(),
        descuento: getDescuentoTotal(),
        iva: getIVATotal(),
        total: getTotal(),
        estado: 'COMPLETADA',
        detalles: items,
        pagos: pagos,
      };

      // Paso 1 — guardar localmente (SQLite / Electron)
      setMensajeProceso('Guardando venta...');
      let localUuid: string | undefined;

      if (window.electron?.ventas?.crear) {
        const result = await window.electron.ventas.crear(ventaData);
        if (!result.success) throw new Error(result.error || 'Error al crear la venta');
        localUuid = result.uuid;
      } else {
        // Modo web – simular UUID local
        localUuid = crypto.randomUUID();
      }

      // Paso 2 — si se pidió factura electrónica, sincronizar y enviar al SRI
      let facturaInfo: SRIResultado['factura'] | undefined;
      let facturaError: string | undefined;

      if (generaFactura && localUuid) {
        try {
          setMensajeProceso('Sincronizando con servidor...');
          const syncResult = await apiService.sincronizarVenta({ ...ventaData, uuid: localUuid });

          if (syncResult.success && syncResult.data?.id) {
            setMensajeProceso('Enviando al SRI… (puede tardar hasta 30 s)');
            const factResult = await apiService.generarFactura(syncResult.data.id);

            if (factResult.success) {
              const sri = factResult.data?.sri ?? {};
              const factura = factResult.data?.factura ?? {};
              facturaInfo = {
                numero_comprobante: sri.numero_comprobante ?? factura.numero_comprobante ?? '—',
                estado: sri.estado ?? '—',
                mensaje: sri.mensaje ?? '',
                numero_autorizacion: factura.comprobante?.numero_autorizacion,
              };
            } else {
              facturaError = factResult.error ?? 'Error al generar la factura';
            }
          } else {
            facturaError = 'No se pudo sincronizar con el servidor';
          }
        } catch (err: any) {
          facturaError = err.message;
        }
      }

      limpiarCarrito();
      
      // Build receipt data for printing
      const receiptData = {
        numero_venta: numeroVenta,
        fecha_venta: now.toISOString(),
        cliente_nombre: cliente.razon_social,
        cliente_identificacion: cliente.identificacion,
        subtotal: getSubtotal(),
        descuento: getDescuentoTotal(),
        iva: getIVATotal(),
        total: getTotal(),
        detalles: items,
        pagos: pagos,
        cambio,
        factura_numero: facturaInfo?.numero_comprobante,
        autorizacion: facturaInfo?.numero_autorizacion,
      };
      
      setResultadoSRI({ ventaNumero: numeroVenta, cambio, factura: facturaInfo, facturaError, receiptData });
      setEtapa('resultado');
    } catch (error: any) {
      console.error('Error procesando venta:', error);
      toast.error('Error al procesar la venta', error.message);
      setEtapa('pago');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Procesar Pago</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={procesando}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ── PANTALLA: resultado final ── */}
        {etapa === 'resultado' && resultadoSRI && (
          <div className="p-8 space-y-5">
            <div className="text-center">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-xl font-bold text-gray-800">Venta Registrada</h3>
              <p className="text-gray-500 text-sm">{resultadoSRI.ventaNumero}</p>
              {resultadoSRI.cambio > 0 && (
                <div className="mt-3 text-3xl font-bold text-orange-500">
                  Cambio: ${resultadoSRI.cambio.toFixed(2)}
                </div>
              )}
            </div>

            {/* Resultado SRI */}
            {resultadoSRI.facturaError ? (
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                <p className="font-semibold text-yellow-700">⚠️ Factura no generada</p>
                <p className="text-sm text-yellow-600 mt-1">{resultadoSRI.facturaError}</p>
                <p className="text-xs text-yellow-500 mt-1">Puede generarla manualmente desde el módulo de Facturas.</p>
              </div>
            ) : resultadoSRI.factura ? (
              <div className={`p-4 rounded-lg border ${
                resultadoSRI.factura.estado === 'AUTORIZADO'
                  ? 'bg-green-50 border-green-300'
                  : resultadoSRI.factura.estado === 'ENVIADO'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <p className="font-semibold">
                  {resultadoSRI.factura.estado === 'AUTORIZADO' ? '✅' :
                   resultadoSRI.factura.estado === 'ENVIADO' ? '🕐' : '❌'}{' '}
                  Factura {resultadoSRI.factura.numero_comprobante}
                </p>
                <p className="text-sm mt-1">
                  Estado SRI: <strong>{resultadoSRI.factura.estado}</strong>
                </p>
                {resultadoSRI.factura.numero_autorizacion && (
                  <p className="text-xs text-gray-600 mt-1 break-all">
                    Autorización: {resultadoSRI.factura.numero_autorizacion}
                  </p>
                )}
                {resultadoSRI.factura.mensaje && (
                  <p className="text-sm text-gray-600 mt-1">{resultadoSRI.factura.mensaje}</p>
                )}
              </div>
            ) : null}

            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              Cerrar
            </button>

            {/* Print buttons */}
            <div className="flex gap-2 mt-2">
              {window.electron?.print && (
                <button
                  onClick={async () => {
                    if (!resultadoSRI?.receiptData) return;
                    setImprimiendo(true);
                    try {
                      const res = await window.electron!.print.receipt(resultadoSRI.receiptData);
                      if (res.success) {
                        toast.info('Recibo enviado a la impresora');
                      } else {
                        toast.error('Error al imprimir', res.error);
                      }
                    } catch (err: any) {
                      toast.error('Error al imprimir', err.message);
                    } finally {
                      setImprimiendo(false);
                    }
                  }}
                  disabled={imprimiendo}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 text-sm"
                >
                  {imprimiendo ? '⏳ Imprimiendo...' : '🖨️ Imprimir Recibo'}
                </button>
              )}
              {!window.electron?.print && (
                <button
                  onClick={() => {
                    // Fallback: browser print
                    window.print();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
                >
                  🖨️ Imprimir
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── PANTALLA: procesando ── */}
        {etapa === 'procesando' && (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <p className="text-lg font-semibold text-gray-700">{mensajeProceso}</p>
            {mensajeProceso.includes('SRI') && (
              <p className="text-sm text-gray-500 mt-2">Esto puede tardar hasta 30 segundos</p>
            )}
          </div>
        )}

        {/* ── PANTALLA: formulario de pago ── */}
        {etapa === 'pago' && (
          <>
            {/* Totales */}
            <div className="p-6 bg-gray-50 space-y-2">
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total a cobrar:</span>
                <span className="font-bold text-blue-600">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total pagado:</span>
                <span className="font-bold text-green-600">${totalPagado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg border-t border-gray-300 pt-2">
                <span className="font-semibold">Pendiente:</span>
                <span className={`font-bold ${pendiente > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  ${pendiente.toFixed(2)}
                </span>
              </div>
              {cambio > 0 && (
                <div className="flex justify-between text-xl border-t border-gray-300 pt-2">
                  <span className="font-bold">CAMBIO:</span>
                  <span className="font-bold text-orange-600">${cambio.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Agregar pago */}
            <div className="p-6 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as PagoVenta['metodo_pago'])}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CREDITO">Crédito</option>
              </select>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={agregarPago}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Lista de pagos */}
            {pagos.length > 0 && (
              <div className="p-6 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-3">Pagos registrados:</h3>
                <div className="space-y-2">
                  {pagos.map((pago, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{pago.metodo_pago}</span>
                        <span className="text-gray-600 ml-3">${pago.monto.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => eliminarPago(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opción factura electrónica */}
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3">
              <input
                type="checkbox"
                id="genera_factura"
                checked={generaFactura}
                onChange={(e) => setGeneraFactura(e.target.checked)}
                disabled={bloqueaFactura}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="genera_factura" className="text-sm font-medium text-gray-700 cursor-pointer">
                Generar Factura Electrónica (SRI)
              </label>
            </div>
            {bloqueaFactura && (
              <div className="px-6 py-3 border-b border-gray-200 text-sm text-amber-800 bg-amber-50">
                Para consumidor final no puedes emitir factura SRI cuando el total supera $50. Puedes registrar la venta y emitir recibo.
                Si necesitas factura SRI,
                selecciona un cliente con cédula, RUC, pasaporte o identificación del exterior.
              </div>
            )}

            {/* Botones */}
            <div className="p-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={procesando}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizarVenta}
                disabled={pendiente > 0 || procesando}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {procesando ? 'Procesando...' : 'Finalizar Venta'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
