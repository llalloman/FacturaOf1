import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, Loader2, RefreshCw, Save, Upload } from 'lucide-react';
import { firmasService, type EstadoSolicitudFirma, type SolicitudFirma, type SolicitudFirmaFilters } from '../../services/firmasService';
import { useToast } from '../../hooks/useToast';

const estados: Array<{ value: EstadoSolicitudFirma; label: string; color: string }> = [
  { value: 'NUEVA', label: 'Nueva', color: 'bg-blue-50 text-blue-700' },
  { value: 'CONTACTADO', label: 'Contactado', color: 'bg-sky-50 text-sky-700' },
  { value: 'DOCUMENTOS_PENDIENTES', label: 'Documentos pendientes', color: 'bg-amber-50 text-amber-700' },
  { value: 'EN_REVISION', label: 'En revisión', color: 'bg-purple-50 text-purple-700' },
  { value: 'ENVIADA_PROVEEDOR', label: 'Enviada a proveedor', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'EMITIDA', label: 'Emitida', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'RECHAZADA', label: 'Rechazada', color: 'bg-red-50 text-red-700' },
  { value: 'ANULADA', label: 'Anulada', color: 'bg-slate-100 text-slate-600' },
];

const documentTypes = [
  ['CEDULA_ANVERSO', 'Anverso de cédula'],
  ['CEDULA_REVERSO', 'Reverso de cédula'],
  ['SELFIE_CEDULA', 'Selfie con cédula'],
  ['RUC_PDF', 'RUC PDF'],
  ['NOMBRAMIENTO_REPRESENTANTE', 'Nombramiento representante legal'],
  ['CARTA_AUTORIZACION', 'Carta de autorización'],
  ['CEDULA_REPRESENTANTE', 'Cédula representante legal'],
  ['VIDEO_AUTORIZACION', 'Video de autorización'],
];

const badgeFor = (status?: string) => estados.find((e) => e.value === status)?.color ?? 'bg-slate-100 text-slate-600';

export default function SolicitudesFirmaPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [filters, setFilters] = useState<SolicitudFirmaFilters>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [uploadType, setUploadType] = useState('CEDULA_ANVERSO');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes-firma', filters],
    queryFn: () => firmasService.list(filters),
  });

  const selected = useMemo(
    () => solicitudes.find((item) => item.id === selectedId) ?? solicitudes[0],
    [selectedId, solicitudes],
  );

  const setFilter = (field: keyof SolicitudFirmaFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value || undefined }));
  };

  const updateSelected = async (payload: Partial<SolicitudFirma>) => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await firmasService.update(selected.id, payload);
      showToast('Solicitud actualizada', 'success');
      queryClient.invalidateQueries({ queryKey: ['solicitudes-firma'] });
    } catch {
      showToast('No se pudo actualizar la solicitud', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: EstadoSolicitudFirma) => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await firmasService.changeStatus(selected.id, { status, comment: statusComment });
      setStatusComment('');
      showToast('Estado actualizado', 'success');
      queryClient.invalidateQueries({ queryKey: ['solicitudes-firma'] });
    } catch {
      showToast('No se pudo cambiar el estado', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (file?: File) => {
    if (!selected?.id || !file) return;
    setUploading(true);
    try {
      await firmasService.uploadDocument(selected.id, uploadType, file);
      showToast('Documento cargado', 'success');
      queryClient.invalidateQueries({ queryKey: ['solicitudes-firma'] });
    } catch {
      showToast('No se pudo cargar el documento', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
            <FileSignature size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Solicitudes de Firma Electrónica</h1>
            <p className="text-sm text-slate-500">Gestiona solicitudes, documentos, proveedor, costos e historial.</p>
          </div>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['solicitudes-firma'] })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-white">
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Buscar" value={filters.search ?? ''} onChange={(e) => setFilter('search', e.target.value)} />
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Estado</option>
          {estados.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.request_type ?? ''} onChange={(e) => setFilter('request_type', e.target.value)}>
          <option value="">Tipo</option>
          <option value="PERSONA_NATURAL">Persona Natural</option>
          <option value="REPRESENTANTE_LEGAL">Representante Legal</option>
          <option value="MIEMBRO_EMPRESA">Miembro de Empresa</option>
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.source ?? ''} onChange={(e) => setFilter('source', e.target.value)}>
          <option value="">Origen</option>
          <option value="LANDING">Landing</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="REFERIDO_CONTADOR">Referido contador</option>
          <option value="CLIENTE_ERP">Cliente ERP</option>
          <option value="REDES_SOCIALES">Redes sociales</option>
          <option value="MANUAL_ADMINISTRATIVO">Manual administrativo</option>
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.interested_plan ?? ''} onChange={(e) => setFilter('interested_plan', e.target.value)}>
          <option value="">Plan</option>
          <option value="BASICO">Básico</option>
          <option value="PROFESIONAL">Profesional</option>
          <option value="EMPRESARIAL">Empresarial</option>
          <option value="SOLO_FIRMA">Solo firma</option>
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.provider ?? ''} onChange={(e) => setFilter('provider', e.target.value)}>
          <option value="">Proveedor</option>
          <option value="UANATACA">Uanataca</option>
          <option value="NEXUS">Nexus</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            {solicitudes.length} solicitud(es)
          </div>
          <div className="max-h-[680px] divide-y divide-slate-100 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : solicitudes.map((item) => (
              <button key={item.id} onClick={() => setSelectedId(item.id ?? null)} className={`block w-full px-4 py-3 text-left hover:bg-blue-50 ${selected?.id === item.id ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{item.full_name || `${item.first_name} ${item.last_name}`}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeFor(item.status)}`}>{item.status_display ?? item.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.identification} · {item.email}</p>
                <p className="mt-1 text-xs text-slate-400">{item.request_type_display ?? item.request_type} · {item.interested_plan_display ?? item.interested_plan}</p>
              </button>
            ))}
            {!isLoading && solicitudes.length === 0 && <div className="p-6 text-sm text-slate-400">No hay solicitudes con estos filtros.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {!selected ? (
            <div className="py-20 text-center text-sm text-slate-400">Selecciona una solicitud.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">{selected.full_name || `${selected.first_name} ${selected.last_name}`}</h2>
                  <p className="text-sm text-slate-500">{selected.email} · {selected.phone}</p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${badgeFor(selected.status)}`}>{selected.status_display ?? selected.status}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Tipo" value={selected.request_type_display ?? selected.request_type} />
                <Info label="Cédula" value={selected.identification} />
                <Info label="Código dactilar" value={selected.fingerprint_code} />
                <Info label="RUC" value={selected.ruc || '-'} />
                <Info label="Razón social" value={selected.business_name || '-'} />
                <Info label="Ubicación" value={`${selected.city}, ${selected.province}`} />
                <Info label="Vigencia" value={selected.validity_display ?? selected.validity} />
                <Info label="Origen" value={selected.source_display ?? selected.source ?? '-'} />
              </div>

              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-4">
                <label className="text-xs font-medium text-slate-500">
                  Proveedor
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" defaultValue={selected.provider ?? ''} onChange={(e) => updateSelected({ provider: e.target.value })}>
                    <option value="">Sin definir</option>
                    <option value="UANATACA">Uanataca</option>
                    <option value="NEXUS">Nexus</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </label>
                <MoneyInput label="Costo interno" value={selected.internal_cost} onBlur={(value) => updateSelected({ internal_cost: value })} />
                <MoneyInput label="Precio venta" value={selected.sale_price} onBlur={(value) => updateSelected({ sale_price: value })} />
                <Info label="Margen" value={`$${Number(selected.margin ?? 0).toFixed(2)}`} />
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Cambiar estado</h3>
                <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto]">
                  <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={selected.status} onChange={(e) => changeStatus(e.target.value as EstadoSolicitudFirma)} disabled={saving}>
                    {estados.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
                  </select>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Comentario del cambio" value={statusComment} onChange={(e) => setStatusComment(e.target.value)} />
                  <button onClick={() => updateSelected({ internal_notes: selected.internal_notes ?? '' })} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Guardar
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Documentos</h3>
                <div className="mb-3 grid gap-2 md:grid-cols-[1fr_1fr]">
                  <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                    {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-100 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Subir documento
                    <input type="file" className="hidden" onChange={(e) => uploadDocument(e.target.files?.[0])} />
                  </label>
                </div>
                <div className="space-y-2">
                  {(selected.documents ?? []).map((doc) => (
                    <a key={doc.id} href={doc.download_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                      <span>{doc.document_type_display}</span>
                      <span className="text-slate-400">{doc.file_name}</span>
                    </a>
                  ))}
                  {(selected.documents ?? []).length === 0 && <p className="text-sm text-slate-400">Sin documentos cargados.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Historial</h3>
                <div className="space-y-2">
                  {(selected.status_history ?? []).map((item) => (
                    <div key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-medium text-slate-700">{item.previous_status || 'Inicio'} → {item.new_status}</p>
                      <p className="text-xs text-slate-500">{item.comment || 'Sin comentario'} · {item.changed_by_name || 'Sistema'} · {item.created_at}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value || '-'}</p>
    </div>
  );
}

function MoneyInput({ label, value, onBlur }: { label: string; value?: string; onBlur: (value: string) => void }) {
  const [local, setLocal] = useState(value ?? '0.00');
  return (
    <label className="text-xs font-medium text-slate-500">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onBlur(local)}
      />
    </label>
  );
}
