import apiClient from './apiClient';

export interface DashboardSuperAdmin {
  tipo: 'super_admin';
  empresas_total: number;
  empresas_activas: number;
  usuarios_total: number;
  admins_empresa: number;
  suscripciones_activas: number;
  empresas: {
    id: number;
    razon_social: string;
    ruc: string;
    email: string | null;
    activa: boolean;
  }[];
}

export interface DashboardTenant {
  tipo: 'tenant';
  ventas_mes: number;
  ventas_mes_cantidad: number;
  facturas_emitidas: number;
  facturas_enviadas: number;
  facturas_por_estado: Record<string, number>;
  productos_activos: number;
  clientes_activos: number;
  facturas_recientes: {
    id: number;
    numero_factura: string;
    estado: string;
    total: number;
    cliente_nombre: string;
  }[];
  top_productos: {
    id: number;
    nombre: string;
    precio: number;
    stock_actual: number;
  }[];
  stock_bajo: {
    id: number;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
  }[];
  ultimos_meses: {
    mes: number;
    anio: number;
    label: string;
    total_ventas: number;
    cantidad_ventas: number;
  }[];
  proximas_declaraciones: {
    tipo: string;
    periodo: string;
    fecha_limite: string;
    dias_restantes: number;
  }[];
}

export type DashboardData = DashboardSuperAdmin | DashboardTenant;

export const dashboardService = {
  get: async (): Promise<DashboardData> => {
    const { data } = await apiClient.get('/dashboard/');
    return data;
  },
};
