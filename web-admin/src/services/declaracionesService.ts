import apiClient from './apiClient';

const BASE = '/declaraciones';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Form104Response {
  periodo: { anio: number; mes: number; mes_nombre: string };
  empresa: { ruc: string; razon_social: string };
  fecha_limite: string;
  ventas: {
    num_facturas: number;
    subtotal_sin_impuestos: number;
    subtotal_0: number;
    subtotal_12: number;
    subtotal_15: number;
    iva_12: number;
    iva_15: number;
    total_descuento: number;
    total_ventas_bruto: number;
  };
  notas_credito: { cantidad: number; total: number; iva: number };
  notas_debito: { cantidad: number; total: number };
  compras: {
    num_ordenes: number;
    subtotal: number;
    iva: number;
    total: number;
  };
  retenciones_iva_emitidas: { base_imponible: number; valor_retenido: number };
  liquidacion: {
    iva_ventas_neto: number;
    credito_tributario: number;
    iva_causado: number;
    credito_tributario_favor: number;
    iva_a_pagar: number;
    total_ventas_neto: number;
  };
  nota: string;
}

export interface RetencionGrupo {
  codigo_porcentaje: string;
  tarifa: string;
  base_imponible: string;
  valor_retenido: string;
  cantidad: number;
}

export interface Form103Response {
  periodo: { anio: number; mes: number; mes_nombre: string };
  empresa: { ruc: string; razon_social: string };
  fecha_limite: string;
  num_comprobantes_retencion: number;
  retenciones_renta: RetencionGrupo[];
  retenciones_iva: RetencionGrupo[];
  totales: {
    base_imponible_renta: number;
    total_retenido_renta: number;
    base_imponible_iva: number;
    total_retenido_iva: number;
  };
}

export interface Obligacion {
  mes: number;
  tipo_formulario: string;
  nombre: string;
  fecha_limite: string;
  estado: 'pendiente' | 'presentada' | 'vencida';
  declaracion_id: number | null;
}

export interface CalendarioResponse {
  anio: number;
  empresa: { ruc: string; razon_social: string };
  obligaciones: Obligacion[];
}

export interface DeclaracionMensual {
  id: number;
  empresa: number;
  tipo_formulario: string;
  tipo_display: string;
  anio: number;
  mes: number;
  mes_nombre: string;
  estado: string;
  estado_display: string;
  total_ventas: number;
  total_compras: number;
  iva_ventas: number;
  iva_compras: number;
  impuesto_a_pagar: number;
  credito_tributario: number;
  total_retenido: number;
  fecha_limite: string;
  fecha_presentacion: string | null;
  numero_formulario_sri: string;
  notas: string;
  datos_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── API service ──────────────────────────────────────────────────────────────

export const declaracionesService = {
  // ── Lectura en tiempo real ─────────────────────────────────────────────
  getForm104: async (anio: number, mes: number): Promise<Form104Response> => {
    const res = await apiClient.get(`${BASE}/form104/`, { params: { anio, mes } });
    return res.data as Form104Response;
  },

  getForm103: async (anio: number, mes: number): Promise<Form103Response> => {
    const res = await apiClient.get(`${BASE}/form103/`, { params: { anio, mes } });
    return res.data as Form103Response;
  },

  downloadAts: async (anio: number, mes: number): Promise<void> => {
    const res = await apiClient.get(`${BASE}/ats/`, {
      params: { anio, mes },
      responseType: 'blob',
    });
    const blob = new Blob([res.data as BlobPart], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_${anio}_${String(mes).padStart(2, '0')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Calendario ─────────────────────────────────────────────────────────
  getCalendario: async (anio: number): Promise<CalendarioResponse> => {
    const res = await apiClient.get(`${BASE}/calendario/`, { params: { anio } });
    return res.data as CalendarioResponse;
  },

  getProximas: async (): Promise<{ proximas: Obligacion[] }> => {
    const res = await apiClient.get(`${BASE}/proximas/`);
    return res.data as { proximas: Obligacion[] };
  },

  // ── CRUD persistente ──────────────────────────────────────────────────
  listar: async (anio?: number, tipo?: string): Promise<DeclaracionMensual[]> => {
    const params: Record<string, string> = {};
    if (anio) params.anio = String(anio);
    if (tipo) params.tipo = tipo;
    const res = await apiClient.get(`${BASE}/`, { params });
    return res.data as DeclaracionMensual[];
  },

  calcularYGuardar: async (tipo: string, anio: number, mes: number): Promise<DeclaracionMensual> => {
    const res = await apiClient.post(`${BASE}/calcular/`, { tipo, anio, mes });
    return res.data as DeclaracionMensual;
  },

  detalle: async (id: number): Promise<DeclaracionMensual> => {
    const res = await apiClient.get(`${BASE}/${id}/`);
    return res.data as DeclaracionMensual;
  },

  marcarPresentada: async (id: number, datos: { numero_formulario_sri?: string; notas?: string }): Promise<DeclaracionMensual> => {
    const res = await apiClient.post(`${BASE}/${id}/presentar/`, datos);
    return res.data as DeclaracionMensual;
  },
};
