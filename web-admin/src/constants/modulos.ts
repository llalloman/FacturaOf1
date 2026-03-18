/**
 * Catálogo de módulos del sistema.
 * Cada módulo tiene un código que corresponde al campo `modulo` en ModuloPermiso (backend).
 * El código también se usa como key en el hook useModulosAcceso.
 */
export interface ModuloInfo {
  codigo: string;
  ruta: string;
  label: string;
  grupo: string;
}

export const MODULOS: ModuloInfo[] = [
  // General
  { codigo: 'dashboard',      ruta: '/',                label: 'Dashboard',         grupo: 'General' },
  // Facturación SRI
  { codigo: 'facturacion',    ruta: '/facturacion',     label: 'Facturación',       grupo: 'Facturación SRI' },
  { codigo: 'retenciones',    ruta: '/retenciones',     label: 'Retenciones',       grupo: 'Facturación SRI' },
  { codigo: 'guias_remision', ruta: '/guias-remision',  label: 'Guías de Remisión', grupo: 'Facturación SRI' },
  { codigo: 'notas_debito',   ruta: '/notas-debito',    label: 'Notas de Débito',   grupo: 'Facturación SRI' },
  { codigo: 'notas_credito',  ruta: '/notas-credito',   label: 'Notas de Crédito',  grupo: 'Facturación SRI' },
  // Finanzas
  { codigo: 'cartera',        ruta: '/cartera',         label: 'Cartera por Cobrar', grupo: 'Finanzas' },
  { codigo: 'declaraciones',  ruta: '/declaraciones',   label: 'Declaraciones SRI', grupo: 'Finanzas' },
  { codigo: 'contabilidad',   ruta: '/contabilidad',    label: 'Contabilidad',      grupo: 'Finanzas' },
  { codigo: 'bancos',         ruta: '/bancos',          label: 'Bancos',            grupo: 'Finanzas' },
  { codigo: 'nomina',         ruta: '/nomina',          label: 'Nómina',            grupo: 'Finanzas' },
  // Comercial
  { codigo: 'cotizaciones',   ruta: '/cotizaciones',    label: 'Cotizaciones',      grupo: 'Comercial' },
  { codigo: 'ventas',         ruta: '/ventas',          label: 'Ventas',            grupo: 'Comercial' },
  { codigo: 'pedidos',        ruta: '/pedidos',         label: 'Mesas / Pedidos',   grupo: 'Comercial' },
  { codigo: 'clientes',       ruta: '/clientes',        label: 'Clientes',          grupo: 'Comercial' },
  // Catálogo
  { codigo: 'productos',      ruta: '/productos',       label: 'Productos',         grupo: 'Catálogo' },
  { codigo: 'proveedores',    ruta: '/proveedores',     label: 'Proveedores',       grupo: 'Catálogo' },
  { codigo: 'inventarios',    ruta: '/inventarios',     label: 'Inventarios',       grupo: 'Catálogo' },
  // Administración
  { codigo: 'reportes',       ruta: '/reportes',        label: 'Reportes',          grupo: 'Administración' },
  { codigo: 'configuracion',  ruta: '/configuracion',   label: 'Configuración',     grupo: 'Administración' },
  { codigo: 'usuarios',       ruta: '/usuarios',        label: 'Usuarios',          grupo: 'Administración' },
  // POS
  { codigo: 'pos',            ruta: '/pos',             label: 'Punto de Venta',    grupo: 'POS' },
];

/** Mapa ruta → código para lookup O(1) */
export const RUTA_A_MODULO: Record<string, string> = Object.fromEntries(
  MODULOS.map((m) => [m.ruta, m.codigo])
);

/** Mapa código → info del módulo */
export const MODULO_POR_CODIGO: Record<string, ModuloInfo> = Object.fromEntries(
  MODULOS.map((m) => [m.codigo, m])
);

/** Lista de todos los códigos (equivalente al backend TODOS_LOS_MODULOS) */
export const TODOS_LOS_CODIGOS = MODULOS.map((m) => m.codigo);
