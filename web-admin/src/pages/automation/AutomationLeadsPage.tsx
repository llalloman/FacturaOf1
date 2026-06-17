import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  UserRound,
} from 'lucide-react';
import {
  automationService,
  type AutomationLead,
  type AutomationLeadFilters,
  type AutomationLeadPriority,
  type AutomationLeadStatus,
} from '../../services/automationService';
import { usuariosService } from '../../services/usuariosService';
import { useToast } from '../../hooks/useToast';
import type { Usuario } from '../../types';

type LeadUpdatePayload = Partial<Pick<AutomationLead, 'status' | 'priority' | 'internal_notes' | 'assigned_to'>>;

const statuses: Array<{ value: AutomationLeadStatus; label: string; color: string }> = [
  { value: 'new', label: 'Nuevo', color: 'bg-blue-50 text-blue-700' },
  { value: 'bot_responded', label: 'Respondido por bot', color: 'bg-cyan-50 text-cyan-700' },
  { value: 'requires_human', label: 'Requiere humano', color: 'bg-amber-50 text-amber-700' },
  { value: 'in_follow_up', label: 'En seguimiento', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'contacted', label: 'Contactado', color: 'bg-sky-50 text-sky-700' },
  { value: 'qualified', label: 'Calificado', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'proposal_sent', label: 'Propuesta enviada', color: 'bg-violet-50 text-violet-700' },
  { value: 'converted', label: 'Convertido', color: 'bg-green-50 text-green-700' },
  { value: 'lost', label: 'Perdido', color: 'bg-red-50 text-red-700' },
  { value: 'closed', label: 'Cerrado', color: 'bg-slate-100 text-slate-600' },
];

const priorities: Array<{ value: AutomationLeadPriority; label: string; color: string }> = [
  { value: 'low', label: 'Baja', color: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Media', color: 'bg-blue-50 text-blue-700' },
  { value: 'high', label: 'Alta', color: 'bg-red-50 text-red-700' },
];

const categories = [
  ['signature', 'Firma electrónica'],
  ['erp', 'ERP FacturaOF1'],
  ['invoicing', 'Facturación electrónica'],
  ['custom_software', 'Desarrollo a medida'],
  ['automation_ai', 'Automatización e IA'],
  ['chatbot', 'Chatbots'],
  ['integration', 'Integraciones'],
  ['support', 'Soporte'],
  ['payment', 'Pago'],
  ['documents', 'Documentos'],
  ['human', 'Atención humana'],
  ['unknown', 'No definido'],
];

const channels = [
  ['whatsapp', 'WhatsApp'],
  ['web', 'Formulario web'],
  ['landing', 'Landing'],
  ['n8n', 'n8n'],
];

const statusBadge = (status?: string) => statuses.find((item) => item.value === status)?.color ?? 'bg-slate-100 text-slate-600';
const priorityBadge = (priority?: string) => priorities.find((item) => item.value === priority)?.color ?? 'bg-slate-100 text-slate-600';

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const realPhone = (lead: AutomationLead) => {
  const raw = lead.normalized_phone || lead.phone || '';
  return raw.includes('@') ? '' : raw.replace(/\D/g, '');
};

const phoneLabel = (lead: AutomationLead) => realPhone(lead) || 'Teléfono no disponible';
const technicalIdentifier = (lead: AutomationLead) => lead.contact_key || lead.reply_to_jid || lead.from_jid || lead.remote_jid || 'Sin identificador técnico';

const whatsappLink = (lead: AutomationLead) => {
  const digits = realPhone(lead);
  if (!digits) return '';
  const text = encodeURIComponent('Hola, te contacto de OF1 Solutions por tu solicitud de información.');
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${text}&type=phone_number&app_absent=0`;
};

const userLabel = (user: Usuario) =>
  user.nombre_completo || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email;

export default function AutomationLeadsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [filters, setFilters] = useState<AutomationLeadFilters>({ ordering: '-last_interaction_at' });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['automation-leads', filters],
    queryFn: () => automationService.listLeads(filters),
  });

  const { data: stats } = useQuery({
    queryKey: ['automation-leads-stats', filters],
    queryFn: () => automationService.getLeadStats(filters),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
  });

  const leads = useMemo(() => Array.isArray(data) ? data : data?.results ?? [], [data]);
  const total = Array.isArray(data) ? data.length : data?.count ?? leads.length;
  const selected = useMemo(
    () => leads.find((lead) => lead.id === selectedId) ?? leads[0],
    [leads, selectedId],
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: LeadUpdatePayload }) =>
      automationService.updateLead(id, payload),
    onSuccess: (lead) => {
      setNotesDraft(lead.internal_notes ?? '');
      showToast('Lead actualizado', 'success');
      queryClient.invalidateQueries({ queryKey: ['automation-leads'] });
      queryClient.invalidateQueries({ queryKey: ['automation-leads-stats'] });
    },
    onError: () => showToast('No se pudo actualizar el lead', 'error'),
  });

  const setFilter = (field: keyof AutomationLeadFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value || undefined, page: undefined }));
  };

  const selectLead = (lead: AutomationLead) => {
    setSelectedId(lead.id);
    setNotesDraft(lead.internal_notes ?? '');
  };

  const updateSelected = (payload: LeadUpdatePayload) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, payload });
  };

  useEffect(() => {
    setNotesDraft(selected?.internal_notes ?? '');
  }, [selected?.id, selected?.internal_notes]);

  const selectedWhatsapp = selected ? whatsappLink(selected) : '';

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
            <Bot size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Administración de Leads</h1>
            <p className="text-sm text-slate-500">Leads generados por WhatsApp, formularios y automatizaciones.</p>
          </div>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['automation-leads'] });
            queryClient.invalidateQueries({ queryKey: ['automation-leads-stats'] });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-white"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Nuevos" value={stats?.new ?? 0} />
        <MetricCard label="Requieren asesor" value={stats?.requires_advisor ?? 0} accent="amber" />
        <MetricCard label="En seguimiento" value={stats?.in_follow_up ?? 0} accent="indigo" />
        <MetricCard label="Convertidos" value={stats?.converted ?? 0} accent="green" />
        <MetricCard label="Sin seguimiento" value={stats?.without_follow_up ?? 0} accent="red" />
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-8">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar teléfono, identificador, nombre o mensaje"
            value={filters.search ?? ''}
            onChange={(event) => setFilter('search', event.target.value)}
          />
        </div>
        <FilterSelect label="Estado" value={filters.status ?? ''} onChange={(value) => setFilter('status', value)} options={statuses.map((item) => [item.value, item.label])} />
        <FilterSelect label="Categoría" value={filters.category ?? ''} onChange={(value) => setFilter('category', value)} options={categories} />
        <FilterSelect label="Prioridad" value={filters.priority ?? ''} onChange={(value) => setFilter('priority', value)} options={priorities.map((item) => [item.value, item.label])} />
        <FilterSelect label="Canal" value={filters.source_channel ?? ''} onChange={(value) => setFilter('source_channel', value)} options={channels} />
        <FilterSelect label="Requiere humano" value={filters.requires_human ?? ''} onChange={(value) => setFilter('requires_human', value)} options={[['true', 'Sí'], ['false', 'No']]} />
        <FilterSelect label="Tipo WhatsApp" value={filters.is_lid ?? ''} onChange={(value) => setFilter('is_lid', value)} options={[['true', 'LID'], ['false', 'Teléfono real']]} />
        <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={filters.date_from ?? ''} onChange={(event) => setFilter('date_from', event.target.value)} />
        <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={filters.date_to ?? ''} onChange={(event) => setFilter('date_to', event.target.value)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
            <span className="font-semibold text-slate-700">{total} lead(s)</span>
            {isFetching && <Loader2 size={16} className="animate-spin text-blue-600" />}
          </div>
          <div className="max-h-[760px] divide-y divide-slate-100 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-44 items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
              </div>
            ) : leads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => selectLead(lead)}
                className={`block w-full px-4 py-3 text-left hover:bg-blue-50 ${selected?.id === lead.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{lead.push_name || lead.name || phoneLabel(lead)}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-blue-600">{phoneLabel(lead)}</p>
                    {!realPhone(lead) && <p className="mt-0.5 truncate text-xs text-slate-400">{technicalIdentifier(lead)}</p>}
                  </div>
                  <StatusBadge value={lead.status_display ?? lead.status} color={statusBadge(lead.status)} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">{lead.summary || lead.recent_interactions?.[0]?.message_body || 'Sin resumen registrado.'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <StatusBadge value={lead.priority_display ?? lead.priority} color={priorityBadge(lead.priority)} />
                  <span>{lead.last_category || lead.interest_type_display || lead.interest_type}</span>
                  <span>{lead.source_channel}</span>
                  <span>{formatDate(lead.last_interaction_at ?? lead.created_at)}</span>
                </div>
              </button>
            ))}
            {!isLoading && leads.length === 0 && (
              <div className="p-6 text-sm text-slate-400">No hay leads con estos filtros.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {!selected ? (
            <div className="py-20 text-center text-sm text-slate-400">Selecciona un lead.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <UserRound size={18} className="text-slate-400" />
                    <h2 className="truncate text-xl font-bold text-slate-950">{selected.push_name || selected.name || 'Contacto'}</h2>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-blue-600">{phoneLabel(selected)}</p>
                  <p className="break-all text-xs text-slate-400">{technicalIdentifier(selected)}</p>
                  <p className="mt-1 text-sm text-slate-500">{selected.email || 'Sin correo'} - {selected.company || 'Sin empresa'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedWhatsapp ? (
                    <a
                      href={selectedWhatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      <MessageCircle size={15} />
                      WhatsApp
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700">
                      <AlertTriangle size={15} />
                      Usar reply_to_jid en automation
                    </span>
                  )}
                  <StatusBadge value={selected.status_display ?? selected.status} color={statusBadge(selected.status)} />
                  <StatusBadge value={selected.priority_display ?? selected.priority} color={priorityBadge(selected.priority)} />
                </div>
              </div>

              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-4">
                <label className="text-xs font-medium text-slate-500">
                  Estado
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" value={selected.status} onChange={(event) => updateSelected({ status: event.target.value as AutomationLeadStatus })} disabled={updateMutation.isPending}>
                    {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500">
                  Prioridad
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" value={selected.priority} onChange={(event) => updateSelected({ priority: event.target.value as AutomationLeadPriority })} disabled={updateMutation.isPending}>
                    {priorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500">
                  Responsable
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" value={selected.assigned_to ?? ''} onChange={(event) => updateSelected({ assigned_to: event.target.value ? Number(event.target.value) : null })} disabled={updateMutation.isPending}>
                    <option value="">Sin asignar</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{userLabel(user)}</option>)}
                  </select>
                </label>
                <Info label="Interacciones" value={String(selected.interactions_count ?? selected.recent_interactions?.length ?? 0)} />
              </div>

              <Section title="Resumen IA">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info label="Categoría" value={selected.last_category || selected.interest_type_display || selected.interest_type} />
                  <Info label="Intención" value={selected.last_intent || '-'} />
                  <Info label="Confianza IA" value={selected.last_ai_confidence ? `${Number(selected.last_ai_confidence) * 100}%` : '-'} />
                  <Info label="Última interacción" value={formatDate(selected.last_interaction_at)} />
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{selected.summary || 'Sin resumen IA registrado.'}</p>
              </Section>

              <Section title="Notas internas">
                <div className="space-y-3">
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    placeholder="Notas internas para seguimiento comercial"
                  />
                  <button onClick={() => updateSelected({ internal_notes: notesDraft })} disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                    {updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Guardar notas
                  </button>
                </div>
              </Section>

              <Section title="Campos técnicos">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Phone" value={realPhone(selected) || 'Teléfono no disponible'} />
                  <Info label="Contact key" value={selected.contact_key || '-'} />
                  <Info label="Reply to JID" value={selected.reply_to_jid || '-'} />
                  <Info label="From JID" value={selected.from_jid || '-'} />
                  <Info label="Remote JID" value={selected.remote_jid || '-'} />
                  <Info label="Es LID" value={selected.is_lid ? 'Sí' : 'No'} />
                </div>
              </Section>

              <Section title="Historial de interacciones">
                <div className="space-y-2">
                  {(selected.recent_interactions ?? []).map((interaction) => (
                    <div key={interaction.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {interaction.direction === 'INBOUND' ? <MessageCircle size={15} className="text-blue-600" /> : <CheckCircle2 size={15} className="text-emerald-600" />}
                          <span className="font-semibold text-slate-700">{interaction.direction_display ?? interaction.direction}</span>
                          {interaction.requires_human && <StatusBadge value="Requiere humano" color="bg-amber-50 text-amber-700" />}
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={13} />
                          {formatDate(interaction.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-slate-600">{interaction.message_body || interaction.ai_summary || 'Sin contenido.'}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {interaction.category || 'sin categoría'} - {interaction.intent || 'sin intención'} - {interaction.message_type_display ?? interaction.message_type}
                      </p>
                    </div>
                  ))}
                  {(selected.recent_interactions ?? []).length === 0 && (
                    <p className="text-sm text-slate-400">Sin interacciones registradas.</p>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent = 'blue' }: { label: string; value: number; accent?: 'blue' | 'amber' | 'indigo' | 'green' | 'red' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-2xl font-bold ${colors[accent]}`}>{value}</p>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function StatusBadge({ value, color }: { value: string; color: string }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{value}</span>;
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-700">{value || '-'}</p>
    </div>
  );
}
