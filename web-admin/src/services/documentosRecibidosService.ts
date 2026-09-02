import apiClient from './apiClient';

export interface DocumentoRecibidoDetalle {
  id: number;
  codigo_principal: string;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  descuento: string;
  base_imponible: string;
  iva: string;
  ice: string;
  total: string;
}

export interface DocumentoRecibidoSRI {
  id: number;
  tipo_comprobante: string;
  tipo_comprobante_display: string;
  clave_acceso: string;
  numero_autorizacion: string;
  numero_comprobante: string;
  ruc_emisor: string;
  razon_social_emisor: string;
  ruc_receptor: string;
  razon_social_receptor: string;
  fecha_emision: string | null;
  fecha_autorizacion: string | null;
  estado_sri: string;
  estado_sri_display: string;
  estado_interno: string;
  estado_interno_display: string;
  subtotal_0: string;
  subtotal_iva: string;
  subtotal_no_objeto: string;
  subtotal_exento: string;
  iva: string;
  ice: string;
  total: string;
  nombre_archivo: string;
  observaciones: string;
  errores: string[];
  metadata: Record<string, unknown>;
  fecha_creacion: string;
  fecha_modificacion: string;
  detalles: DocumentoRecibidoDetalle[];
}

export interface ImportarDocumentosResult {
  creados: number;
  duplicados: number;
  errores: number;
  documentos: Array<{
    resultado: 'creados' | 'duplicados' | 'errores';
    id?: number;
    nombre_archivo: string;
    clave_acceso?: string;
    numero_comprobante?: string;
    estado_interno?: string;
    error?: string;
  }>;
}

type DocumentoQueryParams = Record<string, string | number | boolean | undefined | null>;

const fetchAllPages = async (params?: DocumentoQueryParams) => {
  const all: DocumentoRecibidoSRI[] = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get('/documentos-recibidos/', {
      params: { ...params, page },
    });
    const data = response.data as DocumentoRecibidoSRI[] | { results?: DocumentoRecibidoSRI[]; next?: string | null };

    if (Array.isArray(data)) {
      return data;
    }

    all.push(...(data.results ?? []));
    if (!data.next) break;
    page += 1;
  }

  return all;
};

export const documentosRecibidosService = {
  getAll: (params?: DocumentoQueryParams) => fetchAllPages(params),

  importar: async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('archivos', file));
    const response = await apiClient.post<ImportarDocumentosResult>(
      '/documentos-recibidos/importar/',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
