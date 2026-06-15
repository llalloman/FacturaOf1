import apiClient from './apiClient';

export type TipoSolicitudFirma = 'PERSONA_NATURAL' | 'REPRESENTANTE_LEGAL' | 'MIEMBRO_EMPRESA';
export type EstadoSolicitudFirma = 'NUEVA' | 'CONTACTADO' | 'DOCUMENTOS_PENDIENTES' | 'EN_REVISION' | 'ENVIADA_PROVEEDOR' | 'EMITIDA' | 'RECHAZADA' | 'ANULADA';
export type PlanInteresFirma = 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL' | 'SOLO_FIRMA';

export interface SolicitudFirma {
  id?: number;
  request_number?: string;
  company?: number | null;
  customer?: number | null;
  request_type: TipoSolicitudFirma;
  request_type_display?: string;
  identification_type?: string;
  identification_type_display?: string;
  first_name: string;
  last_name: string;
  second_last_name?: string;
  full_name?: string;
  identification: string;
  fingerprint_code: string;
  birth_date?: string;
  nationality?: string;
  gender?: string;
  ruc?: string;
  has_ruc?: boolean;
  business_name?: string;
  company_unit?: string;
  applicant_position?: string;
  request_reason?: string;
  email: string;
  secondary_email?: string;
  phone: string;
  secondary_phone?: string;
  province: string;
  city: string;
  address: string;
  representative_identification_type?: string;
  representative_identification?: string;
  representative_names?: string;
  representative_last_names?: string;
  validity: string;
  validity_display?: string;
  container_type?: string;
  wants_erp: boolean;
  interested_plan: PlanInteresFirma;
  interested_plan_display?: string;
  status?: EstadoSolicitudFirma;
  status_display?: string;
  source?: string;
  source_display?: string;
  provider?: string;
  provider_display?: string;
  internal_cost?: string;
  sale_price?: string;
  margin?: string;
  internal_notes?: string;
  provider_request_id?: string;
  emitted_at?: string | null;
  rejected_reason?: string;
  created_at?: string;
  updated_at?: string;
  documents?: DocumentoSolicitudFirma[];
  status_history?: HistorialSolicitudFirma[];
}

export interface DocumentoSolicitudFirma {
  id: number;
  request: number;
  document_type: string;
  document_type_display: string;
  file_name: string;
  mime_type: string;
  status: string;
  status_display: string;
  uploaded_at: string;
  download_url?: string;
  file_available?: boolean;
}

export interface HistorialSolicitudFirma {
  id: number;
  previous_status: string;
  new_status: string;
  comment: string;
  changed_by_name: string;
  created_at: string;
}

export interface SolicitudFirmaFilters {
  status?: string;
  request_type?: string;
  source?: string;
  interested_plan?: string;
  provider?: string;
  search?: string;
}

export type DocumentoPublicoFirma =
  | 'cedula_anverso'
  | 'cedula_reverso'
  | 'selfie_cedula'
  | 'ruc_pdf'
  | 'constitucion_compania'
  | 'nombramiento_representante'
  | 'aceptacion_nombramiento'
  | 'carta_autorizacion'
  | 'cedula_representante'
  | 'documento_adicional';

export type SolicitudFirmaPublicPayload = Partial<SolicitudFirma> & {
  archivos?: Partial<Record<DocumentoPublicoFirma, File | null>>;
};

const publicDocumentTypeMap: Record<DocumentoPublicoFirma, string> = {
  cedula_anverso: 'CEDULA_ANVERSO',
  cedula_reverso: 'CEDULA_REVERSO',
  selfie_cedula: 'SELFIE_CEDULA',
  ruc_pdf: 'RUC_PDF',
  constitucion_compania: 'CONSTITUCION_COMPANIA',
  nombramiento_representante: 'NOMBRAMIENTO_REPRESENTANTE',
  aceptacion_nombramiento: 'ACEPTACION_NOMBRAMIENTO',
  carta_autorizacion: 'CARTA_AUTORIZACION',
  cedula_representante: 'CEDULA_REPRESENTANTE',
  documento_adicional: 'DOCUMENTO_ADICIONAL',
};

export type PlanInteresDemo = 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL' | 'NO_SEGURO';

export interface SolicitudDemoERP {
  id?: number;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city?: string;
  business_type?: string;
  interested_plan: PlanInteresDemo;
  needs_signature: boolean;
  already_has_signature: boolean;
  message?: string;
}

const normalizeList = <T>(data: T[] | { results?: T[] }): T[] => Array.isArray(data) ? data : (data.results ?? []);

export const firmasService = {
  list: async (filters: SolicitudFirmaFilters = {}): Promise<SolicitudFirma[]> => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const { data } = await apiClient.get('/firmas/solicitudes/', { params });
    return normalizeList<SolicitudFirma>(data);
  },

  get: async (id: number): Promise<SolicitudFirma> => {
    const { data } = await apiClient.get(`/firmas/solicitudes/${id}/`);
    return data;
  },

  create: async (payload: Partial<SolicitudFirma>): Promise<SolicitudFirma> => {
    const { data } = await apiClient.post('/firmas/solicitudes/', payload);
    return data;
  },

  createPublic: async (payload: SolicitudFirmaPublicPayload): Promise<{ id: number; request_number: string; mensaje: string }> => {
    const { archivos: _archivos, ...fields } = payload;
    const { data } = await apiClient.post('/firmas/solicitudes-publicas/', fields);
    return data;
  },

  uploadPublicDocument: async (id: number, requestNumber: string, documentKey: DocumentoPublicoFirma, file: File): Promise<DocumentoSolicitudFirma> => {
    const formData = new FormData();
    formData.append('request_number', requestNumber);
    formData.append('document_type', publicDocumentTypeMap[documentKey]);
    formData.append('file', file);
    const { data } = await apiClient.post(`/firmas/solicitudes-publicas/${id}/documentos/`, formData);
    return data;
  },

  finalizePublic: async (id: number, requestNumber: string): Promise<{ id: number; request_number: string; mensaje: string }> => {
    const { data } = await apiClient.post(`/firmas/solicitudes-publicas/${id}/finalizar/`, {
      request_number: requestNumber,
    });
    return data;
  },

  createDemoPublic: async (payload: SolicitudDemoERP): Promise<{ id: number; mensaje: string }> => {
    const { data } = await apiClient.post('/firmas/demos-publicas/', payload);
    return data;
  },

  update: async (id: number, payload: Partial<SolicitudFirma>): Promise<SolicitudFirma> => {
    const { data } = await apiClient.patch(`/firmas/solicitudes/${id}/`, payload);
    return data;
  },

  changeStatus: async (id: number, payload: { status: EstadoSolicitudFirma; comment?: string; rejected_reason?: string; provider_request_id?: string }): Promise<SolicitudFirma> => {
    const { data } = await apiClient.post(`/firmas/solicitudes/${id}/cambiar_estado/`, payload);
    return data;
  },

  uploadDocument: async (id: number, documentType: string, file: File): Promise<DocumentoSolicitudFirma> => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    const { data } = await apiClient.post(`/firmas/solicitudes/${id}/documentos/`, formData);
    return data;
  },

  downloadDocument: async (id: number): Promise<Blob> => {
    const { data } = await apiClient.get(`/firmas/documentos/${id}/descargar/`, {
      responseType: 'blob',
    });
    return data;
  },
};
