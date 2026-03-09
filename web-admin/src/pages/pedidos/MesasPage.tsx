import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, RefreshCw, Settings, Users,
  ShoppingCart, Coffee, Utensils, LayoutGrid,
} from 'lucide-react';
import { pedidosService, type Mesa, type Zona, type Pedido } from '../../services/pedidosService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_COLOR: Record<Mesa['estado'], string> = {
  LIBRE:     'bg-green-100 border-green-400 text-green-700',
  OCUPADA:   'bg-red-100   border-red-400   text-red-700',
  RESERVADA: 'bg-yellow-100 border-yellow-400 text-yellow-700',
};

const ESTADO_LABEL: Record<Mesa['estado'], string> = {
  LIBRE:     'Libre',
  OCUPADA:   'Ocupada',
  RESERVADA: 'Reservada',
};

const TIPO_ICON: Record<Pedido['tipo'], string> = {
  MESA:        '🪑',
  MOSTRADOR:   '🍺',
  PARA_LLEVAR: '🛍️',
  DELIVERY:    '🚀',
};

// ── Modal: Nueva mesa ─────────────────────────────────────────────────────────

interface MesaModalProps {
  zonas: Zona[];
  onClose: () => void;
  onSaved: () => void;
  mesa?: Mesa | null;
}

function MesaModal({ zonas, onClose, onSaved, mesa }: MesaModalProps) {
  const [form, setForm] = useState({
    numero: mesa?.numero ?? '',
    nombre: mesa?.nombre ?? '',
    capacidad: mesa?.capacidad ?? 4,
    zona: mesa?.zona ?? ('' as number | ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero.trim()) { setError('El número es obligatorio.'); return; }
    setSaving(true);
    try {
      const payload = {
        numero: form.numero.trim(),
        nombre: form.nombre.trim(),
        capacidad: Number(form.capacidad),
        zona: form.zona !== '' ? Number(form.zona) : null,
      };
      if (mesa) {
        await pedidosService.updateMesa(mesa.id, payload);
      } else {
        await pedidosService.createMesa(payload);
      }
      onSaved();
    } catch {
      setError('Error al guardar. Verifica que el número no esté duplicado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {mesa ? 'Editar mesa' : 'Nueva mesa'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número / Código *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.numero}
                onChange={e => setForm(p => ({ ...p, numero: e.target.value }))}
                placeholder="1, A1, BAR-2…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre descriptivo</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ventana, VIP…"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad (personas)</label>
              <input
                type="number" min={1} max={50}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.capacidad}
                onChange={e => setForm(p => ({ ...p, capacidad: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.zona}
                onChange={e => setForm(p => ({ ...p, zona: e.target.value === '' ? '' : Number(e.target.value) }))}
              >
                <option value="">Sin zona</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Nuevo pedido (sin mesa / mostrador / delivery) ─────────────────────

interface NuevoPedidoModalProps {
  onClose: () => void;
  onCreated: (pedido: Pedido) => void;
  mesa?: Mesa | null;
}

function NuevoPedidoModal({ onClose, onCreated, mesa }: NuevoPedidoModalProps) {
  const [form, setForm] = useState({
    tipo: mesa ? 'MESA' : 'MOSTRADOR' as Pedido['tipo'],
    personas: 1,
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<Pedido> = {
        tipo: form.tipo,
        personas: form.personas,
        observaciones: form.observaciones,
      };
      if (mesa) payload.mesa = mesa.id;
      const pedido = await pedidosService.createPedido(payload);
      onCreated(pedido);
    } catch {
      setError('Error al crear el pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {mesa ? `Nuevo pedido — Mesa ${mesa.numero}` : 'Nuevo pedido'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {!mesa && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value as Pedido['tipo'] }))}
              >
                <option value="MOSTRADOR">Mostrador / Barra</option>
                <option value="PARA_LLEVAR">Para llevar</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° de personas</label>
            <input
              type="number" min={1} max={100}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.personas}
              onChange={e => setForm(p => ({ ...p, personas: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.observaciones}
              onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
              placeholder="Notas del pedido…"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tarjeta de mesa ───────────────────────────────────────────────────────────

interface MesaCardProps {
  mesa: Mesa;
  pedidoActivo?: Pedido | null;
  onNuevoPedido: (mesa: Mesa) => void;
  onVerPedido: (pedidoId: number) => void;
  onEditar: (mesa: Mesa) => void;
}

function MesaCard({ mesa, pedidoActivo, onNuevoPedido, onVerPedido, onEditar }: MesaCardProps) {
  const colorClass = ESTADO_COLOR[mesa.estado];

  const handleClick = () => {
    if (pedidoActivo) {
      onVerPedido(pedidoActivo.id);
    } else if (mesa.estado === 'LIBRE') {
      onNuevoPedido(mesa);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative border-2 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:scale-105 select-none ${colorClass}`}
    >
      {/* Editar */}
      <button
        onClick={e => { e.stopPropagation(); onEditar(mesa); }}
        className="absolute top-2 right-2 p-1 rounded-md opacity-50 hover:opacity-100 hover:bg-white/50 transition"
      >
        <Settings size={13} />
      </button>

      {/* Número */}
      <div className="text-2xl font-bold text-center mb-1">
        {mesa.nombre || mesa.numero}
      </div>
      {mesa.nombre && (
        <div className="text-xs text-center opacity-70 mb-1">#{mesa.numero}</div>
      )}

      {/* Capacidad */}
      <div className="flex items-center justify-center gap-1 text-xs opacity-60 mb-2">
        <Users size={11} />
        <span>{mesa.capacidad}</span>
      </div>

      {/* Estado / info pedido */}
      <div className="text-center">
        {pedidoActivo ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold">{pedidoActivo.numero_pedido}</div>
            <div className="text-sm font-bold">${Number(pedidoActivo.total).toFixed(2)}</div>
            <div className="text-xs opacity-70">{pedidoActivo.items_count ?? pedidoActivo.detalles?.length ?? 0} ítems</div>
          </div>
        ) : (
          <div className="text-xs font-medium">{ESTADO_LABEL[mesa.estado]}</div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function MesasPage() {
  const navigate = useNavigate();

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [pedidosActivos, setPedidosActivos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const [zonaFiltro, setZonaFiltro] = useState<number | 'all'>('all');
  const [estadoFiltro, setEstadoFiltro] = useState<Mesa['estado'] | 'all'>('all');

  const [modalMesa, setModalMesa] = useState<{ open: boolean; mesa?: Mesa | null }>({ open: false });
  const [modalPedido, setModalPedido] = useState<{ open: boolean; mesa?: Mesa | null }>({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mesasData, zonasData, pedidosData] = await Promise.all([
        pedidosService.getMesas({ activa: 1 }),
        pedidosService.getZonas(),
        pedidosService.getPedidos({ activos: '1' }),
      ]);
      setMesas(mesasData);
      setZonas(zonasData);
      setPedidosActivos(pedidosData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mapa mesa_id → pedido activo
  const pedidoByMesa = pedidosActivos.reduce<Record<number, Pedido>>((acc, p) => {
    if (p.mesa) acc[p.mesa] = p;
    return acc;
  }, {});

  const pedidosSinMesa = pedidosActivos.filter(p => !p.mesa);

  const mesasFiltradas = mesas.filter(m => {
    if (zonaFiltro !== 'all' && m.zona !== zonaFiltro) return false;
    if (estadoFiltro !== 'all' && m.estado !== estadoFiltro) return false;
    return true;
  });

  const stats = {
    libres: mesas.filter(m => m.estado === 'LIBRE').length,
    ocupadas: mesas.filter(m => m.estado === 'OCUPADA').length,
    reservadas: mesas.filter(m => m.estado === 'RESERVADA').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutGrid className="text-indigo-600" size={26} />
            Mesas &amp; Pedidos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestión de pedidos en tiempo real para tu local
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={() => setModalMesa({ open: true })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
          >
            <Settings size={14} /> Nueva mesa
          </button>
          <button
            onClick={() => setModalPedido({ open: true, mesa: null })}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={14} /> Pedido sin mesa
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Libres', value: stats.libres, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Ocupadas', value: stats.ocupadas, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Reservadas', value: stats.reservadas, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl px-5 py-4 text-center`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={zonaFiltro}
          onChange={e => setZonaFiltro(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">Todas las zonas</option>
          {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value as Mesa['estado'] | 'all')}
        >
          <option value="all">Todos los estados</option>
          <option value="LIBRE">Libres</option>
          <option value="OCUPADA">Ocupadas</option>
          <option value="RESERVADA">Reservadas</option>
        </select>
      </div>

      {/* Grid de mesas */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : mesasFiltradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Utensils size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hay mesas configuradas</p>
          <p className="text-sm mt-1">Crea tu primera mesa con el botón "Nueva mesa"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {mesasFiltradas.map(mesa => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              pedidoActivo={pedidoByMesa[mesa.id] ?? null}
              onNuevoPedido={m => setModalPedido({ open: true, mesa: m })}
              onVerPedido={id => navigate(`/pedidos/${id}`)}
              onEditar={m => setModalMesa({ open: true, mesa: m })}
            />
          ))}
        </div>
      )}

      {/* Pedidos sin mesa */}
      {pedidosSinMesa.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Coffee size={16} /> Pedidos sin mesa ({pedidosSinMesa.length})
          </h2>
          <div className="flex gap-3 flex-wrap">
            {pedidosSinMesa.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/pedidos/${p.id}`)}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition hover:border-indigo-400"
              >
                <span className="text-xl">{TIPO_ICON[p.tipo]}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-800">{p.numero_pedido}</div>
                  <div className="text-xs text-gray-500">{p.tipo.replace('_', ' ')} · ${Number(p.total).toFixed(2)}</div>
                </div>
                <ShoppingCart size={14} className="text-indigo-500 ml-1" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      {modalMesa.open && (
        <MesaModal
          zonas={zonas}
          mesa={modalMesa.mesa}
          onClose={() => setModalMesa({ open: false })}
          onSaved={() => { setModalMesa({ open: false }); load(); }}
        />
      )}
      {modalPedido.open && (
        <NuevoPedidoModal
          mesa={modalPedido.mesa ?? undefined}
          onClose={() => setModalPedido({ open: false })}
          onCreated={pedido => {
            setModalPedido({ open: false });
            navigate(`/pedidos/${pedido.id}`);
          }}
        />
      )}
    </div>
  );
}
