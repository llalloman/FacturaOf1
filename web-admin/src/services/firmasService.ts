import apiClient from './apiClient';

export type TipoSolicitudFirma = 'PERSONA_NATURAL' | 'REPRESENTANTE_LEGAL' | 'MIEMBRO_EMPRESA';
export type VigenciaFirma = '7_DIAS' | '15_DIAS' | '1_MES' | '1_ANIO' | '2_ANIOS' | '3_ANIOS' | '4_ANIOS' | '5_ANIOS';
export type EstadoSolicitudFirma = 'NUEVA' | 'CONTACTADO' | 'DOCUMENTOS_PENDIENTES' | 'EN_REVISION' | 'ENVIADA_PROVEEDOR' | 'EMITIDA' | 'RECHAZADA' | 'ANULADA';
export type PlanInteresFirma = 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL' | 'SOLO_FIRMA';


export interface PromocionFirma {
  id?: number;
  price: number;
  name: string;
  group_key?: string;
  discount_type: 'FINAL_PRICE' | 'PERCENTAGE';
  discount_value: string;
  promotional_price: string;
  start_date: string;
  end_date: string;
  active: boolean;
  is_current?: boolean;
}

export interface PrecioFirma {
  id: number;
  validity: VigenciaFirma;
  validity_display: string;
  regular_price: string;
  current_price: string;
  tax_rate?: string;
  producto_erp?: number | null;
  active: boolean;
  order: number;
  active_promotion?: PromocionFirma | null;
}

export interface PromocionFirmaBulkPayload {
  prices: number[];
  name: string;
  discount_type: 'FINAL_PRICE' | 'PERCENTAGE';
  discount_value: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface CuponFirma {
  id?: number;
  code: string;
  name: string;
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discount_value: string;
  prices: number[];
  start_date: string;
  end_date: string;
  minimum_amount: string;
  max_total_uses: number | null;
  max_uses_per_customer: number;
  active: boolean;
  is_current?: boolean;
  usage_count?: number;
}

export interface CuponFirmaQuote {
  valid: boolean;
  code: string;
  applied: boolean;
  message: string;
  regular_price: string;
  final_price: string;
  discount_amount: string;
  subtotal_without_tax: string;
  tax_rate: string;
  tax_amount: string;
  applied_source: 'coupon' | 'promotion' | 'regular';
}


export interface FirmaPagoElectronicoResumen {
  id: number;
  provider: 'PAYPHONE' | 'TRANSFERENCIA';
  provider_display?: string;
  status: string;
  status_display?: string;
  amount: string;
  base_amount: string;
  processing_fee: string;
  processing_fee_tax: string;
  currency: string;
  client_transaction_id: string;
  provider_transaction_id?: string;
  authorization_code?: string;
  paid_at?: string | null;
  created_at?: string;
  pago_online_id?: number | null;
  venta_id?: number | null;
  venta_numero?: string;
  movimiento_bancario_id?: number | null;
  application_error?: string;
}

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
  validity: VigenciaFirma;
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
  legal_consent?: ConsentimientoFirma | null;
  payments?: FirmaPagoElectronicoResumen[];
}

export interface ConsentimientoFirma {
  id: number;
  request: number;
  request_number: string;
  accepted_terms: boolean;
  accepted_privacy: boolean;
  accepted_at: string;
  ip_address?: string | null;
  user_agent: string;
  terms_version: string;
  privacy_version: string;
  created_at: string;
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
  coupon_code?: string;
  accepted_terms?: boolean;
  accepted_privacy?: boolean;
  terms_version?: string;
  privacy_version?: string;
  archivos?: Partial<Record<DocumentoPublicoFirma, File | null>>;
};


export interface PayPhoneBoxConfig {
  token: string;
  clientTransactionId: string;
  amount: number;
  amountWithTax?: number;
  amountWithoutTax?: number;
  tax?: number;
  service?: number;
  tip?: number;
  currency: string;
  storeId: string;
  reference?: string;
  lang?: string;
  defaultMethod?: 'card' | 'payphone';
  timeZone?: number;
  optionalParameter?: string;
  phoneNumber?: string;
  email?: string;
  documentId?: string;
  identificationType?: number;
  responseUrl?: string;
  cancellationUrl?: string;
}

export interface PayPhoneFirmaPaymentResponse {
  id: number;
  provider: 'PAYPHONE';
  status: string;
  amount: string;
  base_amount: string;
  processing_fee: string;
  processing_fee_tax: string;
  currency: string;
  client_transaction_id: string;
  payment_url?: string;
  box_config?: PayPhoneBoxConfig;
}

export interface PublicSignatureLookupResponse {
  solicitud: SolicitudFirma & {
    request_type_display?: string;
    validity_display?: string;
    status_display?: string;
    full_name?: string;
    documents?: Array<{ document_type: string; document_type_display: string; file_name?: string; created_at?: string }>;
  };
  payment: {
    status: string;
    status_display?: string;
    provider?: string;
    provider_display?: string;
    payment_method?: string;
    payment_method_display?: string;
    amount: string;
    base_amount: string;
    processing_fee: string;
    processing_fee_tax: string;
    currency: string;
    client_transaction_id: string;
    provider_transaction_id?: string;
    authorization_code?: string;
    paid_at?: string;
  } | null;
}

export interface PublicFinalizeResponse {
  id: number;
  request_number: string;
  mensaje: string;
  email_status?: {
    admin_sent: boolean;
    client_sent: boolean;
    admin_error?: string;
    client_error?: string;
  };
}

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
  listPreciosFirmaPublicos: async (): Promise<PrecioFirma[]> => {
    const { data } = await apiClient.get('/firmas/precios-publicos/');
    return normalizeList<PrecioFirma>(data);
  },

  listPreciosFirma: async (): Promise<PrecioFirma[]> => {
    const { data } = await apiClient.get('/firmas/precios/');
    return normalizeList<PrecioFirma>(data);
  },

  updatePrecioFirma: async (id: number, payload: Partial<PrecioFirma>): Promise<PrecioFirma> => {
    const { data } = await apiClient.patch(`/firmas/precios/${id}/`, payload);
    return data;
  },

  listPromocionesFirma: async (): Promise<PromocionFirma[]> => {
    const { data } = await apiClient.get('/firmas/promociones/');
    return normalizeList<PromocionFirma>(data);
  },

  createPromocionFirma: async (payload: PromocionFirma): Promise<PromocionFirma> => {
    const { data } = await apiClient.post('/firmas/promociones/', payload);
    return data;
  },

  createPromocionesFirma: async (payload: PromocionFirmaBulkPayload): Promise<PromocionFirma[]> => {
    const { data } = await apiClient.post('/firmas/promociones/crear-multiples/', payload);
    return normalizeList<PromocionFirma>(data);
  },

  updatePromocionFirma: async (id: number, payload: Partial<PromocionFirma>): Promise<PromocionFirma> => {
    const { data } = await apiClient.patch(`/firmas/promociones/${id}/`, payload);
    return data;
  },

  deletePromocionFirma: async (id: number): Promise<void> => {
    await apiClient.delete(`/firmas/promociones/${id}/`);
  },

  listCuponesFirma: async (): Promise<CuponFirma[]> => {
    const { data } = await apiClient.get('/firmas/cupones/');
    return normalizeList<CuponFirma>(data);
  },

  createCuponFirma: async (payload: CuponFirma): Promise<CuponFirma> => {
    const { data } = await apiClient.post('/firmas/cupones/', payload);
    return data;
  },

  updateCuponFirma: async (id: number, payload: Partial<CuponFirma>): Promise<CuponFirma> => {
    const { data } = await apiClient.patch(`/firmas/cupones/${id}/`, payload);
    return data;
  },

  deleteCuponFirma: async (id: number): Promise<void> => {
    await apiClient.delete(`/firmas/cupones/${id}/`);
  },

  validateCuponFirma: async (payload: { code: string; validity: VigenciaFirma; identification?: string; email?: string; phone?: string }): Promise<CuponFirmaQuote> => {
    const { data } = await apiClient.post('/firmas/cupones-publicos/validar/', payload);
    return data;
  },

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

  createPublic: async (payload: SolicitudFirmaPublicPayload): Promise<PublicFinalizeResponse> => {
    const fields = { ...payload };
    delete fields.archivos;
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

  finalizePublic: async (id: number, requestNumber: string): Promise<PublicFinalizeResponse> => {
    const { data } = await apiClient.post(`/firmas/solicitudes-publicas/${id}/finalizar/`, {
      request_number: requestNumber,
    });
    return data;
  },

  getPublicPaymentRequest: async (params: { requestNumber: string; transaction?: string; verification?: string }): Promise<PublicSignatureLookupResponse> => {
    const { data } = await apiClient.get('/firmas/solicitudes-publicas/consulta-pago/', {
      params: {
        request_number: params.requestNumber,
        transaction: params.transaction,
        verification: params.verification,
      },
    });
    return data;
  },


  createPayPhoneFirmaPayment: async (id: number, requestNumber: string): Promise<PayPhoneFirmaPaymentResponse> => {
    const { data } = await apiClient.post(`/firmas/solicitudes-publicas/${id}/payphone/`, {
      request_number: requestNumber,
    });
    return data;
  },

  createPayPhoneFirmaBoxPayment: async (id: number, requestNumber: string): Promise<PayPhoneFirmaPaymentResponse> => {
    const { data } = await apiClient.post(`/firmas/solicitudes-publicas/${id}/payphone/cajita/`, {
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

  markTransferPayment: async (id: number, payload: {
    cuenta_bancaria: number;
    amount: string;
    fecha_pago?: string;
    referencia?: string;
    observacion?: string;
    confirmado: boolean;
  }): Promise<SolicitudFirma> => {
    const { data } = await apiClient.post(`/firmas/solicitudes/${id}/marcar_pago_transferencia/`, payload);
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
