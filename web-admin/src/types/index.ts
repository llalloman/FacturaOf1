export interface Producto {
  id: number;
  codigo_principal: string;
  codigo_auxiliar?: string;
  tipo: 'BIEN' | 'SERVICIO';
  nombre: string;
  descripcion?: string;
  precio: number;
  precio_con_iva?: number;
  precio_minimo?: number;
  costo: number;
  aplica_iva: boolean;
  porcentaje_iva: string; // '0','2','4','6','7'
  maneja_inventario: boolean;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  imagen?: string | null;
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

export interface ImpuestoRetencion {
  id?: number;
  codigo: string;
  codigo_porcentaje: string;
  tarifa: number;
  base_imponible: number;
  valor_retenido: number;
  cod_doc_sustento: string;
  num_doc_sustento: string;
  fecha_emision_doc_sustento: string;
}

export interface Retencion {
  id: number;
  numero_retencion: string;
  proveedor: number;
  proveedor_nombre?: string;
  periodo_fiscal: string;
  fecha_emision: string;
  estado: 'BORRADOR' | 'AUTORIZADO' | 'ANULADO' | 'ENVIADO' | 'RECHAZADO' | 'NO_AUTORIZADO';
  numero_autorizacion?: string;
  mensajes_sri?: string;
  total_retenido: number;
  impuestos?: ImpuestoRetencion[];
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
  genera_factura?: boolean;
  tipo_documento?: 'FACTURA' | 'NOTA_VENTA';
  estado_documento?: string;
  total_facturado?: number | null;
  diferencia_vs_factura?: number | null;
  factura_detalle?: Factura | null;
  detalles?: Array<{
    id: number;
    producto: number;
    proveedor?: number | null;
    bodega?: number | null;
    cantidad: number;
    precio_unitario: number;
    costo_unitario: number;
    subtotal: number;
    iva: number;
    total: number;
    producto_detalle?: {
      nombre: string;
      codigo_principal: string;
    };
  }>;
  pagos?: Array<{
    id: number;
    forma_pago: string;
    monto: number;
    cuenta_bancaria?: number | null;
    movimiento_bancario?: number | null;
  }>;
  created_at?: string;
}

export interface CoherenciaFacturacionItem {
  venta_id: number;
  numero_venta: string;
  factura_id: number;
  numero_factura: string | null;
  total_venta: number;
  total_factura: number;
  diferencia: number;
  coherente: boolean;
  estado_factura: string | null;
  fecha_venta: string;
}

export interface CoherenciaFacturacionResponse {
  resumen: {
    ventas_facturadas: number;
    coherentes: number;
    inconsistentes: number;
    tolerancia: number;
  };
  resultados: CoherenciaFacturacionItem[];
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

export interface DetalleGuia {
  id?: number;
  codigo_interno: string;
  descripcion: string;
  cantidad: number;
}

export interface DestinatarioGuia {
  id?: number;
  identificacion_destinatario: string;
  razon_social_destinatario: string;
  dir_dest_destinatario: string;
  motorista_y_ca: string;
  ruta?: string;
  cod_doc_sustento: string;
  num_doc_sustento?: string;
  fecha_emision_doc_sust?: string;
  num_autorizacion_doc_sust?: string;
  detalles?: DetalleGuia[];
}

export interface GuiaRemision {
  id: number;
  numero_guia: string;
  estado: 'BORRADOR' | 'AUTORIZADO' | 'ANULADO' | 'ENVIADO' | 'RECHAZADO' | 'NO_AUTORIZADO';
  fecha_emision: string;
  numero_autorizacion?: string;
  mensajes_sri?: string;
  ruc_transportista: string;
  razon_social_transportista: string;
  placa: string;
  fecha_inicio_transporte: string;
  fecha_fin_transporte: string;
  dir_partida: string;
  destinatarios?: DestinatarioGuia[];
}

export interface DetalleNotaDebito {
  id?: number;
  razon: string;
  valor: number;
  codigo_porcentaje?: string;
  tarifa?: number;
  valor_impuesto?: number;
}

export interface NotaDebito {
  id: number;
  numero_nota: string;
  cliente: number;
  cliente_nombre?: string;
  factura_origen?: number;
  motivo: string;
  fecha_emision: string;
  estado: 'BORRADOR' | 'AUTORIZADO' | 'ANULADO' | 'ENVIADO' | 'RECHAZADO' | 'NO_AUTORIZADO';
  numero_autorizacion?: string;
  mensajes_sri?: string;
  subtotal_sin_impuestos: number;
  total: number;
  detalles?: DetalleNotaDebito[];
}

export interface DetalleNotaCredito {
  id: number;
  codigo_principal: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  precio_total_sin_impuesto: number;
  tarifa: number;
  valor_impuesto: number;
}

export interface NotaCredito {
  id: number;
  numero_nota_credito: string;
  factura_origen: number;
  numero_factura_origen: string;
  cliente_nombre: string;
  motivo: string;
  fecha_emision: string;
  estado: 'BORRADOR' | 'FIRMADO' | 'ENVIADO' | 'AUTORIZADO' | 'RECHAZADO' | 'NO_AUTORIZADO' | 'ANULADO';
  numero_autorizacion?: string;
  mensajes_sri?: string;
  subtotal_sin_impuestos: number;
  total_descuento: number;
  total: number;
  detalles?: DetalleNotaCredito[];
}

export interface Secuencial {
  id: number;
  empresa: number;
  tipo_comprobante: '01' | '04' | '05' | '06' | '07';
  tipo_comprobante_display: string;
  establecimiento: string;
  punto_emision: string;
  secuencial_actual: number;
  configurado: boolean;
}

// ─── Cartera (Cuentas por Cobrar) ─────────────────────────────────────────────
export interface PagoCliente {
  id: number;
  cuenta: number;
  fecha_pago: string;
  monto: number;
  forma_pago: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CHEQUE' | 'OTRO';
  referencia: string;
  notas: string;
  created_at: string;
}

export interface CuentaPorCobrar {
  id: number;
  empresa: number;
  cliente: number;
  cliente_nombre: string;
  factura?: number;
  factura_numero?: string;
  numero_cuenta: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  monto_total: number;
  saldo: number;
  total_pagado: number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDA' | 'INCOBRABLE';
  dias_vencimiento: number;
  bucket_aging: 'vigente' | '1-30' | '31-60' | '61-90' | '+90';
  notas: string;
  created_at: string;
  pagos?: PagoCliente[];
}

export interface AgingBucket {
  bucket: string;
  label: string;
  cantidad: number;
  total: number;
  cuentas: {
    id: number;
    numero_cuenta: string;
    cliente: string;
    fecha_vencimiento: string;
    saldo: number;
    dias_vencimiento: number;
  }[];
}

export interface CarteraResumen {
  total_por_cobrar: number;
  cuentas_pendientes: number;
  total_vencido: number;
  cuentas_vencidas: number;
  cobrado_mes: number;
  total_incobrable: number;
}

// ─── Suscripciones ────────────────────────────────────────────────────────────
export interface PlanSuscripcion {
  id: number;
  nombre: string;
  codigo: string;
  tipo: 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL' | 'ILIMITADO';
  periodo: 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
  precio: number;
  facturas_mensuales: number;
  usuarios_permitidos: number;
  empresas_permitidas: number;
  soporte_prioritario: boolean;
  api_access: boolean;
  reportes_avanzados: boolean;
  activo: boolean;
  descripcion: string;
}

export interface Suscripcion {
  id: number;
  empresa: number;
  empresa_nombre: string;
  plan: number;
  plan_detalle: PlanSuscripcion;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_proximo_pago?: string;
  estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA' | 'PRUEBA';
  auto_renovar: boolean;
  facturas_emitidas_mes_actual: number;
  ultimo_reset_contador: string;
  dias_restantes: number;
  notas: string;
}
