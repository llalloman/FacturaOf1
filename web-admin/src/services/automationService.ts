import apiClient from './apiClient';

export type AutomationLeadStatus =
  | 'new'
  | 'bot_responded'
  | 'requires_human'
  | 'in_follow_up'
  | 'contacted'
  | 'qualified'
  | 'proposal_sent'
  | 'converted'
  | 'lost'
  | 'closed';
export type AutomationLeadPriority = 'low' | 'medium' | 'high';

export interface WhatsAppInteractionAdmin {
  id: number;
  direction: 'INBOUND' | 'OUTBOUND';
  direction_display?: string;
  phone?: string;
  normalized_phone?: string;
  contact_key?: string;
  reply_to_jid?: string;
  from_jid?: string;
  remote_jid?: string;
  push_name?: string;
  is_lid: boolean;
  channel: string;
  message_body?: string;
  message_type: string;
  message_type_display?: string;
  message_id?: string;
  category?: string;
  intent?: string;
  ai_confidence?: string | null;
  ai_summary?: string;
  requires_human: boolean;
  template_key?: string;
  gateway_status?: string;
  created_at: string;
}

export interface AutomationLead {
  id: number;
  phone?: string;
  normalized_phone?: string;
  contact_key?: string;
  reply_to_jid?: string;
  from_jid?: string;
  remote_jid?: string;
  push_name?: string;
  is_lid: boolean;
  source_channel: string;
  name?: string;
  company?: string;
  email?: string;
  interest_type: string;
  interest_type_display?: string;
  status: AutomationLeadStatus;
  status_display?: string;
  priority: AutomationLeadPriority;
  priority_display?: string;
  summary?: string;
  internal_notes?: string;
  last_category?: string;
  last_intent?: string;
  last_ai_confidence?: string | null;
  last_interaction_at?: string | null;
  assigned_to?: number | null;
  assigned_to_name?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  interactions_count: number;
  recent_interactions: WhatsAppInteractionAdmin[];
  privacy_notice_sent_at?: string | null;
  privacy_notice_version?: string;
  privacy_consent_source?: string;
  privacy_consent_status?: string;
}

export interface AutomationLeadFilters {
  search?: string;
  status?: string;
  priority?: string;
  interest_type?: string;
  category?: string;
  source_channel?: string;
  is_lid?: string;
  requires_human?: string;
  date_from?: string;
  date_to?: string;
  ordering?: string;
  page?: number;
}

export interface AutomationLeadStats {
  total: number;
  new: number;
  requires_advisor: number;
  in_follow_up: number;
  converted: number;
  without_follow_up: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const unwrapList = <T>(data: PaginatedResponse<T> | T[]) => Array.isArray(data) ? data : data.results;

export const automationService = {
  listLeads: async (params: AutomationLeadFilters = {}) => {
    const { data } = await apiClient.get<PaginatedResponse<AutomationLead> | AutomationLead[]>('/automation/admin/leads/', { params });
    return data;
  },
  listLeadsArray: async (params: AutomationLeadFilters = {}) => {
    const data = await automationService.listLeads(params);
    return unwrapList(data);
  },
  getLeadStats: async (params: AutomationLeadFilters = {}) => {
    const { data } = await apiClient.get<AutomationLeadStats>('/automation/admin/leads/stats/', { params });
    return data;
  },
  updateLead: async (id: number, payload: Partial<Pick<AutomationLead, 'status' | 'priority' | 'summary' | 'internal_notes' | 'assigned_to'>>) => {
    const { data } = await apiClient.patch<AutomationLead>(`/automation/admin/leads/${id}/`, payload);
    return data;
  },
};
