import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CalendarClock,
  Database,
  FileSignature,
  Files,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserRound,
} from 'lucide-react';
import {
  firmadorService,
  type FirmadorAdminWorkspace,
  type FirmadorAdminWorkspaceUpdate,
} from '../../services/firmadorService';
import { useToast } from '../../hooks/useToast';

const MB = 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const bytesToMb = (bytes: number) => Math.round((bytes / MB) * 10) / 10;
const mbToBytes = (mb: number) => Math.max(0, Math.round(mb * MB));

const dateText = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const pct = (used: number, total: number) => {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
};

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
      active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {active ? <BadgeCheck size={13} /> : <ToggleLeft size={13} />}
      {label}
    </span>
  );
}

function LimitInput({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <div className="mt-1 flex rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 rounded-l-lg border-0 px-3 py-2 text-sm text-slate-900 outline-none"
        />
        <span className="flex items-center rounded-r-lg border-l border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function WorkspaceRow({
  workspace,
  selected,
  onSelect,
}: {
  workspace: FirmadorAdminWorkspace;
  selected: boolean;
  onSelect: () => void;
}) {
  const usage = pct(workspace.used_storage_bytes, workspace.max_storage_bytes);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-950">{workspace.nombre || 'Sin nombre'}</h3>
            <StatusPill active={workspace.activo && workspace.owner_active} label={workspace.activo && workspace.owner_active ? 'Activo' : 'Inactivo'} />
            {workspace.owner_email_verificado && <StatusPill active label="Email verificado" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1"><Mail size={14} />{workspace.owner_email || workspace.email}</span>
            <span>{workspace.identificacion || 'Sin identificación'}</span>
            <span>{workspace.tipo}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm lg:w-80">
          <div>
            <p className="font-semibold text-slate-900">{workspace.documentos_count}</p>
            <p className="text-xs text-slate-500">Docs</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{workspace.certificados_count}</p>
            <p className="text-xs text-slate-500">Certs</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{usage.toFixed(0)}%</p>
            <p className="text-xs text-slate-500">Espacio</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function FirmadorAdminPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    activo: true,
    owner_active: true,
    max_file_size_mb: 25,
    max_storage_mb: 1024,
    monthly_signature_limit: 100,
    default_retention_days: 30,
    max_retention_days: 180,
  });

  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    estado: estado || undefined,
    tipo: tipo || undefined,
  }), [search, estado, tipo]);

  const metricasQuery = useQuery({
    queryKey: ['firmador-admin-metricas'],
    queryFn: firmadorService.getAdminMetricas,
  });

  const workspacesQuery = useQuery({
    queryKey: ['firmador-admin-workspaces', filters],
    queryFn: () => firmadorService.getAdminWorkspaces(filters),
  });

  const workspaces = workspacesQuery.data ?? [];

  useEffect(() => {
    if (!selectedId && workspaces.length > 0) {
      setSelectedId(workspaces[0].id);
    }
  }, [selectedId, workspaces]);

  const detailQuery = useQuery({
    queryKey: ['firmador-admin-workspace', selectedId],
    queryFn: () => firmadorService.getAdminWorkspace(selectedId as number),
    enabled: Boolean(selectedId),
  });

  const selected = detailQuery.data ?? workspaces.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setForm({
      activo: selected.activo,
      owner_active: selected.owner_active,
      max_file_size_mb: bytesToMb(selected.max_file_size_bytes),
      max_storage_mb: bytesToMb(selected.max_storage_bytes),
      monthly_signature_limit: selected.monthly_signature_limit,
      default_retention_days: selected.default_retention_days,
      max_retention_days: selected.max_retention_days,
    });
  }, [selected]);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FirmadorAdminWorkspaceUpdate }) =>
      firmadorService.updateAdminWorkspace(id, payload),
    onSuccess: async (_, variables) => {
      showToast('Usuario firmador actualizado', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['firmador-admin-metricas'] }),
        queryClient.invalidateQueries({ queryKey: ['firmador-admin-workspaces'] }),
        queryClient.invalidateQueries({ queryKey: ['firmador-admin-workspace', variables.id] }),
      ]);
    },
    onError: () => showToast('No se pudo actualizar el usuario firmador', 'error'),
  });

  const handleSave = () => {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      payload: {
        activo: form.activo,
        owner_active: form.owner_active,
        max_file_size_bytes: mbToBytes(form.max_file_size_mb),
        max_storage_bytes: mbToBytes(form.max_storage_mb),
        monthly_signature_limit: form.monthly_signature_limit,
        default_retention_days: form.default_retention_days,
        max_retention_days: form.max_retention_days,
      },
    });
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['firmador-admin-metricas'] });
    queryClient.invalidateQueries({ queryKey: ['firmador-admin-workspaces'] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ['firmador-admin-workspace', selectedId] });
  };

  const metricas = metricasQuery.data;
  const storagePercent = selected ? pct(selected.used_storage_bytes, selected.max_storage_bytes) : 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700">Administración</p>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Usuarios del Firmador</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Consulta usuarios registrados, certificados activos, documentos firmados y límites de almacenamiento del firmador PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={UserRound} label="Cuentas" value={metricas?.workspaces ?? '-'} />
        <MetricCard icon={ShieldCheck} label="Activas" value={metricas?.workspaces_activos ?? '-'} />
        <MetricCard icon={Files} label="Documentos" value={metricas?.documentos ?? '-'} />
        <MetricCard icon={FileSignature} label="Con QR" value={metricas?.documentos_qr ?? '-'} />
        <MetricCard icon={KeyRound} label="Certificados" value={metricas?.certificados ?? '-'} />
        <MetricCard icon={Database} label="R2 usado" value={metricas ? formatBytes(metricas.storage_bytes) : '-'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, email o identificación"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Todos los tipos</option>
              <option value="PERSONA_NATURAL">Persona natural</option>
              <option value="EMPRESA_EXTERNA">Empresa externa</option>
              <option value="EMPRESA_ERP">Empresa ERP</option>
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {workspacesQuery.isLoading ? (
              <div className="flex h-48 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 animate-spin" size={20} />
                Cargando usuarios...
              </div>
            ) : workspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No hay usuarios firmador con los filtros actuales.
              </div>
            ) : (
              workspaces.map((workspace) => (
                <WorkspaceRow
                  key={workspace.id}
                  workspace={workspace}
                  selected={workspace.id === selectedId}
                  onSelect={() => setSelectedId(workspace.id)}
                />
              ))
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
          {!selected ? (
            <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
              Selecciona un usuario para administrarlo.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-slate-950">{selected.nombre || 'Sin nombre'}</h2>
                    <p className="mt-1 truncate text-sm text-slate-500">{selected.owner_email || selected.email}</p>
                  </div>
                  {detailQuery.isFetching && <Loader2 className="animate-spin text-blue-700" size={18} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill active={selected.activo} label={selected.activo ? 'Workspace activo' : 'Workspace inactivo'} />
                  <StatusPill active={selected.owner_active} label={selected.owner_active ? 'Usuario activo' : 'Usuario inactivo'} />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Almacenamiento</span>
                  <span className="text-slate-500">{storagePercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-700" style={{ width: `${storagePercent}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatBytes(selected.used_storage_bytes)} de {formatBytes(selected.max_storage_bytes)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, activo: !prev.activo }))}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${
                    form.activo ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  Workspace
                  {form.activo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, owner_active: !prev.owner_active }))}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${
                    form.owner_active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  Login del usuario
                  {form.owner_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LimitInput label="Archivo máximo" value={form.max_file_size_mb} suffix="MB" onChange={(value) => setForm((prev) => ({ ...prev, max_file_size_mb: value }))} />
                <LimitInput label="Espacio total" value={form.max_storage_mb} suffix="MB" onChange={(value) => setForm((prev) => ({ ...prev, max_storage_mb: value }))} />
                <LimitInput label="Firmas mensuales" value={form.monthly_signature_limit} suffix="docs" onChange={(value) => setForm((prev) => ({ ...prev, monthly_signature_limit: value }))} />
                <LimitInput label="Retención base" value={form.default_retention_days} suffix="días" onChange={(value) => setForm((prev) => ({ ...prev, default_retention_days: value }))} />
                <LimitInput label="Retención máxima" value={form.max_retention_days} suffix="días" onChange={(value) => setForm((prev) => ({ ...prev, max_retention_days: value }))} />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateMutation.isPending && <Loader2 className="animate-spin" size={16} />}
                Guardar cambios
              </button>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
                  <ShieldCheck size={16} />
                  Consentimiento legal
                </h3>
                {selected.consentimiento_legal ? (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                    <p><span className="font-bold text-slate-900">Terminos:</span> {selected.consentimiento_legal.terms_version}</p>
                    <p className="mt-1"><span className="font-bold text-slate-900">Privacidad:</span> {selected.consentimiento_legal.privacy_version}</p>
                    <p className="mt-1"><span className="font-bold text-slate-900">Aceptado:</span> {new Date(selected.consentimiento_legal.accepted_at).toLocaleString('es-EC')}</p>
                    <p className="mt-1"><span className="font-bold text-slate-900">IP:</span> {selected.consentimiento_legal.ip_address || '-'}</p>
                    <p className="mt-1"><span className="font-bold text-slate-900">Origen:</span> {selected.consentimiento_legal.source}</p>
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    No hay evidencia legal registrada para esta cuenta.
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
                  <KeyRound size={16} />
                  Certificados activos
                </h3>
                <div className="mt-3 space-y-2">
                  {(selected.certificados_activos ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">No tiene certificados activos.</p>
                  ) : (
                    selected.certificados_activos?.map((cert) => (
                      <div key={cert.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{cert.alias || cert.original_file_name}</p>
                        <p className="mt-1 text-xs text-slate-500">Vence: {dateText(cert.expires_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
                  <CalendarClock size={16} />
                  Documentos recientes
                </h3>
                <div className="mt-3 space-y-2">
                  {(selected.documentos_recientes ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">No hay documentos recientes.</p>
                  ) : (
                    selected.documentos_recientes?.map((doc) => (
                      <div key={doc.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{doc.signed_file_name || doc.original_file_name}</p>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {doc.signature_type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{dateText(doc.created_at)} · {formatBytes(doc.stored_bytes || doc.signed_size || doc.original_size)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
