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
  ventas_hoy: number;
  ventas_hoy_cantidad: number;
  cobrado_hoy: number;
  cobrado_mes: number;
  ticket_promedio_mes: number;
  facturas_emitidas: number;
  facturas_autorizadas: number;
  facturas_enviadas: number;
  facturas_rechazadas: number;
  facturas_por_estado: Record<string, number>;
  notas_credito_pendientes: number;
  notas_credito_hoy: number;
  productos_activos: number;
  clientes_activos: number;
  stock_bajo_count: number;
  cajas_abiertas: number;
  pedidos_abiertos: number;
  total_por_cobrar: number;
  total_vencido: number;
  cuentas_vencidas: number;
  alertas_operativas: {
    key: string;
    label: string;
    valor: number;
    ruta: string;
  }[];
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
    cantidad_vendida: number;
    ingreso: number;
  }[];
  top_clientes: {
    id: number;
    nombre: string;
    total: number;
    cantidad: number;
  }[];
  ventas_por_metodo: {
    forma_pago: string;
    total: number;
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
