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
  // Inicio
  { codigo: 'dashboard',      ruta: '/',                label: 'Dashboard',          grupo: 'Inicio' },
  // Ventas
  { codigo: 'pos',            ruta: '/pos',             label: 'POS',                grupo: 'Ventas' },
  { codigo: 'cotizaciones',   ruta: '/cotizaciones',    label: 'Cotizaciones',       grupo: 'Ventas' },
  { codigo: 'pedidos',        ruta: '/pedidos',         label: 'Mesas y Pedidos',    grupo: 'Ventas' },
  { codigo: 'ventas',         ruta: '/ventas',          label: 'Ventas',             grupo: 'Ventas' },
  { codigo: 'clientes',       ruta: '/clientes',        label: 'Clientes',           grupo: 'Ventas' },
  // Facturación Electrónica
  { codigo: 'facturacion',    ruta: '/facturacion',     label: 'Facturas',           grupo: 'Facturación Electrónica' },
  { codigo: 'notas_credito',  ruta: '/notas-credito',   label: 'Notas de Crédito',   grupo: 'Facturación Electrónica' },
  { codigo: 'notas_debito',   ruta: '/notas-debito',    label: 'Notas de Débito',    grupo: 'Facturación Electrónica' },
  { codigo: 'retenciones',    ruta: '/retenciones',     label: 'Retenciones',        grupo: 'Facturación Electrónica' },
  { codigo: 'guias_remision', ruta: '/guias-remision',  label: 'Guías de Remisión',  grupo: 'Facturación Electrónica' },
  // Inventario
  { codigo: 'productos',      ruta: '/productos',       label: 'Productos',          grupo: 'Inventario' },
  { codigo: 'inventarios',    ruta: '/inventarios',     label: 'Inventarios',        grupo: 'Inventario' },
  // Compras
  { codigo: 'proveedores',    ruta: '/proveedores',     label: 'Proveedores',        grupo: 'Compras' },
  // Finanzas
  { codigo: 'cartera',        ruta: '/cartera',         label: 'Cartera',            grupo: 'Finanzas' },
  { codigo: 'bancos',         ruta: '/bancos',          label: 'Bancos',             grupo: 'Finanzas' },
  { codigo: 'contabilidad',   ruta: '/contabilidad',    label: 'Contabilidad',       grupo: 'Finanzas' },
  { codigo: 'declaraciones',  ruta: '/declaraciones',   label: 'Declaraciones SRI',  grupo: 'Finanzas' },
  { codigo: 'nomina',         ruta: '/nomina',          label: 'Nómina',             grupo: 'Finanzas' },
  { codigo: 'firmas_electronicas', ruta: '/firmas-electronicas', label: 'Solicitudes de Firma Electrónica', grupo: 'Administración' },
  // Reportes
  { codigo: 'reportes',       ruta: '/reportes',        label: 'Reportes',           grupo: 'Reportes' },
  // Administración
  { codigo: 'usuarios',       ruta: '/usuarios',        label: 'Usuarios',           grupo: 'Administración' },
  { codigo: 'configuracion',  ruta: '/configuracion',   label: 'Configuración',      grupo: 'Administración' },
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
