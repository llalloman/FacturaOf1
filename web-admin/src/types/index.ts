export interface Producto {
  id: number;
  codigo_principal: string;
  codigo_auxiliar?: string;
  tipo: 'BIEN' | 'SERVICIO';
  nombre: string;
  descripcion?: string;
  precio: number;
  precio_minimo?: number;
  costo: number;
  aplica_iva: boolean;
  porcentaje_iva: string; // '0','2','4','6','7'
  maneja_inventario: boolean;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  fecha_creacion?: string;
  fecha_modificacion?: string;
}

export interface Cliente {
  id: number;
  tipo_identificacion: string;
  identificacion: string;
  razon_social: string;
  nombre_comercial?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  activo: boolean;
  created_at?: string;
}

export interface Factura {
  id: number;
  numero_factura: string;
  cliente: number;
  cliente_nombre?: string;
  fecha_emision: string;
  subtotal_sin_impuestos: number;
  total_descuento: number;
  total: number;
  estado: 'BORRADOR' | 'AUTORIZADO' | 'ANULADO' | 'ENVIADO' | 'RECHAZADO' | 'FIRMADO' | 'NO_AUTORIZADO';
  clave_acceso?: string;
  numero_autorizacion?: string;
  fecha_autorizacion?: string;
  mensajes_sri?: string;
  forma_pago?: string;
  observaciones?: string;
  detalles?: DetalleFactura[];
}

export interface DetalleFactura {
  id?: number;
  producto: number;
  producto_nombre?: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  impuestos: number;
  total: number;
}

export interface Proveedor {
  id: number;
  tipo_identificacion: string;
  identificacion: string;
  razon_social: string;
  nombre_comercial?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  activo: boolean;
  created_at?: string;
}

export interface Bodega {
  id: number;
  nombre: string;
  codigo: string;
  direccion?: string;
  es_principal: boolean;
  activa: boolean;
  fecha_creacion?: string;
}

export interface MovimientoInventario {
  id: number;
  bodega: number;
  bodega_nombre?: string;
  producto: number;
  producto_nombre?: string;
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRANSFERENCIA';
  cantidad: number;
  fecha: string;
  observaciones?: string;
  created_at?: string;
}

export interface OrdenCompra {
  id: number;
  proveedor: number;
  proveedor_nombre?: string;
  numero_orden: string;
  fecha_orden: string;
  estado: 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';
  subtotal: number;
  impuestos: number;
  total: number;
  created_at?: string;
}

export interface Venta {
  id: number;
  cliente: number;
  cliente_detalle?: {
    razon_social: string;
    identificacion: string;
  };
  usuario_nombre?: string;
  caja_nombre?: string;
  numero_venta: string;
  fecha_venta: string;
  subtotal: number;
  subtotal_0: number;
  subtotal_12: number;
  subtotal_15: number;
  iva: number;
  descuento: number;
  total: number;
  estado: string;
  pagos?: Array<{ forma_pago: string; monto: number }>;
  created_at?: string;
}

export interface Usuario {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  nombre_completo?: string;
  cedula?: string;
  telefono?: string;
  rol: 'SUPER_ADMIN' | 'ADMIN_EMPRESA' | 'CONTADOR' | 'VENDEDOR' | 'CONSULTOR';
  empresa?: number;
  empresa_nombre?: string;
  is_active: boolean;
  is_staff?: boolean;
  fecha_registro?: string;
  ultima_actividad?: string;
}

export interface Empresa {
  id: number;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  ciudad?: string;
  direccion_matriz: string;
  telefono?: string;
  email?: string;
  tipo_contribuyente?: string;
  obligado_contabilidad: boolean;
  contribuyente_especial?: string;
  gran_contribuyente?: boolean;
  regimen_rimpe?: boolean;
  tipo_rimpe?: string;
  exportador?: boolean;
  tipo_exportador?: string;
  agente_retencion?: boolean;
  ambiente?: '1' | '2';
  certificado_digital?: string;
  password_certificado?: string;
  fecha_vencimiento_certificado?: string;
  firmado_automatico?: boolean;
  establecimiento_codigo?: string;
  punto_emision_codigo?: string;
  logo?: string;
  mensaje_personalizado?: string;
  activa: boolean;
  verificada?: boolean;
  fecha_creacion?: string;
}

export interface Caja {
  id: number;
  empresa: number;
  bodega: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  impresora_termica?: string;
  activa: boolean;
  created_at?: string;
}
