import apiClient from './apiClient';

export interface FirmadorWorkspace {
  id: number;
  tipo: string;
  nombre: string;
  identificacion: string;
  email: string;
  activo: boolean;
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
  reason: string;
  location: string;
  visible_signature: boolean;
  error_message: string;
  created_at: string;
  updated_at: string;
  download_url?: string;
}

export interface FirmarPdfPayload {
  pdf: File;
  certificate: File;
  certificatePassword: string;
  keepFile: boolean;
  visibleSignature: boolean;
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

  firmarPdf: async (payload: FirmarPdfPayload): Promise<FirmarPdfResponse> => {
    const formData = new FormData();
    formData.append('pdf', payload.pdf);
    formData.append('certificate', payload.certificate);
    formData.append('certificate_password', payload.certificatePassword);
    formData.append('keep_file', String(payload.keepFile));
    formData.append('visible_signature', String(payload.visibleSignature));
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
