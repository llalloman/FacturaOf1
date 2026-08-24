import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, CheckCircle, Clock, ChefHat,
  CreditCard, Users, MessageSquare, ShoppingBag, RefreshCw,
  Search, X, DollarSign,
} from 'lucide-react';
import { pedidosService, type Pedido, type DetallePedido, type PagoPayload } from '../../services/pedidosService';
import { productosService } from '../../services/productosService';
import { cajasService } from '../../services/cajasService';
import { clientesService } from '../../services/clientesService';
import { getResumen, type CuentaBancaria } from '../../services/bancosService';
import type { Producto, Cliente, Caja } from '../../types';

// Helpers

const ESTADO_ITEM_COLOR: Record<DetallePedido['estado'], string> = {
  PENDIENTE:       'bg-gray-100  text-gray-600',
  EN_PREPARACION:  'bg-blue-100  text-blue-700',
  LISTO:           'bg-green-100 text-green-700',
  ENTREGADO:       'bg-purple-100 text-purple-700',
  CANCELADO:       'bg-red-100   text-red-500 line-through opacity-60',
};

const ESTADO_PEDIDO_COLOR: Record<Pedido['estado'], string> = {
  ABIERTO:         'bg-blue-100   text-blue-700',
  EN_PREPARACION:  'bg-orange-100 text-orange-700',
  LISTO:           'bg-green-100  text-green-700',
  PAGADO:          'bg-purple-100 text-purple-700',
  CANCELADO:       'bg-red-100    text-red-700',
};

const PAGO_LABELS: Record<PagoPayload['forma_pago'], string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_DEBITO: 'Tarjeta debito',
  TARJETA_CREDITO: 'Tarjeta credito',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  CREDITO: 'Credito',
};

// Convertir código de IVA SRI a decimal
const getIVADecimal = (porcentajeIva: string, aplica: boolean): number => {
  if (!aplica) return 0;
  const rates: Record<string, number> = {
    '0': 0,      // 0%
    '2': 0.12,   // 12%
    '4': 0.15,   // 15%
    '6': 0,      // No objeto
    '7': 0,      // Exento
  };
  return rates[porcentajeIva] ?? 0;
};

// Modal: Agregar producto

interface AgregarItemModalProps {
  productos: Producto[];
  onClose: () => void;
  onAdd: (item: { producto: number; cantidad: number; precio_unitario: number; descuento?: number; notas?: string }) => Promise<void>;
}

function AgregarItemModal({ productos, onClose, onAdd }: AgregarItemModalProps) {
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [descuento, setDescuento] = useState('0');
  const [modoDescuento, setModoDescuento] = useState<'monto' | 'porcentaje' | 'precio_final'>('monto');
  const [precioFinal, setPrecioFinal] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const filtrados = productos.filter(p =>
    p.activo && (
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo_principal.toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  // Usar precio SIN IVA para base bruta
  const precioSinIva = seleccionado ? Number(seleccionado.precio) : 0;
  const subtotalBruto = precioSinIva * cantidad;
  const ivaRate = seleccionado ? getIVADecimal(seleccionado.porcentaje_iva, seleccionado.aplica_iva) : 0;

  // Calcular descuento según el modo
  let descuentoMonto = 0;
  if (modoDescuento === 'monto') {
    descuentoMonto = Math.max(0, Number(descuento) || 0);
  } else if (modoDescuento === 'porcentaje') {
    const porcentaje = Math.max(0, Number(descuento) || 0);
    descuentoMonto = (subtotalBruto * porcentaje) / 100;
  } else if (modoDescuento === 'precio_final') {
    const pf = Math.max(0, Number(precioFinal) || 0);
    descuentoMonto = Math.max(0, subtotalBruto - pf);
  }

  // Validar que no exceda el subtotal
  descuentoMonto = Math.min(descuentoMonto, subtotalBruto);

  // Cálculos finales
  const subtotalNeto = Math.max(0, subtotalBruto - descuentoMonto);
  const iva = subtotalNeto * ivaRate;
  const totalConIva = subtotalNeto + iva;

  const handleAdd = async () => {
    if (!seleccionado) return;
    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }
    setSaving(true);

    await onAdd({
      producto: seleccionado.id,
      cantidad,
      precio_unitario: Number(seleccionado.precio),
      descuento: Math.round(descuentoMonto * 100) / 100,
      notas: notas.trim(),
    });
    setSaving(false);
  };

  // Helper para aplicar descuentos predefinidos
  const aplicarDescuentoPredefinido = (porcentaje: number) => {
    setModoDescuento('porcentaje');
    setDescuento(porcentaje.toString());
    setPrecioFinal('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Agregar ítem</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Búsqueda */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input
              autoFocus
              className="bg-transparent flex-1 text-sm outline-none placeholder-gray-400"
              placeholder="Buscar producto o código…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
          {filtrados.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Sin resultados</p>
          )}
          {filtrados.map(p => (
            <button
              key={p.id}
              onClick={() => setSeleccionado(p)}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                seleccionado?.id === p.id
                  ? 'bg-indigo-50 border border-indigo-300'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-gray-800">{p.nombre}</div>
                <div className="text-xs text-gray-400">{p.codigo_principal} · {p.tipo}</div>
              </div>
              <div className="text-sm font-semibold text-indigo-600">${Number(p.precio_con_iva ?? p.precio).toFixed(2)}</div>
            </button>
          ))}
        </div>

        {/* Panel de selección */}
        {seleccionado && (
          <div className="border-t border-gray-200 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 truncate">{seleccionado.nombre}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCantidad(c => Math.max(1, c - 1))}
                    className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-lg font-light">-</button>
                  <span className="w-8 text-center text-sm font-semibold">{cantidad}</span>
                  <button onClick={() => setCantidad(c => c + 1)}
                    className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-lg font-light">+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio Unitario</label>
                <div className="text-sm">
                  <p className="text-xs text-gray-600 font-mono">${precioSinIva.toFixed(2)} (sin IVA)</p>
                  <p className="text-xs text-gray-400 font-mono">${(precioSinIva * (1 + ivaRate)).toFixed(2)} (con {(ivaRate * 100).toFixed(0)}% IVA)</p>
                </div>
              </div>
            </div>
            {/* Resumen de precios */}
            <div className="bg-indigo-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (sin descuento):</span>
                <span className="font-semibold text-gray-800">${subtotalBruto.toFixed(2)}</span>
              </div>
              {descuentoMonto > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento ({modoDescuento === 'porcentaje' ? `${Number(descuento)}%` : 'monto'}):</span>
                  <span className="font-semibold">-${descuentoMonto.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-indigo-200 pt-1 font-semibold">
                <span className="text-gray-600">Subtotal Neto:</span>
                <span className="text-indigo-700">${subtotalNeto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA ({(ivaRate * 100).toFixed(0)}%):</span>
                <span className="font-semibold">${iva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-indigo-200 pt-1">
                <span>TOTAL c/IVA:</span>
                <span className="text-indigo-700">${totalConIva.toFixed(2)}</span>
              </div>
            </div>

            {/* Modo de Descuento */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-semibold">CONFIGURAR DESCUENTO</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setModoDescuento('monto'); setDescuento('0'); setPrecioFinal(''); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    modoDescuento === 'monto'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Por Monto
                </button>
                <button
                  onClick={() => { setModoDescuento('porcentaje'); setDescuento('0'); setPrecioFinal(''); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    modoDescuento === 'porcentaje'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Por Porcentaje
                </button>
                <button
                  onClick={() => { setModoDescuento('precio_final'); setDescuento('0'); setPrecioFinal(subtotalBruto.toFixed(2)); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    modoDescuento === 'precio_final'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Precio Final
                </button>
              </div>
            </div>

            {/* Entrada según modo */}
            {modoDescuento === 'monto' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descuento en $</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={descuento}
                  onChange={e => setDescuento(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            {modoDescuento === 'porcentaje' && (
              <div>
                <label className="block text-xs text-gray-500 mb-2">Descuento en %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  value={descuento}
                  onChange={e => setDescuento(e.target.value)}
                  placeholder="0.0"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[5, 10, 15, 20].map(p => (
                    <button
                      key={p}
                      onClick={() => aplicarDescuentoPredefinido(p)}
                      className="text-xs py-1 px-1 rounded bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modoDescuento === 'precio_final' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">¿Cuánto quieres cobrar (sin IVA)?</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={precioFinal}
                  onChange={e => setPrecioFinal(e.target.value)}
                  placeholder={subtotalBruto.toFixed(2)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Sistema calculará automáticamente el descuento necesario
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notas (sin cebolla, etc.)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Indicaciones especiales..."
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saving ? 'Agregando...' : 'Agregar al pedido'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal: Cobrar

interface CobrarModalProps {
  pedido: Pedido;
  cajas: Caja[];
  clientes: Cliente[];
  onClose: () => void;
  onCobrado: () => void;
}

function CobrarModal({ pedido, cajas, clientes, onClose, onCobrado }: CobrarModalProps) {
  const [cajaId, setCajaId] = useState<number>(cajas[0]?.id ?? 0);
  const [clienteId, setClienteId] = useState<number>(
    clientes.find(c => c.identificacion === '9999999999999')?.id ?? (clientes[0]?.id ?? 0)
  );
  const [formaPago, setFormaPago] = useState<PagoPayload['forma_pago']>('EFECTIVO');
  const [cuentaBancariaId, setCuentaBancariaId] = useState<number | ''>('');
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [montoEfectivo, setMontoEfectivo] = useState(Number(pedido.total).toFixed(2));
  const [referencia, setReferencia] = useState('');
  const [generaFactura, setGeneraFactura] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vuelto = Number(montoEfectivo) - Number(pedido.total);
  const requiereCuenta = formaPago !== 'CREDITO';
  const clienteSeleccionado = clientes.find(c => c.id === clienteId) ?? null;
  const esConsumidorFinal = !!clienteSeleccionado && (
    clienteSeleccionado.tipo_identificacion === '07'
    || clienteSeleccionado.identificacion === '9999999999999'
    || clienteSeleccionado.razon_social.trim().toUpperCase() === 'CONSUMIDOR FINAL'
  );
  const bloqueaFactura = esConsumidorFinal && Number(pedido.total) > 50;

  useEffect(() => {
    if (bloqueaFactura && generaFactura) {
      setGeneraFactura(false);
    }
  }, [bloqueaFactura, generaFactura]);

  useEffect(() => {
    getResumen()
      .then((res) => setCuentas(res.cuentas.filter((cuenta) => cuenta.activa)))
      .catch(() => setCuentas([]));
  }, []);

  const handleCobrar = async () => {
    if (!cajaId) { setError('Selecciona una caja.'); return; }
    if (!clienteId) { setError('Selecciona un cliente.'); return; }
    if (requiereCuenta && !cuentaBancariaId) { setError('Selecciona la cuenta destino del pago.'); return; }
    if (generaFactura && bloqueaFactura) {
      setError('Consumidor final no puede emitir factura SRI por montos mayores a $50. Cobra el pedido sin factura o selecciona un cliente identificado.');
      return;
    }
    setSaving(true);
    try {
      await pedidosService.cobrar(pedido.id, {
        caja_id: cajaId,
        cliente_id: clienteId,
        genera_factura: generaFactura,
        pagos: [{
          forma_pago: formaPago,
          monto: Number(pedido.total),
          referencia,
          cuenta_bancaria: requiereCuenta ? Number(cuentaBancariaId) : null,
        }],
      });
      onCobrado();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al procesar el cobro.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard size={20} className="text-green-600" /> Cobrar pedido
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Total */}
          <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
            <div className="text-sm text-indigo-600">Total a cobrar</div>
            <div className="text-3xl font-bold text-indigo-700">${Number(pedido.total).toFixed(2)}</div>
          </div>

          {/* Caja */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caja</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={cajaId}
              onChange={e => setCajaId(Number(e.target.value))}
            >
              {cajas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={clienteId}
              onChange={e => setClienteId(Number(e.target.value))}
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.razon_social} — {c.identificacion}</option>
              ))}
            </select>
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pago</label>
            <div className="grid grid-cols-2 gap-2">
              {(['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'CHEQUE', 'CREDITO'] as PagoPayload['forma_pago'][]).map(fp => (
                <button
                  key={fp}
                  onClick={() => {
                    setFormaPago(fp);
                    setError('');
                  }}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition ${
                    formaPago === fp
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {PAGO_LABELS[fp]}
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo recibido → vuelto */}
          {requiereCuenta && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta destino</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={cuentaBancariaId}
                onChange={e => setCuentaBancariaId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Seleccione cuenta</option>
                {cuentas.map(cuenta => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.banco} - {cuenta.numero_cuenta} ({cuenta.tipo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formaPago === 'EFECTIVO' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Efectivo recibido</label>
                <input
                  type="number" step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={montoEfectivo}
                  onChange={e => setMontoEfectivo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vuelto</label>
                <div className={`text-lg font-bold mt-1 ${vuelto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${vuelto.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Referencia */}
          {formaPago !== 'EFECTIVO' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Referencia / Comprobante</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                placeholder="Número de transacción…"
              />
            </div>
          )}

          {/* Factura electrónica */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-indigo-600"
              checked={generaFactura}
              onChange={e => setGeneraFactura(e.target.checked)}
              disabled={bloqueaFactura}
            />
            <span className="text-sm text-gray-700">Generar factura electrónica SRI</span>
          </label>
          {bloqueaFactura && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              Para consumidor final no puedes generar factura SRI cuando el total supera $50. Cobra sin factura o selecciona un cliente identificado.
            </p>
          )}

          <button
            onClick={handleCobrar}
            disabled={saving}
            className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? 'Procesando…' : `Cobrar $${Number(pedido.total).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Ítem de detalle

interface DetalleItemProps {
  item: DetallePedido;
  onCambiarEstado: (estado: DetallePedido['estado']) => void;
  onEliminar: () => void;
  pedidoCerrado: boolean;
}

function DetalleItem({ item, onCambiarEstado, onEliminar, pedidoCerrado }: DetalleItemProps) {
  const [loading, setLoading] = useState(false);
  const isCancelado = item.estado === 'CANCELADO';

  const handleEstado = async (estado: DetallePedido['estado']) => {
    setLoading(true);
    await onCambiarEstado(estado);
    setLoading(false);
  };

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 ${isCancelado ? 'opacity-50' : ''}`}>
      {/* Estado badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${ESTADO_ITEM_COLOR[item.estado]}`}>
        {item.estado === 'PENDIENTE' ? <Clock size={10} className="inline mr-1" /> : null}
        {item.estado === 'EN_PREPARACION' ? <ChefHat size={10} className="inline mr-1" /> : null}
        {item.estado === 'LISTO' ? <CheckCircle size={10} className="inline mr-1" /> : null}
        {item.estado.replace('_', ' ')}
      </span>

      {/* Detalle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800 truncate">{item.producto_nombre}</span>
          <span className="text-sm font-semibold text-gray-700 shrink-0 ml-2">${Number(item.subtotal).toFixed(2)}</span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">x{item.cantidad} · ${Number(item.precio_unitario).toFixed(2)} c/u</div>
        {Number(item.descuento) > 0 && (
          <div className="text-xs text-red-500 mt-0.5">Descuento: -${Number(item.descuento).toFixed(2)}</div>
        )}
        {item.notas && (
          <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
            <MessageSquare size={10} /> {item.notas}
          </div>
        )}
      </div>

      {/* Acciones */}
      {!pedidoCerrado && !isCancelado && (
        <div className="flex items-center gap-1 shrink-0">
          {item.estado === 'PENDIENTE' && (
            <button
              onClick={() => handleEstado('EN_PREPARACION')}
              disabled={loading}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
            >
              Preparar
            </button>
          )}
          {item.estado === 'EN_PREPARACION' && (
            <button
              onClick={() => handleEstado('LISTO')}
              disabled={loading}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
            >
              Listo
            </button>
          )}
          {item.estado === 'LISTO' && (
            <button
              onClick={() => handleEstado('ENTREGADO')}
              disabled={loading}
              className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
            >
              Entregar
            </button>
          )}
          <button
            onClick={onEliminar}
            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// Página principal

export default function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalAgregarItem, setModalAgregarItem] = useState(false);
  const [modalCobrar, setModalCobrar] = useState(false);

  const loadPedido = useCallback(async () => {
    if (!id) return;
    const data = await pedidosService.getPedido(Number(id));
    setPedido(data);
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [pData, prdData, cajData, cliData] = await Promise.all([
          pedidosService.getPedido(Number(id)),
          productosService.getAll({ activo: true }),
          cajasService.getAll(),
          clientesService.getActivos(),
        ]);
        setPedido(pData);
        setProductos(prdData);
        setCajas(cajData);
        setClientes(cliData);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  const pedidoCerrado = pedido?.estado === 'PAGADO' || pedido?.estado === 'CANCELADO';

  const handleAgregarItem = async (item: { producto: number; cantidad: number; precio_unitario: number; descuento?: number; notas?: string }) => {
    if (!pedido) return;
    await pedidosService.agregarItem(pedido.id, item);
    setModalAgregarItem(false);
    await loadPedido();
  };

  const handleCambiarEstadoItem = async (itemId: number, estado: DetallePedido['estado']) => {
    await pedidosService.cambiarEstadoItem(itemId, estado);
    await loadPedido();
  };

  const handleEliminarItem = async (itemId: number) => {
    if (!pedido) return;
    await pedidosService.eliminarItem(pedido.id, itemId);
    await loadPedido();
  };

  const handleCambiarEstadoPedido = async (estado: Pedido['estado']) => {
    if (!pedido) return;
    const updated = await pedidosService.cambiarEstadoPedido(pedido.id, estado);
    setPedido(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Pedido no encontrado.</p>
        <button onClick={() => navigate('/pedidos')} className="mt-3 text-indigo-600 hover:underline text-sm">
          ← Volver a mesas
        </button>
      </div>
    );
  }

  const detallesActivos = pedido.detalles.filter(d => d.estado !== 'CANCELADO');
  const descuentoDisplay = pedido.detalles
    .filter(d => d.estado !== 'CANCELADO')
    .reduce((sum, d) => sum + Number(d.descuento || 0), 0)
    .toFixed(2);
  const subtotalDisplay = Number(pedido.subtotal).toFixed(2);
  const ivaDisplay = Number(pedido.iva).toFixed(2);
  const totalDisplay = Number(pedido.total).toFixed(2);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate('/pedidos')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-800">{pedido.numero_pedido}</h1>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${ESTADO_PEDIDO_COLOR[pedido.estado]}`}>
              {pedido.estado.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : pedido.tipo.replace('_', ' ')}
            {pedido.zona_nombre ? ` · ${pedido.zona_nombre}` : ''}
            {pedido.usuario_nombre ? ` · ${pedido.usuario_nombre}` : ''}
          </p>
        </div>
        <button
          onClick={loadPedido}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <RefreshCw size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Lista de ítems */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <ShoppingBag size={16} className="text-indigo-600" />
                Ítems del pedido
                <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {detallesActivos.length}
                </span>
              </h2>
              {!pedidoCerrado && (
                <button
                  onClick={() => setModalAgregarItem(true)}
                  className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus size={14} /> Agregar
                </button>
              )}
            </div>

            <div className="px-5 divide-y divide-gray-50">
              {pedido.detalles.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <ShoppingBag size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin ítems aún</p>
                </div>
              ) : (
                pedido.detalles.map(item => (
                  <DetalleItem
                    key={item.id}
                    item={item}
                    pedidoCerrado={pedidoCerrado}
                    onCambiarEstado={estado => handleCambiarEstadoItem(item.id, estado)}
                    onEliminar={() => handleEliminarItem(item.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Cambiar estado del pedido */}
          {!pedidoCerrado && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Estado del pedido</h3>
              <div className="flex gap-2 flex-wrap">
                {(['ABIERTO', 'EN_PREPARACION', 'LISTO', 'CANCELADO'] as Pedido['estado'][]).map(estado => (
                  <button
                    key={estado}
                    onClick={() => handleCambiarEstadoPedido(estado)}
                    disabled={pedido.estado === estado}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      pedido.estado === estado
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {estado.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral: totales + cobro */}
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Resumen</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${subtotalDisplay}</span>
              </div>
              {Number(descuentoDisplay) > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Descuento</span>
                  <span>-${descuentoDisplay}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>IVA</span>
                <span>${ivaDisplay}</span>
              </div>
              <div className="flex justify-between text-gray-800 font-bold text-base border-t border-gray-100 pt-2 mt-2">
                <span>Total</span>
                <span>${totalDisplay}</span>
              </div>
            </div>
          </div>

          {/* Personas */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users size={15} className="text-indigo-500" />
              <span>{pedido.personas} {pedido.personas === 1 ? 'persona' : 'personas'}</span>
            </div>
            {pedido.observaciones && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                {pedido.observaciones}
              </div>
            )}
          </div>

          {/* Cobrar */}
          {!pedidoCerrado && detallesActivos.length > 0 && (
            <button
              onClick={() => setModalCobrar(true)}
              className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <DollarSign size={16} /> Cobrar ${totalDisplay}
            </button>
          )}

          {pedido.estado === 'PAGADO' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle size={24} className="mx-auto text-green-600 mb-1" />
              <p className="text-sm font-semibold text-green-700">Pedido pagado</p>
              {pedido.venta && (
                <p className="text-xs text-green-600 mt-1">Venta #{pedido.venta}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {modalAgregarItem && (
        <AgregarItemModal
          productos={productos}
          onClose={() => setModalAgregarItem(false)}
          onAdd={handleAgregarItem}
        />
      )}
      {modalCobrar && cajas.length > 0 && clientes.length > 0 && (
        <CobrarModal
          pedido={pedido}
          cajas={cajas}
          clientes={clientes}
          onClose={() => setModalCobrar(false)}
          onCobrado={() => {
            setModalCobrar(false);
            navigate('/pedidos');
          }}
        />
      )}
    </div>
  );
}
