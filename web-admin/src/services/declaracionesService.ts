import apiClient from './apiClient';

const BASE = '/declaraciones';

export interface Form104Response {
  periodo: { anio: number; mes: number; mes_nombre: string };
  empresa: { ruc: string; razon_social: string };
  ventas: {
    num_comprobantes: number;
    subtotal_0: number;
    subtotal_12: number;
    subtotal_15: number;
    total_descuento: number;
    iva_12: number;
    iva_15: number;
    iva_total: number;
    total_ventas_neto: number;
  };
  compras: {
    num_ordenes: number;
    subtotal: number;
    iva_compras: number;
    total_compras: number;
  };
  retenciones_iva: number;
  credito_tributario: number;
  iva_a_pagar: number;
  nota: string;
}

export interface RetencionGrupo {
  codigo_porcentaje: string;
  tarifa: number;
  base_total: number;
  retenido_total: number;
  num_retenciones: number;
}

export interface Form103Response {
  periodo: { anio: number; mes: number; mes_nombre: string };
  empresa: { ruc: string; razon_social: string };
  retenciones_renta: RetencionGrupo[];
  retenciones_iva: RetencionGrupo[];
  totales: {
    base_imponible_total: number;
    total_retenido_renta: number;
  };
}

export const declaracionesService = {
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
};
