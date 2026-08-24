import apiClient from './apiClient';

export interface FirmadorWorkspace {
  id: number;
  tipo: string;
  nombre: string;
  identificacion: string;
  email: string;
  activo: boolean;
  is_primary: boolean;
  max_file_size_bytes: number;
  max_storage_bytes: number;
  monthly_signature_limit: number;
  default_retention_days: number;
  max_retention_days: number;
  used_storage_bytes: number;
  monthly_signatures_used: number;
}

export interface FirmadorDocumento {
  id: number;
  original_file_name: string;
  signed_file_name: string;
  original_size: number;
  signed_size: number;
  stored_bytes: number;
  keep_file: boolean;
  retention_days: number;
  expires_at: string | null;
  status: string;
  status_display: string;
  signature_type: string;
  signature_page: number;
  signature_x: number;
  signature_y: number;
  signature_width: number;
  signature_height: number;
  reason: string;
  location: string;
  visible_signature: boolean;
  error_message: string;
  created_at: string;
  updated_at: string;
  download_url?: string;
  validation_url?: string | null;
}

export interface FirmadorValidacionPublica {
  registered: boolean;
  token_valid: boolean;
  id?: number;
  file_name?: string;
  status?: string;
  status_display?: string;
  signature_type?: string;
  signature_type_display?: string;
  signed_hash?: string;
  original_hash?: string;
  signed_at?: string;
  expires_at?: string | null;
  is_expired?: boolean;
  is_deleted?: boolean;
  file_available?: boolean;
  download_url?: string | null;
  certificado_origen?: string;
  reason?: string;
  location?: string;
  detail?: string;
}

export interface FirmadorFirmaValidada {
  field_name: string;
  signer: string;
  valid: boolean;
  trusted: boolean;
  intact: boolean;
  summary: string;
  error: string;
}

export interface FirmadorPdfValidado {
  file_name: string;
  file_size: number;
  sha256: string;
  has_signatures: boolean;
  signature_count: number;
  signatures: FirmadorFirmaValidada[];
  validation_available: boolean;
  of1_registered: boolean;
  of1_document: FirmadorValidacionPublica | null;
  download_url?: string;
  error: string;
}

export interface FirmadorAdminWorkspace {
  id: number;
  tipo: string;
  nombre: string;
  identificacion: string;
  email: string;
  activo: boolean;
  is_primary: boolean;
  owner_email: string;
  owner_name: string;
  owner_active: boolean;
  owner_email_verificado: boolean;
  max_file_size_bytes: number;
  max_storage_bytes: number;
  monthly_signature_limit: number;
  default_retention_days: number;
  max_retention_days: number;
  used_storage_bytes: number;
  monthly_signatures_used: number;
  documentos_count: number;
  certificados_count: number;
  owner_workspaces_count: number;
  has_workspace_conflict: boolean;
  created_at: string;
  updated_at: string;
  documentos_recientes?: FirmadorDocumento[];
  certificados_activos?: FirmadorCertificado[];
  consentimiento_legal?: FirmadorConsentimientoLegal | null;
}

export interface FirmadorConsentimientoLegal {
  id: number;
  accepted_terms: boolean;
  accepted_privacy: boolean;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string;
  terms_version: string;
  privacy_version: string;
  source: string;
  created_at: string;
}

export interface FirmadorAdminMetricas {
  workspaces: number;
  workspaces_activos: number;
  documentos: number;
  documentos_qr: number;
  certificados: number;
  storage_bytes: number;
}

export interface FirmadorAdminWorkspaceUpdate {
  activo?: boolean;
  owner_active?: boolean;
  max_file_size_bytes?: number;
  max_storage_bytes?: number;
  monthly_signature_limit?: number;
  default_retention_days?: number;
  max_retention_days?: number;
}

export interface FirmadorCertificado {
  id: number;
  alias: string;
  original_file_name: string;
  file_size: number;
  fingerprint: string;
  subject: string;
  issuer: string;
  expires_at: string;
  active: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubirCertificadoPayload {
  certificate: File;
  certificatePassword: string;
  alias?: string;
}

export interface FirmarPdfPayload {
  pdf: File;
  certificate?: File | null;
  certificateId?: number | null;
  certificatePassword: string;
  keepFile: boolean;
  visibleSignature: boolean;
  signatureType?: string;
  signaturePage?: number;
  signatureX?: number;
  signatureY?: number;
  signatureWidth?: number;
  signatureHeight?: number;
  reason?: string;
  location?: string;
  retentionDays?: number;
}

export interface FirmarPdfResponse {
  blob: Blob;
  fileName: string;
  documentId?: string;
  keepFile: boolean;
}

const fileNameFromDisposition = (header?: string): string | null => {
  if (!header) return null;
  const match = header.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
};

export const firmadorService = {
  getPerfil: async (): Promise<FirmadorWorkspace> => {
    const { data } = await apiClient.get('/firmador/perfil/');
    return data;
  },

  getDocumentos: async (): Promise<FirmadorDocumento[]> => {
    const { data } = await apiClient.get('/firmador/documentos/');
    return Array.isArray(data) ? data : data.results ?? [];
  },

  getCertificados: async (): Promise<FirmadorCertificado[]> => {
    const { data } = await apiClient.get('/firmador/certificados/');
    return Array.isArray(data) ? data : data.results ?? [];
  },

  getAdminMetricas: async (): Promise<FirmadorAdminMetricas> => {
    const { data } = await apiClient.get('/firmador/admin/workspaces/metricas/');
    return data;
  },

  getAdminWorkspaces: async (params?: { search?: string; estado?: string; tipo?: string }): Promise<FirmadorAdminWorkspace[]> => {
    const { data } = await apiClient.get('/firmador/admin/workspaces/', { params });
    return Array.isArray(data) ? data : data.results ?? [];
  },

  getAdminWorkspace: async (id: number): Promise<FirmadorAdminWorkspace> => {
    const { data } = await apiClient.get(`/firmador/admin/workspaces/${id}/`);
    return data;
  },

  updateAdminWorkspace: async (id: number, payload: FirmadorAdminWorkspaceUpdate): Promise<FirmadorAdminWorkspace> => {
    const { data } = await apiClient.patch(`/firmador/admin/workspaces/${id}/`, payload);
    return data;
  },

  marcarAdminWorkspacePrincipal: async (id: number): Promise<FirmadorAdminWorkspace> => {
    const { data } = await apiClient.post(`/firmador/admin/workspaces/${id}/marcar-principal/`);
    return data;
  },

  subirCertificado: async (payload: SubirCertificadoPayload): Promise<FirmadorCertificado> => {
    const formData = new FormData();
    formData.append('certificate', payload.certificate);
    formData.append('certificate_password', payload.certificatePassword);
    if (payload.alias) formData.append('alias', payload.alias);

    const { data } = await apiClient.post('/firmador/certificados/', formData);
    return data;
  },

  eliminarCertificado: async (id: number): Promise<void> => {
    await apiClient.delete(`/firmador/certificados/${id}/`);
  },

  eliminarDocumento: async (id: number): Promise<void> => {
    await apiClient.delete(`/firmador/documentos/${id}/`);
  },

  descargarDocumento: async (id: number): Promise<{ blob: Blob; fileName: string }> => {
    const response = await apiClient.get(`/firmador/documentos/${id}/descargar/`, {
      responseType: 'blob',
    });
    return {
      blob: response.data,
      fileName: fileNameFromDisposition(response.headers['content-disposition']) ?? 'documento-firmado.pdf',
    };
  },

  validarDocumentoPublico: async (id: string, token: string): Promise<FirmadorValidacionPublica> => {
    const { data } = await apiClient.get(`/firmador/validar/${id}/`, { params: { token } });
    return data;
  },

  validarPdfs: async (files: File[]): Promise<FirmadorPdfValidado[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('documents', file));
    const { data } = await apiClient.post('/firmador/validar/', formData);
    return data.results ?? [];
  },

  firmarPdf: async (payload: FirmarPdfPayload): Promise<FirmarPdfResponse> => {
    const formData = new FormData();
    formData.append('pdf', payload.pdf);
    if (payload.certificateId) {
      formData.append('certificate_id', String(payload.certificateId));
    } else if (payload.certificate) {
      formData.append('certificate', payload.certificate);
    }
    formData.append('certificate_password', payload.certificatePassword);
    formData.append('keep_file', String(payload.keepFile));
    formData.append('visible_signature', String(payload.visibleSignature));
    if (payload.signatureType) formData.append('signature_type', payload.signatureType);
    if (payload.signaturePage) formData.append('signature_page', String(payload.signaturePage));
    if (payload.signatureX !== undefined) formData.append('signature_x', String(payload.signatureX));
    if (payload.signatureY !== undefined) formData.append('signature_y', String(payload.signatureY));
    if (payload.signatureWidth !== undefined) formData.append('signature_width', String(payload.signatureWidth));
    if (payload.signatureHeight !== undefined) formData.append('signature_height', String(payload.signatureHeight));
    if (payload.reason) formData.append('reason', payload.reason);
    if (payload.location) formData.append('location', payload.location);
    if (payload.retentionDays) formData.append('retention_days', String(payload.retentionDays));

    const response = await apiClient.post('/firmador/firmar/', formData, {
      responseType: 'blob',
    });

    return {
      blob: response.data,
      fileName: fileNameFromDisposition(response.headers['content-disposition']) ?? 'documento-firmado.pdf',
      documentId: response.headers['x-firmador-document-id'],
      keepFile: response.headers['x-firmador-keep-file'] === 'true',
    };
  },
};
